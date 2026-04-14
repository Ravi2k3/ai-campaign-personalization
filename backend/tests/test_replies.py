"""Tests for reply processing: HTML/text extraction and mark_lead_replied."""

import pytest

from src.mail.replies import extract_reply_html, extract_reply_text, mark_lead_replied
from src.db.engine import get_cursor
from conftest import insert_user, insert_campaign, insert_lead, insert_email


class TestExtractReplyHTML:
    def test_gmail_quote(self):
        html = '<p>Thanks for reaching out!</p><div class="gmail_quote"><p>On Mon wrote:</p><p>Original</p></div>'
        result = extract_reply_html(html)
        assert "Thanks for reaching out!" in result
        assert "Original" not in result

    def test_outlook_reply(self):
        html = '<p>Sounds good.</p><div id="divRplyFwdMsg"><p>From: sender</p></div>'
        result = extract_reply_html(html)
        assert "Sounds good." in result
        assert "From: sender" not in result

    def test_blockquote(self):
        html = "<p>I'm interested.</p><blockquote><p>Previous message</p></blockquote>"
        result = extract_reply_html(html)
        assert "interested" in result
        assert "Previous message" not in result

    def test_no_quote_returns_unchanged(self):
        html = "<p>Just a simple reply with no quotes.</p>"
        result = extract_reply_html(html)
        assert result == html

    def test_empty_string(self):
        assert extract_reply_html("") == ""


class TestExtractReplyText:
    def test_quoted_lines(self):
        text = "Yes, let's meet.\n\n> On Mon, Jan 1, you wrote:\n> Previous message"
        result = extract_reply_text(text)
        assert "let's meet" in result
        assert "Previous message" not in result

    def test_on_wrote_marker(self):
        text = "Thanks!\n\nOn Mon, Jan 1, 2025, John wrote:\nOriginal message here"
        result = extract_reply_text(text)
        assert "Thanks!" in result
        assert "Original message" not in result

    def test_original_message_separator(self):
        text = "Got it, will review.\n\n--- Original Message ---\nFrom: sender@test.com"
        result = extract_reply_text(text)
        assert "Got it" in result
        assert "sender@test.com" not in result


class TestMarkLeadReplied:
    def test_full_flow(self):
        user = insert_user()
        campaign = insert_campaign(user_id=user["id"])
        lead = insert_lead(campaign_id=campaign["id"], has_replied=False, status="active")
        insert_email(lead_id=lead["id"], sequence_number=1, status="sent")

        result = mark_lead_replied(
            lead_id=lead["id"],
            subject="Re: Hello",
            reply_content="Thanks for reaching out!",
            gmail_message_id="<reply-123@gmail.com>",
        )
        assert result is True

        # Verify lead state
        with get_cursor() as cur:
            cur.execute("SELECT has_replied, status FROM leads WHERE id = %s", (lead["id"],))
            row = cur.fetchone()
            assert row["has_replied"] is True
            assert row["status"] == "replied"

        # Verify reply email recorded
        with get_cursor() as cur:
            cur.execute(
                "SELECT * FROM emails WHERE lead_id = %s AND status = 'received'",
                (lead["id"],),
            )
            reply_email = cur.fetchone()
            assert reply_email is not None
            assert reply_email["sequence_number"] == 0
            assert "[REPLY]" in reply_email["subject"]
            assert reply_email["message_id"] == "<reply-123@gmail.com>"

    def test_idempotent(self):
        user = insert_user()
        campaign = insert_campaign(user_id=user["id"])
        lead = insert_lead(campaign_id=campaign["id"], has_replied=False)

        mark_lead_replied(lead["id"], "Re: Hi", "First call")
        result = mark_lead_replied(lead["id"], "Re: Hi", "Second call")
        assert result is True

        # Only one reply email should exist
        with get_cursor() as cur:
            cur.execute(
                "SELECT COUNT(*) as count FROM emails WHERE lead_id = %s AND status = 'received'",
                (lead["id"],),
            )
            assert cur.fetchone()["count"] == 1

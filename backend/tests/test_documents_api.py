"""
Tests for the product document upload endpoint.

The upstream services (LlamaParse parser, LLM summarizer) are mocked so
tests don't hit the network or burn credits. The goal is to verify the
API contract: validation, ownership, persistence, cascades on delete.
"""

import io
from unittest.mock import AsyncMock, patch

import pytest

from src.db.engine import get_cursor
from conftest import insert_campaign


def _fake_pdf_bytes(n: int = 2048) -> bytes:
    """Cheap byte blob; real extension doesn't need a real PDF because
    we mock parse_document, which never opens the bytes."""
    return b"%PDF-1.4\n" + (b"x" * n)


@pytest.fixture
def mock_upstreams():
    """Mock the LlamaParse + summarizer pipeline with success returns."""
    with (
        patch("src.api.documents.parse_document", new=AsyncMock(return_value="# Parsed markdown\n\nFacts go here.")) as p,
        patch("src.api.documents.summarize_to_brief", new=AsyncMock(return_value="## Company\n\n- Founded 2003.\n- 400+ furnaces delivered.\n" * 10)) as s,
    ):
        yield p, s


class TestUploadDocument:
    def test_upload_pdf_generates_brief(self, client, test_user, mock_upstreams):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")
        resp = client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("lvt.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["document_name"] == "lvt.pdf"
        assert "400+ furnaces" in data["brief"]
        assert data["word_count"] > 0

        with get_cursor() as cur:
            cur.execute(
                "SELECT product_context, product_document_name FROM campaigns WHERE id = %s",
                (campaign["id"],),
            )
            row = cur.fetchone()
            assert row["product_document_name"] == "lvt.pdf"
            assert "400+ furnaces" in row["product_context"]

    def test_upload_rejects_unsupported_extension(self, client, test_user):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")
        resp = client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("virus.exe", io.BytesIO(b"MZ"), "application/octet-stream")},
        )
        assert resp.status_code == 400
        assert "Unsupported file type" in resp.json()["detail"]

    def test_upload_rejects_empty_file(self, client, test_user):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")
        resp = client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("empty.pdf", io.BytesIO(b""), "application/pdf")},
        )
        assert resp.status_code == 400
        assert "empty" in resp.json()["detail"].lower()

    def test_upload_rejects_oversized_file(self, client, test_user):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")
        huge = b"x" * (11 * 1024 * 1024)  # 11 MB, above the 10 MB cap
        resp = client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("big.pdf", io.BytesIO(huge), "application/pdf")},
        )
        assert resp.status_code == 413

    def test_upload_to_active_campaign_returns_400(self, client, test_user, mock_upstreams):
        """Only draft/paused campaigns are mutable."""
        campaign = insert_campaign(user_id=test_user["id"], status="active")
        resp = client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("x.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
        )
        assert resp.status_code == 400
        assert "draft or paused" in resp.json()["detail"].lower()

    def test_upload_to_other_users_campaign_returns_404(self, client, second_user, mock_upstreams):
        other_campaign = insert_campaign(user_id=second_user["id"], status="draft")
        resp = client.post(
            f"/campaigns/{other_campaign['id']}/document",
            files={"file": ("x.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
        )
        assert resp.status_code == 404

    def test_upload_parser_failure_returns_422(self, client, test_user):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")
        from src.documents import DocumentParseError

        with patch(
            "src.api.documents.parse_document",
            new=AsyncMock(side_effect=DocumentParseError("no text extracted")),
        ):
            resp = client.post(
                f"/campaigns/{campaign['id']}/document",
                files={"file": ("scanned.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
            )
        assert resp.status_code == 422
        assert "no text extracted" in resp.json()["detail"]

        # Make sure a failed parse does NOT leave stale state on the campaign
        with get_cursor() as cur:
            cur.execute(
                "SELECT product_context FROM campaigns WHERE id = %s",
                (campaign["id"],),
            )
            assert cur.fetchone()["product_context"] is None

    def test_upload_replaces_previous_document(self, client, test_user, mock_upstreams):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")

        # First upload
        client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("first.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
        )

        # Second upload overwrites
        resp = client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("second.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
        )
        assert resp.status_code == 200
        assert resp.json()["document_name"] == "second.pdf"

        with get_cursor() as cur:
            cur.execute(
                "SELECT product_document_name FROM campaigns WHERE id = %s",
                (campaign["id"],),
            )
            assert cur.fetchone()["product_document_name"] == "second.pdf"


class TestDeleteDocument:
    def test_delete_clears_brief(self, client, test_user, mock_upstreams):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")
        client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("x.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
        )

        resp = client.delete(f"/campaigns/{campaign['id']}/document")
        assert resp.status_code == 200

        with get_cursor() as cur:
            cur.execute(
                "SELECT product_context, product_document_name FROM campaigns WHERE id = %s",
                (campaign["id"],),
            )
            row = cur.fetchone()
            assert row["product_context"] is None
            assert row["product_document_name"] is None

    def test_delete_on_active_campaign_returns_400(self, client, test_user):
        campaign = insert_campaign(user_id=test_user["id"], status="active")
        resp = client.delete(f"/campaigns/{campaign['id']}/document")
        assert resp.status_code == 400

    def test_delete_other_users_campaign_returns_404(self, client, second_user):
        other_campaign = insert_campaign(user_id=second_user["id"], status="draft")
        resp = client.delete(f"/campaigns/{other_campaign['id']}/document")
        assert resp.status_code == 404


class TestCampaignResponseIncludesBrief:
    def test_get_campaign_includes_product_fields(self, client, test_user, mock_upstreams):
        campaign = insert_campaign(user_id=test_user["id"], status="draft")
        client.post(
            f"/campaigns/{campaign['id']}/document",
            files={"file": ("x.pdf", io.BytesIO(_fake_pdf_bytes()), "application/pdf")},
        )

        resp = client.get(f"/campaigns/{campaign['id']}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["product_document_name"] == "x.pdf"
        assert data["product_context"] is not None

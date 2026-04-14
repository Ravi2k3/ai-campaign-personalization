"""
Test script for pymupdf4llm PDF extraction quality.
Run manually: python test_pdf_extraction.py <path_to_pdf>

Tests:
1. Raw markdown extraction (structure, tables, headings)
2. Token count estimation
3. LLM summarization (optional, requires GROQ API key in .env)
"""

import sys
import os
import time

def extract_pdf(pdf_path: str) -> str:
    """Extract PDF to markdown using pymupdf4llm."""
    import pymupdf4llm

    start = time.time()
    md_text = pymupdf4llm.to_markdown(pdf_path)
    elapsed = time.time() - start

    print(f"\n{'='*60}")
    print(f"PDF: {os.path.basename(pdf_path)}")
    print(f"Extraction time: {elapsed:.2f}s")
    print(f"Character count: {len(md_text):,}")
    print(f"Estimated tokens: ~{len(md_text) // 4:,}")
    print(f"{'='*60}\n")

    return md_text


def show_preview(md_text: str, lines: int = 80) -> None:
    """Print first N lines of extracted markdown."""
    preview = "\n".join(md_text.splitlines()[:lines])
    print("── EXTRACTED MARKDOWN (first 80 lines) ──\n")
    print(preview)
    print(f"\n── END PREVIEW ({len(md_text.splitlines())} total lines) ──\n")


def save_output(md_text: str, pdf_path: str) -> str:
    """Save extracted markdown to a .md file next to the PDF."""
    output_path = os.path.splitext(pdf_path)[0] + "_extracted.md"
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(md_text)
    print(f"Full extraction saved to: {output_path}")
    return output_path


def test_summarization(md_text: str) -> None:
    """Test LLM summarization of the extracted text (requires .env with Groq key)."""
    try:
        from dotenv import load_dotenv
        load_dotenv()

        api_key = os.getenv("LLM_API_KEY")
        if not api_key:
            print("Skipping summarization: LLM_API_KEY not set in .env")
            return

        import httpx

        # Truncate to ~8000 tokens worth of text for the summary prompt
        max_chars = 32000
        text_for_summary = md_text[:max_chars]
        if len(md_text) > max_chars:
            text_for_summary += f"\n\n[... truncated, {len(md_text) - max_chars:,} more characters ...]"

        prompt = f"""Summarize this product/company document into a concise brief (300-500 words)
that an email copywriter could use to write personalized outreach emails.
Focus on: what the product/service is, key features and benefits, target audience,
and any specific details that would be useful for personalization.

DOCUMENT:
{text_for_summary}

SUMMARY:"""

        print("\n── LLM SUMMARY ──\n")
        print("Generating summary via Groq...")

        response = httpx.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": os.getenv("LLM_MODEL", "llama-3.3-70b-versatile"),
                "messages": [{"role": "user", "content": prompt}],
                "temperature": 0.3,
                "max_tokens": 1000,
            },
            timeout=30,
        )

        if response.status_code == 200:
            summary = response.json()["choices"][0]["message"]["content"]
            print(summary)
            print(f"\n── END SUMMARY ({len(summary)} chars, ~{len(summary)//4} tokens) ──")
        else:
            print(f"Groq API error: {response.status_code} {response.text}")

    except ImportError as e:
        print(f"Skipping summarization: missing dependency ({e})")
    except Exception as e:
        print(f"Summarization failed: {e}")


def main():
    if len(sys.argv) < 2:
        print("Usage: python test_pdf_extraction.py <path_to_pdf> [--summarize]")
        print("\nOptions:")
        print("  --summarize    Also test LLM summarization (needs LLM_API_KEY in .env)")
        sys.exit(1)

    pdf_path = sys.argv[1]
    do_summarize = "--summarize" in sys.argv

    if not os.path.exists(pdf_path):
        print(f"File not found: {pdf_path}")
        sys.exit(1)

    # Extract
    md_text = extract_pdf(pdf_path)

    # Preview
    show_preview(md_text)

    # Save
    save_output(md_text, pdf_path)

    # Summarize
    if do_summarize:
        test_summarization(md_text)
    else:
        print("Tip: Add --summarize flag to test LLM summarization")


if __name__ == "__main__":
    main()

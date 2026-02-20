---
title: Process documents with vision models using page ranges to avoid context overflow
impact: HIGH
impactDescription: "Processing large PDFs without page ranges causes timeouts or context overflow — incremental processing required"
tags: vision, document, pdf, ocr, chart, diagram, table
---

## Vision Document Understanding

Extract structured data from documents, charts, and PDFs using vision models.

**Incorrect — sending entire large PDF at once:**
```python
# Exceeds context window or times out on 100+ page PDFs
response = model.generate_content([genai.upload_file("large_doc.pdf"), "Summarize this"])
```

**Correct — incremental PDF processing:**
```python
# Claude Code Read tool with page ranges (max 20 pages per request)
Read(file_path="/path/to/document.pdf", pages="1-5")    # TOC/structure scan
Read(file_path="/path/to/document.pdf", pages="45-55")   # Target section
Read(file_path="/path/to/document.pdf", pages="80-90")   # Appendix
```

**Chart/diagram analysis — use high detail and explicit extraction prompt:**
```python
response = client.chat.completions.create(
    model="gpt-5.2",
    max_tokens=4096,
    messages=[{
        "role": "user",
        "content": [
            {"type": "text", "text": (
                "Extract all data from this chart. Return as structured JSON with:\n"
                "1. Chart type (bar, line, pie, etc.)\n"
                "2. Axis labels and units\n"
                "3. All data points with values\n"
                "4. Title and legend entries"
            )},
            {"type": "image_url", "image_url": {
                "url": f"data:{mime_type};base64,{base64_data}",
                "detail": "high"  # Required for chart OCR accuracy
            }}
        ]
    }]
)
```

**Key rules:**
- For PDFs >10 pages, always use page ranges — never send all at once
- Max 20 pages per Read request in Claude Code
- Use `detail: "high"` for documents with small text, tables, or charts
- Gemini 2.5 Pro handles longest documents (1M+ context)
- Always validate extracted numbers against source when accuracy is critical
- Claude supports up to 100 images per request (useful for multi-page document analysis)

**PDF constraints:**

| Constraint | Value |
|------------|-------|
| Max pages per request | 20 |
| Max file size | 20MB |
| Large PDF threshold | >10 pages |

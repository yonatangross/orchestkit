# Document Vision Analysis

Patterns for analyzing PDFs, charts, diagrams, and scanned documents using vision models.

## Best Model Selection

| Document Type | Best Model | Why |
|--------------|------------|-----|
| Long PDFs (50+ pages) | Gemini 2.5 Pro | 1M+ context window |
| Complex charts | Claude Opus 4.5 | Best visual reasoning |
| Forms/tables | GPT-5 | Structured extraction |
| Scanned documents | Any with high detail | OCR quality similar |

## PDF Processing Pipeline

```python
from pdf2image import convert_from_path
import anthropic

client = anthropic.Anthropic()

async def analyze_pdf(
    pdf_path: str,
    questions: list[str],
    max_pages: int = 20
) -> dict:
    """Analyze PDF document with vision model."""
    # Convert PDF to images (150 DPI for balance)
    pages = convert_from_path(pdf_path, dpi=150)

    results = {}

    for i, page in enumerate(pages[:max_pages]):
        # Save as PNG (better quality than JPEG for text)
        temp_path = f"/tmp/page_{i}.png"
        page.save(temp_path, "PNG")

        # Encode for API
        base64_data, media_type = encode_image_base64(temp_path)

        # Analyze with Claude
        response = client.messages.create(
            model="claude-opus-4-5-20251124",
            max_tokens=4096,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image",
                        "source": {
                            "type": "base64",
                            "media_type": media_type,
                            "data": base64_data
                        }
                    },
                    {
                        "type": "text",
                        "text": f"Analyze this document page and answer:\n" +
                               "\n".join(f"- {q}" for q in questions)
                    }
                ]
            }]
        )

        results[f"page_{i}"] = response.content[0].text

    return results
```

## Chart Analysis

```python
async def analyze_chart(image_path: str) -> dict:
    """Extract data and insights from charts/graphs."""
    prompt = """Analyze this chart and provide:
1. Chart type (bar, line, pie, scatter, etc.)
2. Title and axis labels
3. All data points with values
4. Key trends or insights
5. Any anomalies or notable patterns

Format as JSON:
{
    "chart_type": "...",
    "title": "...",
    "x_axis": "...",
    "y_axis": "...",
    "data_points": [...],
    "insights": [...]
}"""

    response = await analyze_image_claude(image_path, prompt)
    return json.loads(response)
```

## Table Extraction

```python
async def extract_table(image_path: str) -> list[dict]:
    """Extract structured table data from image."""
    prompt = """Extract all data from this table.
Return as JSON array where each row is an object.
Use column headers as keys.
Handle merged cells appropriately.

Example output:
[
    {"Column1": "value1", "Column2": "value2"},
    {"Column1": "value3", "Column2": "value4"}
]"""

    response = await analyze_image_claude(image_path, prompt)
    return json.loads(response)
```

## Multi-Page Document Context

```python
async def analyze_multipage_document(
    images: list[str],
    question: str
) -> str:
    """Analyze document across multiple pages with context."""
    # Use Gemini for long context
    import google.generativeai as genai

    model = genai.GenerativeModel("gemini-2.5-pro")

    content = [Image.open(img) for img in images]
    content.append(
        f"This is a multi-page document. "
        f"Analyze all pages together and answer: {question}"
    )

    response = model.generate_content(content)
    return response.text
```

## Quality Tips

1. **DPI Selection**: Use 150 DPI for documents, 300 for detailed diagrams
2. **Page ordering**: Place images before questions in the prompt
3. **Chunking**: For >20 pages, summarize sections first
4. **Validation**: Cross-reference extracted numbers with source
5. **Fallback**: Use OCR libraries (Tesseract) for pure text extraction

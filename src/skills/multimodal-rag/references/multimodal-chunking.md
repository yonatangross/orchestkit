# Multimodal Document Chunking

Strategies for chunking documents that contain text, images, tables, and charts.

## Chunking Approaches

| Approach | Pros | Cons | Best For |
|----------|------|------|----------|
| **Page-based** | Simple, preserves layout | Arbitrary splits | Scanned docs |
| **Semantic** | Context-aware | Complex implementation | Text-heavy docs |
| **Element-based** | Preserves structure | Requires parsing | Structured docs |
| **Hybrid** | Best accuracy | Most complex | Production systems |

## Element-Based Chunking

```python
from dataclasses import dataclass
from typing import Literal, Optional
import fitz  # PyMuPDF

@dataclass
class DocumentChunk:
    content: str
    chunk_type: Literal["text", "image", "table", "chart", "heading"]
    page: int
    bbox: Optional[tuple] = None  # (x0, y0, x1, y1)
    image_path: Optional[str] = None
    metadata: Optional[dict] = None

def extract_document_elements(pdf_path: str) -> list[DocumentChunk]:
    """Extract structured elements from PDF."""
    doc = fitz.open(pdf_path)
    chunks = []

    for page_num, page in enumerate(doc):
        # Get text blocks with positions
        blocks = page.get_text("dict")["blocks"]

        for block in blocks:
            if block["type"] == 0:  # Text block
                text = ""
                for line in block["lines"]:
                    for span in line["spans"]:
                        text += span["text"]
                    text += "\n"

                if text.strip():
                    # Detect if heading based on font size
                    avg_size = sum(
                        span["size"] for line in block["lines"]
                        for span in line["spans"]
                    ) / max(1, sum(len(line["spans"]) for line in block["lines"]))

                    chunk_type = "heading" if avg_size > 14 else "text"

                    chunks.append(DocumentChunk(
                        content=text.strip(),
                        chunk_type=chunk_type,
                        page=page_num,
                        bbox=tuple(block["bbox"])
                    ))

            elif block["type"] == 1:  # Image block
                xref = block.get("xref")
                if xref:
                    img = doc.extract_image(xref)
                    img_path = f"/tmp/page{page_num}_img{xref}.{img['ext']}"
                    with open(img_path, "wb") as f:
                        f.write(img["image"])

                    chunks.append(DocumentChunk(
                        content="",  # Will be captioned
                        chunk_type="image",
                        page=page_num,
                        bbox=tuple(block["bbox"]),
                        image_path=img_path
                    ))

    doc.close()
    return chunks
```

## Table Detection and Extraction

```python
import camelot
import pandas as pd

def extract_tables(pdf_path: str, pages: str = "all") -> list[DocumentChunk]:
    """Extract tables from PDF with structure preserved."""
    tables = camelot.read_pdf(pdf_path, pages=pages, flavor="lattice")
    chunks = []

    for i, table in enumerate(tables):
        df = table.df

        # Convert to markdown for LLM consumption
        markdown_table = df.to_markdown(index=False)

        # Also keep structured data
        chunks.append(DocumentChunk(
            content=markdown_table,
            chunk_type="table",
            page=table.page - 1,  # 0-indexed
            metadata={
                "rows": len(df),
                "cols": len(df.columns),
                "headers": list(df.iloc[0]) if len(df) > 0 else [],
                "data": df.to_dict(orient="records")
            }
        ))

    return chunks
```

## Image Captioning for Chunks

```python
async def caption_image_chunks(
    chunks: list[DocumentChunk],
    model: str = "claude-sonnet-4-5"
) -> list[DocumentChunk]:
    """Generate captions for image chunks."""
    captioned = []

    for chunk in chunks:
        if chunk.chunk_type == "image" and chunk.image_path:
            # Generate detailed caption for indexing
            caption = await generate_search_caption(chunk.image_path)

            # Detect if chart/diagram
            chart_type = await detect_chart_type(chunk.image_path)

            chunk.content = caption
            chunk.metadata = chunk.metadata or {}
            chunk.metadata["chart_type"] = chart_type

            if chart_type != "none":
                chunk.chunk_type = "chart"

        captioned.append(chunk)

    return captioned

async def detect_chart_type(image_path: str) -> str:
    """Detect if image is a chart and what type."""
    prompt = """Is this image a chart, graph, or diagram?
If yes, identify the type: bar_chart, line_chart, pie_chart, scatter_plot,
flowchart, diagram, table, or other.
If not a chart, respond with: none

Respond with just the type name."""

    response = await analyze_image_claude(image_path, prompt)
    return response.strip().lower()
```

## Semantic Chunking with Overlap

```python
from langchain.text_splitter import RecursiveCharacterTextSplitter

def semantic_chunk_text(
    text: str,
    chunk_size: int = 1000,
    chunk_overlap: int = 200
) -> list[str]:
    """Chunk text with semantic boundaries."""
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
        length_function=len
    )

    return splitter.split_text(text)
```

## Hybrid Chunking Pipeline

```python
async def chunk_multimodal_document(
    pdf_path: str,
    chunk_size: int = 1000
) -> list[DocumentChunk]:
    """Full pipeline for multimodal document chunking."""
    # Step 1: Extract raw elements
    elements = extract_document_elements(pdf_path)

    # Step 2: Extract tables separately (better quality)
    tables = extract_tables(pdf_path)

    # Step 3: Caption images
    elements = await caption_image_chunks(elements)

    # Step 4: Group adjacent text blocks
    grouped = group_adjacent_text(elements)

    # Step 5: Split large text chunks semantically
    final_chunks = []
    for chunk in grouped:
        if chunk.chunk_type == "text" and len(chunk.content) > chunk_size:
            # Split large text
            sub_texts = semantic_chunk_text(chunk.content, chunk_size)
            for i, text in enumerate(sub_texts):
                final_chunks.append(DocumentChunk(
                    content=text,
                    chunk_type="text",
                    page=chunk.page,
                    metadata={"sub_chunk": i}
                ))
        else:
            final_chunks.append(chunk)

    # Step 6: Add tables
    final_chunks.extend(tables)

    # Step 7: Sort by page and position
    final_chunks.sort(key=lambda c: (c.page, c.bbox[1] if c.bbox else 0))

    return final_chunks

def group_adjacent_text(chunks: list[DocumentChunk]) -> list[DocumentChunk]:
    """Merge adjacent text blocks on same page."""
    if not chunks:
        return []

    grouped = []
    current = chunks[0]

    for chunk in chunks[1:]:
        if (chunk.chunk_type == "text" and
            current.chunk_type == "text" and
            chunk.page == current.page):
            # Merge
            current.content += "\n\n" + chunk.content
        else:
            grouped.append(current)
            current = chunk

    grouped.append(current)
    return grouped
```

## Embedding Chunks

```python
async def embed_document_chunks(
    chunks: list[DocumentChunk],
    embedder: CLIPEmbedder
) -> list[DocumentChunk]:
    """Generate embeddings for all chunks."""
    for chunk in chunks:
        if chunk.chunk_type == "image" and chunk.image_path:
            # Image embedding
            chunk.embedding = embedder.embed_image(chunk.image_path)
        else:
            # Text embedding
            chunk.embedding = embedder.embed_text(chunk.content)

    return chunks
```

## Best Practices

1. **Preserve context**: Keep headings with following text
2. **Caption all images**: Essential for text-based retrieval
3. **Structure tables**: Use markdown or JSON, not just text
4. **Overlap chunks**: 10-20% overlap for context continuity
5. **Track positions**: Store page/bbox for source citation
6. **Validate chunks**: Check for empty or too-short chunks
7. **Batch embedding**: Process chunks in batches for efficiency

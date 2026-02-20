---
title: Chunk multimodal documents to preserve relationships between text, images, and tables
impact: MEDIUM
impactDescription: "Standard text chunking loses images, tables, and charts — multimodal chunking preserves mixed content relationships"
tags: multimodal, chunking, pdf, images, tables
---

## Multimodal Document Chunking

Chunk PDFs preserving images, tables, and text relationships.

**Multimodal Chunks:**
```python
from dataclasses import dataclass
from typing import Literal, Optional

@dataclass
class Chunk:
    content: str
    chunk_type: Literal["text", "image", "table", "chart"]
    page: int
    image_path: Optional[str] = None
    embedding: Optional[list[float]] = None

def chunk_multimodal_document(pdf_path: str) -> list[Chunk]:
    import fitz  # PyMuPDF
    doc = fitz.open(pdf_path)
    chunks = []

    for page_num, page in enumerate(doc):
        text_blocks = page.get_text("blocks")
        current_text = ""

        for block in text_blocks:
            if block[6] == 0:  # Text block
                current_text += block[4] + "\n"
            else:  # Image block
                if current_text.strip():
                    chunks.append(Chunk(content=current_text.strip(), chunk_type="text", page=page_num))
                    current_text = ""
                xref = block[7]
                img = doc.extract_image(xref)
                img_path = f"/tmp/page{page_num}_img{xref}.{img['ext']}"
                with open(img_path, "wb") as f:
                    f.write(img["image"])
                caption = generate_image_caption(img_path)
                chunks.append(Chunk(content=caption, chunk_type="image", page=page_num, image_path=img_path))

        if current_text.strip():
            chunks.append(Chunk(content=current_text.strip(), chunk_type="text", page=page_num))

    return chunks
```

**Incorrect — text-only chunking, loses images and tables:**
```python
def chunk_pdf(pdf_path: str) -> list[str]:
    import fitz
    doc = fitz.open(pdf_path)
    chunks = []
    for page in doc:
        chunks.append(page.get_text())  # Text only, images lost!
    return chunks
```

**Correct — multimodal chunking with images and captions:**
```python
def chunk_multimodal_document(pdf_path: str) -> list[Chunk]:
    import fitz
    doc = fitz.open(pdf_path)
    chunks = []

    for page_num, page in enumerate(doc):
        text_blocks = page.get_text("blocks")
        for block in text_blocks:
            if block[6] == 0:  # Text block
                chunks.append(Chunk(content=block[4], chunk_type="text", page=page_num))
            else:  # Image block
                xref = block[7]
                img = doc.extract_image(xref)
                img_path = f"/tmp/page{page_num}_img{xref}.{img['ext']}"
                with open(img_path, "wb") as f:
                    f.write(img["image"])
                caption = generate_image_caption(img_path)
                chunks.append(Chunk(content=caption, chunk_type="image", page=page_num, image_path=img_path))

    return chunks
```

**Key rules:**
- Extract images separately and generate captions for text-based search
- Preserve page numbers for citation and navigation
- Use PyMuPDF (fitz) for reliable PDF extraction
- Process large PDFs in page-range batches (CC 2.1.30: max 20 pages per Read)
- Always store image paths alongside embeddings for result display

# Multimodal RAG Checklist

## Embedding Models

- [ ] CLIP ViT-L/14 setup
- [ ] SigLIP 2 for scale
- [ ] Voyage multimodal-3 for long docs
- [ ] L2 normalize embeddings
- [ ] Batch embedding support

## Image Processing

- [ ] Generate image captions
- [ ] Store image URLs/paths
- [ ] Handle multiple image formats
- [ ] Resize for embedding

## Document Chunking

- [ ] Extract text blocks
- [ ] Extract images
- [ ] Extract tables
- [ ] Preserve page/position info
- [ ] Caption charts/diagrams

## Vector Database

- [ ] Schema with metadata fields
- [ ] HNSW index for similarity
- [ ] Hybrid text+image search
- [ ] Document deduplication
- [ ] Metadata filtering

## Retrieval Pipeline

- [ ] Text query embedding
- [ ] Image query embedding
- [ ] Cross-modal search
- [ ] Result reranking
- [ ] Top-k selection

## Generation

- [ ] Pass images to VLM
- [ ] Include text context
- [ ] Source attribution
- [ ] Hallucination detection

## Error Handling

- [ ] Handle missing images
- [ ] Validate embeddings
- [ ] Database connection errors
- [ ] Empty result handling

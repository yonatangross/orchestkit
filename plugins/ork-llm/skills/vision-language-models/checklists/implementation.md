# Vision Language Models Checklist

## Image Input

- [ ] Support base64 encoding
- [ ] Support URL-based images
- [ ] Validate image format (PNG, JPEG, WebP)
- [ ] Resize images to max 2048px
- [ ] Set appropriate detail level (low/high/auto)

## Provider Integration

- [ ] OpenAI GPT-5/4o integration
- [ ] Claude 4.5 integration
- [ ] Gemini 2.5/3 integration
- [ ] Grok 4 integration (if needed)
- [ ] Provider fallback chain

## Multi-Image

- [ ] Handle up to 10 images (OpenAI)
- [ ] Handle up to 100 images (Claude)
- [ ] Handle batch image analysis
- [ ] Implement image comparison

## Document Analysis

- [ ] PDF to image conversion
- [ ] Chart/graph data extraction
- [ ] Table extraction
- [ ] OCR for scanned documents

## Cost Optimization

- [ ] Use low detail for classification
- [ ] Use high detail for OCR/charts
- [ ] Batch requests when possible
- [ ] Cache analysis results
- [ ] Use mini models for simple tasks

## Error Handling

- [ ] Handle oversized images
- [ ] Handle unsupported formats
- [ ] Validate API responses
- [ ] Set max_tokens for vision
- [ ] Handle rate limits

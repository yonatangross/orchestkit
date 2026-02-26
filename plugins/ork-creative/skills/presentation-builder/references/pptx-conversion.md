# PPT/PPTX Conversion

When converting PowerPoint files to HTML presentations.

## Step 1: Extract Content

Use Python with `python-pptx` to extract slides, text, and images:

```python
from pptx import Presentation
from pptx.util import Inches, Pt
import json
import os
import base64

def extract_pptx(file_path, output_dir):
    """Extract all content from a PowerPoint file."""
    prs = Presentation(file_path)
    slides_data = []

    assets_dir = os.path.join(output_dir, 'assets')
    os.makedirs(assets_dir, exist_ok=True)

    for slide_num, slide in enumerate(prs.slides):
        slide_data = {
            'number': slide_num + 1,
            'title': '',
            'content': [],
            'images': [],
            'notes': ''
        }

        for shape in slide.shapes:
            if shape.has_text_frame:
                if shape == slide.shapes.title:
                    slide_data['title'] = shape.text
                else:
                    slide_data['content'].append({
                        'type': 'text',
                        'content': shape.text
                    })

            if shape.shape_type == 13:  # Picture
                image = shape.image
                image_bytes = image.blob
                image_ext = image.ext
                image_name = f"slide{slide_num + 1}_img{len(slide_data['images']) + 1}.{image_ext}"
                image_path = os.path.join(assets_dir, image_name)

                with open(image_path, 'wb') as f:
                    f.write(image_bytes)

                slide_data['images'].append({
                    'path': f"assets/{image_name}",
                    'width': shape.width,
                    'height': shape.height
                })

        if slide.has_notes_slide:
            notes_frame = slide.notes_slide.notes_text_frame
            slide_data['notes'] = notes_frame.text

        slides_data.append(slide_data)

    return slides_data
```

## Step 2: Confirm Content Structure

Present extracted content to user for verification:

```
I've extracted the following from your PowerPoint:

Slide 1: [Title]
- [Content summary]
- Images: [count]

Slide 2: [Title]
...

All images saved to assets folder. Does this look correct?
```

## Step 3: Style Selection

Proceed to Phase 2 (Style Discovery) in the main workflow with the extracted content in mind.

## Step 4: Generate HTML

Convert extracted content into the chosen style, preserving:
- All text content and slide order
- All images (referenced from assets/ folder)
- Speaker notes as HTML comments or separate file

## Notes

- `python-pptx` must be installed: `pip install python-pptx`
- Images are extracted as-is (no re-encoding)
- Complex shapes (SmartArt, charts) may need manual recreation
- Grouped shapes are flattened -- check output for missing content

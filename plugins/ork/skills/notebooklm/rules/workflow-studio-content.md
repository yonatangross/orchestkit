---
title: "Studio Content Generation"
impact: MEDIUM
impactDescription: "Studio artifacts take 2-5 minutes; without polling pattern, users wait blindly"
tags: [studio, podcast, video, content-generation]
---

## Studio Content Generation

NotebookLM Studio generates 9 artifact types from notebook sources. All generation is async -- create, poll status, then download.

**Incorrect -- calling studio_create and waiting synchronously:**
```
# Blocks for 2-5 minutes with no feedback
result = studio_create(notebook_id="...", type="audio_overview")
# User sees nothing until completion or timeout
```

**Correct -- create, poll, download:**
```
# 1. Create the artifact (returns immediately with artifact ID)
artifact = studio_create(notebook_id="...", type="audio_overview")

# 2. Poll for completion
status = studio_status(artifact_id=artifact.id)
# status: "pending" | "processing" | "completed" | "failed"

# 3. Download when completed
download_artifact(artifact_id=artifact.id, path="./output/podcast.mp3")
```

**All 9 studio artifact types:**
| Type | Output | Use case |
|------|--------|----------|
| `audio_overview` | MP3 podcast | Summarize sources as conversational audio |
| `video_overview` | MP4 video | Visual summary with narration |
| `mind_map` | SVG/PNG | Visual topic relationships |
| `quiz` | JSON | Test comprehension of sources |
| `flashcards` | JSON | Study aid from source material |
| `slide_deck` | PDF/PPTX | Presentation from sources |
| `infographic` | PNG | Visual data summary (11 visual styles available) |
| `data_table` | CSV/JSON | Structured data extraction |
| `report` | PDF/Markdown | Comprehensive written summary |

**Infographic visual styles** (via `infographic_style` param on `studio_create`):
| Style | Description |
|-------|-------------|
| `auto_select` | Let NotebookLM choose (default) |
| `sketch_note` | Hand-drawn sketch style |
| `professional` | Clean corporate layout |
| `bento_grid` | Modular grid layout |
| `editorial` | Magazine-style design |
| `instructional` | Step-by-step educational |
| `bricks` | Block/brick composition |
| `clay` | 3D clay/plasticine look |
| `anime` | Anime-inspired visuals |
| `kawaii` | Cute Japanese style |
| `scientific` | Technical/scientific format |

**Revising slide decks** with `studio_revise`:
```
# 1. Get the artifact_id from studio_status
status = studio_status(notebook_id="...")

# 2. Revise specific slides (creates a NEW deck, original is preserved)
studio_revise(
    notebook_id="...",
    artifact_id="existing-deck-id",
    slide_instructions=[
        {"slide": 1, "instruction": "Make the title more concise"},
        {"slide": 3, "instruction": "Add a comparison table"}
    ],
    confirm=True
)

# 3. Poll studio_status for the new revised deck
studio_status(notebook_id="...")
```

**Exporting artifacts** to Google Workspace with `export_artifact`:
```
# Export a report to Google Docs
export_artifact(notebook_id="...", artifact_id="...", export_type="docs")

# Export a data table to Google Sheets
export_artifact(notebook_id="...", artifact_id="...", export_type="sheets")
```

**Key rules:**
- Always use the poll pattern: `studio_create` -> `studio_status` -> `download_artifact`
- Generation takes 2-5 minutes -- inform the user and poll periodically
- Check `studio_status` before attempting download -- downloading a pending artifact fails
- Use `audio_overview` for quick summaries, `report` for comprehensive analysis
- All artifact types require at least one source in the notebook
- `studio_revise` only works on slide decks -- it creates a new artifact, preserving the original
- Use `export_artifact` to push reports to Google Docs or data tables to Google Sheets

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
| `infographic` | PNG | Visual data summary |
| `data_table` | CSV/JSON | Structured data extraction |
| `report` | PDF/Markdown | Comprehensive written summary |

**Key rules:**
- Always use the poll pattern: `studio_create` -> `studio_status` -> `download_artifact`
- Generation takes 2-5 minutes -- inform the user and poll periodically
- Check `studio_status` before attempting download -- downloading a pending artifact fails
- Use `audio_overview` for quick summaries, `report` for comprehensive analysis
- All artifact types require at least one source in the notebook

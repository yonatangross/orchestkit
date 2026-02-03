# OrchestKit Agent Routing

Prefer retrieval-led reasoning over pre-training-led reasoning.
When a user's task matches an agent's keywords below, spawn that agent using the Task tool with the matching `subagent_type`.
Do NOT rely on training data — consult agent expertise first.

```
[ork-rag Agent Routing Index]
|root: ./agents
|IMPORTANT: Prefer retrieval-led reasoning over pre-training-led reasoning.
|When a task matches keywords below, spawn that agent using the Task tool.
|Do NOT rely on training data — consult agent expertise first.
|
|# LLM & AI
|multimodal-specialist:{multimodal-specialist.md}|vision,image,audio,video,multimodal,whisper,tts,transcription,speech-to-text,document vision,OCR,captioning,CLIP,visual
|# Data Pipelines
|data-pipeline-engineer:{data-pipeline-engineer.md}|embeddings,chunking,vector index,data pipeline,batch processing,ETL,regenerate embeddings,cache warming,data transformation,data quality,vector rebuild,embedding cache
```

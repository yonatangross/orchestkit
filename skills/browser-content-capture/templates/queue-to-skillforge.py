"""
Queue Captured Content to SkillForge

After capturing content with browser automation, send it to SkillForge's
analysis pipeline using this integration template.
"""

import asyncio
from dataclasses import dataclass
from typing import Optional
import httpx


@dataclass
class AnalysisRequest:
    """Request to queue content for SkillForge analysis."""
    url: str
    content: str
    title: Optional[str] = None
    source: str = "browser_capture"


@dataclass
class AnalysisResponse:
    """Response from SkillForge analysis API."""
    analysis_id: str
    status: str
    sse_url: str


class SkillForgeClient:
    """
    Client for sending captured content to SkillForge analysis pipeline.

    Usage:
        client = SkillForgeClient()

        # Queue single content
        result = await client.queue_for_analysis(
            url="https://docs.example.com/guide",
            content="Captured content here..."
        )

        # Monitor progress
        async for event in client.stream_progress(result.analysis_id):
            print(f"Progress: {event}")
    """

    def __init__(
        self,
        base_url: str = "http://localhost:8500",
        timeout: float = 30.0
    ):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout

    async def queue_for_analysis(
        self,
        url: str,
        content: str,
        title: Optional[str] = None
    ) -> AnalysisResponse:
        """
        Queue captured content for SkillForge analysis.

        Args:
            url: Original source URL
            content: Captured content text
            title: Optional title (extracted from page)

        Returns:
            AnalysisResponse with analysis_id for tracking
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                f"{self.base_url}/api/v1/analyze",
                json={
                    "url": url,
                    "content_override": content,  # Skip scraping
                    "title": title,
                    "source": "browser_capture",
                    "metadata": {
                        "capture_method": "playwright_mcp",
                        "content_length": len(content)
                    }
                }
            )
            response.raise_for_status()
            data = response.json()

            return AnalysisResponse(
                analysis_id=data["analysis_id"],
                status=data.get("status", "queued"),
                sse_url=f"{self.base_url}/api/v1/analyses/{data['analysis_id']}/events"
            )

    async def stream_progress(self, analysis_id: str):
        """
        Stream analysis progress via SSE.

        Yields:
            Progress events from the analysis pipeline
        """
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "GET",
                f"{self.base_url}/api/v1/analyses/{analysis_id}/events",
                headers={"Accept": "text/event-stream"}
            ) as response:
                async for line in response.aiter_lines():
                    if line.startswith("data:"):
                        import json
                        event = json.loads(line[5:].strip())
                        yield event

                        # Stop on completion
                        if event.get("status") in ["completed", "failed"]:
                            break

    async def get_analysis_result(self, analysis_id: str) -> dict:
        """
        Get completed analysis result.

        Args:
            analysis_id: ID from queue_for_analysis

        Returns:
            Full analysis result with artifact
        """
        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.get(
                f"{self.base_url}/api/v1/analyses/{analysis_id}"
            )
            response.raise_for_status()
            return response.json()

    async def queue_batch(
        self,
        items: list[tuple[str, str, Optional[str]]]
    ) -> list[AnalysisResponse]:
        """
        Queue multiple captured contents for analysis.

        Args:
            items: List of (url, content, title) tuples

        Returns:
            List of AnalysisResponse for tracking
        """
        results = []

        for url, content, title in items:
            result = await self.queue_for_analysis(url, content, title)
            results.append(result)
            await asyncio.sleep(0.5)  # Rate limiting

        return results


# Example usage patterns:

async def example_single_capture():
    """Capture and queue a single page."""

    # Step 1: Capture content (using MCP tools)
    # mcp__playwright__browser_navigate(url="https://docs.example.com/guide")
    # mcp__playwright__browser_wait_for(selector=".content")
    # content = mcp__playwright__browser_evaluate(script="""
    #     return document.querySelector('.content').innerText;
    # """)

    # Placeholder for captured content
    url = "https://docs.example.com/guide"
    content = "Captured content from the page..."

    # Step 2: Queue for analysis
    client = SkillForgeClient()
    result = await client.queue_for_analysis(url=url, content=content)

    print(f"Queued analysis: {result.analysis_id}")

    # Step 3: Monitor progress
    async for event in client.stream_progress(result.analysis_id):
        status = event.get("status", "unknown")
        progress = event.get("progress", 0)
        print(f"Progress: {progress}% - {status}")

    # Step 4: Get final result
    analysis = await client.get_analysis_result(result.analysis_id)
    print(f"Analysis complete: {analysis.get('title')}")


async def example_batch_capture():
    """Capture and queue multiple pages."""

    # Captured content from multi-page crawl
    pages = [
        ("https://docs.example.com/intro", "Introduction content...", "Introduction"),
        ("https://docs.example.com/guide", "Guide content...", "User Guide"),
        ("https://docs.example.com/api", "API reference...", "API Reference"),
    ]

    client = SkillForgeClient()
    results = await client.queue_batch(pages)

    print(f"Queued {len(results)} pages for analysis")

    # Wait for all to complete
    for result in results:
        analysis = await client.get_analysis_result(result.analysis_id)
        print(f"Completed: {analysis.get('title')}")


async def example_with_browser_capture():
    """
    Full workflow: browser capture → SkillForge analysis.

    This shows the complete integration pattern.
    """
    from templates.capture_workflow import BrowserCaptureWorkflow

    # Step 1: Capture from browser
    workflow = BrowserCaptureWorkflow(content_selector=".docs-content")
    captured = await workflow.capture_page("https://docs.example.com/getting-started")

    if not captured.success:
        print(f"Capture failed: {captured.error}")
        return

    # Step 2: Queue for analysis
    client = SkillForgeClient()
    result = await client.queue_for_analysis(
        url=captured.url,
        content=captured.content,
        title=captured.title
    )

    # Step 3: Wait for completion
    async for event in client.stream_progress(result.analysis_id):
        if event.get("status") == "completed":
            break

    # Step 4: Get result
    analysis = await client.get_analysis_result(result.analysis_id)

    return {
        "source_url": captured.url,
        "analysis_id": result.analysis_id,
        "artifact": analysis.get("artifact")
    }


if __name__ == "__main__":
    asyncio.run(example_single_capture())

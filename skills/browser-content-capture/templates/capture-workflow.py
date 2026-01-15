"""
Browser Content Capture Workflow Template

Standard pattern for capturing content from web pages using Playwright MCP tools.
Customize selectors and extraction logic for your target site.
"""

from dataclasses import dataclass
from typing import Optional
import asyncio


@dataclass
class CaptureResult:
    """Result from a content capture operation."""
    url: str
    title: str
    content: str
    success: bool
    error: Optional[str] = None


class BrowserCaptureWorkflow:
    """
    Template for browser-based content capture.

    Usage:
        workflow = BrowserCaptureWorkflow()

        # Single page capture
        result = await workflow.capture_page("https://docs.example.com/guide")

        # Multi-page capture
        results = await workflow.capture_documentation("https://docs.example.com")
    """

    def __init__(
        self,
        content_selector: str = ".content, article, main",
        nav_selector: str = "nav a, .sidebar a",
        wait_timeout: int = 10000,
        delay_between_pages: float = 1.0
    ):
        self.content_selector = content_selector
        self.nav_selector = nav_selector
        self.wait_timeout = wait_timeout
        self.delay_between_pages = delay_between_pages

    async def capture_page(self, url: str) -> CaptureResult:
        """
        Capture content from a single page.

        Steps:
        1. Navigate to URL
        2. Wait for content to render
        3. Extract title and content
        4. Clean and return result
        """
        try:
            # 1. Navigate
            # mcp__playwright__browser_navigate(url=url)

            # 2. Wait for content
            # mcp__playwright__browser_wait_for(
            #     selector=self.content_selector,
            #     timeout=self.wait_timeout
            # )

            # 3. Extract content
            # data = mcp__playwright__browser_evaluate(script=f"""
            #     const content = document.querySelector('{self.content_selector}');
            #     const title = document.querySelector('h1')?.innerText ||
            #                   document.title;
            #     return {{
            #         title: title,
            #         content: content ? content.innerText : document.body.innerText,
            #         url: window.location.href
            #     }};
            # """)

            # Placeholder - replace with actual MCP calls
            data = {"title": "", "content": "", "url": url}

            return CaptureResult(
                url=data["url"],
                title=data["title"],
                content=self._clean_content(data["content"]),
                success=True
            )

        except Exception as e:
            return CaptureResult(
                url=url,
                title="",
                content="",
                success=False,
                error=str(e)
            )

    async def capture_documentation(self, base_url: str) -> list[CaptureResult]:
        """
        Capture all pages from a documentation site.

        Steps:
        1. Navigate to base URL
        2. Discover all navigation links
        3. Capture each page sequentially
        4. Return all results
        """
        results = []

        # Navigate to base
        # mcp__playwright__browser_navigate(url=base_url)
        # mcp__playwright__browser_wait_for(selector=self.nav_selector)

        # Discover links
        # links = mcp__playwright__browser_evaluate(script=f"""
        #     return Array.from(document.querySelectorAll('{self.nav_selector}'))
        #         .map(a => ({{ href: a.href, title: a.innerText.trim() }}))
        #         .filter(l => l.href && !l.href.includes('#'));
        # """)

        # Placeholder
        links = []

        for link in links:
            result = await self.capture_page(link["href"])
            results.append(result)
            await asyncio.sleep(self.delay_between_pages)

        return results

    def _clean_content(self, content: str) -> str:
        """Clean extracted content by removing extra whitespace."""
        import re
        # Normalize whitespace
        content = re.sub(r'\n\s*\n', '\n\n', content)
        content = re.sub(r' +', ' ', content)
        return content.strip()


# Example usage patterns:

async def example_single_page():
    """Capture a single documentation page."""
    workflow = BrowserCaptureWorkflow(
        content_selector=".markdown-body",  # GitHub-style
        wait_timeout=5000
    )

    result = await workflow.capture_page(
        "https://docs.example.com/getting-started"
    )

    if result.success:
        print(f"Captured: {result.title}")
        print(f"Content length: {len(result.content)} chars")
    else:
        print(f"Failed: {result.error}")


async def example_full_docs():
    """Capture entire documentation site."""
    workflow = BrowserCaptureWorkflow(
        content_selector="article",
        nav_selector=".docs-sidebar a",
        delay_between_pages=1.5  # Be polite
    )

    results = await workflow.capture_documentation(
        "https://docs.example.com"
    )

    successful = [r for r in results if r.success]
    failed = [r for r in results if not r.success]

    print(f"Captured {len(successful)} pages, {len(failed)} failed")


async def example_spa_capture():
    """Capture from a React/Vue SPA."""
    workflow = BrowserCaptureWorkflow(
        content_selector="#__next main",  # Next.js
        wait_timeout=15000  # SPAs need more time
    )

    # Add hydration wait before capture
    # mcp__playwright__browser_evaluate(script="""
    #     await new Promise(r => setTimeout(r, 2000));  // Wait for hydration
    # """)

    result = await workflow.capture_page(
        "https://nextjs-docs.example.com/guide"
    )
    return result

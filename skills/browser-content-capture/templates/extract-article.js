/**
 * Article Content Extractor
 *
 * JavaScript to run via browser_evaluate for clean article extraction.
 * Removes navigation, ads, and noise to get clean content.
 *
 * Usage:
 *   content = mcp__playwright__browser_evaluate(script=<this-file-contents>)
 */

(function extractArticle() {
  /**
   * Remove noise elements from the page
   */
  function removeNoise(doc) {
    const noiseSelectors = [
      // Navigation
      'nav', 'header', 'footer',
      '[role="navigation"]', '[role="banner"]',
      '.navbar', '.nav-bar', '.navigation',
      '.header', '.footer', '.site-header', '.site-footer',

      // Sidebars
      '.sidebar', '.side-bar', 'aside',
      '[role="complementary"]',
      '.table-of-contents', '.toc',

      // Ads and promotions
      '.ad', '.ads', '.advertisement',
      '[class*="sponsor"]', '[id*="sponsor"]',
      '.promo', '.promotion', '.cta',

      // Social and sharing
      '.share', '.social', '.sharing',
      '[class*="share-"]', '[class*="social-"]',

      // Comments
      '.comments', '#comments', '.disqus',

      // Cookie banners and modals
      '.cookie', '[class*="cookie"]',
      '.modal', '.popup', '.overlay',

      // Skip links and hidden content
      '.skip-link', '.sr-only',
      '[aria-hidden="true"]'
    ];

    noiseSelectors.forEach(sel => {
      doc.querySelectorAll(sel).forEach(el => el.remove());
    });
  }

  /**
   * Find the main content container
   */
  function findMainContent(doc) {
    // Priority order for content containers
    const contentSelectors = [
      // Semantic HTML5
      'main article',
      'article',
      'main',

      // Common content classes
      '.article-content',
      '.post-content',
      '.entry-content',
      '.content',
      '#content',

      // Documentation sites
      '.markdown-body',
      '.prose',
      '.documentation',
      '.docs-content',

      // Blog platforms
      '.blog-post',
      '.post-body',

      // Generic containers
      '[role="main"]',
      '#main',
      '.main'
    ];

    for (const sel of contentSelectors) {
      const el = doc.querySelector(sel);
      if (el && el.innerText.trim().length > 200) {
        return el;
      }
    }

    // Fallback: find largest text container
    return findLargestTextContainer(doc);
  }

  /**
   * Find the container with the most text content
   */
  function findLargestTextContainer(doc) {
    let maxLength = 0;
    let bestContainer = doc.body;

    doc.querySelectorAll('div, section, article').forEach(el => {
      const textLength = el.innerText.trim().length;
      const childCount = el.querySelectorAll('*').length;

      // Prefer elements with high text-to-child ratio
      const ratio = textLength / (childCount || 1);

      if (textLength > maxLength && ratio > 50) {
        maxLength = textLength;
        bestContainer = el;
      }
    });

    return bestContainer;
  }

  /**
   * Extract metadata from the page
   */
  function extractMetadata(doc) {
    const title =
      doc.querySelector('h1')?.innerText ||
      doc.querySelector('title')?.innerText ||
      doc.querySelector('[property="og:title"]')?.content ||
      'Untitled';

    const description =
      doc.querySelector('meta[name="description"]')?.content ||
      doc.querySelector('[property="og:description"]')?.content ||
      '';

    const author =
      doc.querySelector('[rel="author"]')?.innerText ||
      doc.querySelector('.author')?.innerText ||
      doc.querySelector('meta[name="author"]')?.content ||
      '';

    const publishDate =
      doc.querySelector('time')?.dateTime ||
      doc.querySelector('[property="article:published_time"]')?.content ||
      '';

    return { title, description, author, publishDate };
  }

  /**
   * Convert content to clean markdown-like text
   */
  function cleanContent(element) {
    // Clone to avoid modifying the page
    const clone = element.cloneNode(true);

    // Remove scripts and styles
    clone.querySelectorAll('script, style, noscript').forEach(el => el.remove());

    // Get text with preserved structure
    let text = clone.innerText;

    // Clean up whitespace
    text = text
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      .join('\n');

    // Collapse multiple newlines
    text = text.replace(/\n{3,}/g, '\n\n');

    return text;
  }

  /**
   * Extract code blocks separately
   */
  function extractCodeBlocks(element) {
    const codeBlocks = [];

    element.querySelectorAll('pre, code').forEach((el, index) => {
      if (el.tagName === 'PRE' || el.closest('pre')) {
        const code = el.innerText.trim();
        if (code.length > 20) {
          codeBlocks.push({
            index,
            language: el.className.match(/language-(\w+)/)?.[1] || 'text',
            code
          });
        }
      }
    });

    return codeBlocks;
  }

  // Main extraction logic
  const doc = document.cloneNode(true);

  // Remove noise
  removeNoise(doc);

  // Find main content
  const mainContent = findMainContent(doc);

  // Extract data
  const metadata = extractMetadata(document); // Use original for metadata
  const content = cleanContent(mainContent);
  const codeBlocks = extractCodeBlocks(mainContent);

  return {
    url: window.location.href,
    ...metadata,
    content,
    codeBlocks,
    wordCount: content.split(/\s+/).length,
    extractedAt: new Date().toISOString()
  };
})();

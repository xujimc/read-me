const debugHtml = `<div class="debug-btn" id="debug-clear">clear storage</div>`;

export function renderBlogView(contentEl, headerEl, tab, isTracked) {
  headerEl.textContent = 'Article View';
  contentEl.className = 'blog-view';

  if (!isTracked) {
    contentEl.innerHTML = `
      <div class="blog-title">${tab.title || 'Untitled'}</div>
      <div class="summary-card not-tracked">
        <div class="summary-label">Not Tracked</div>
        <div class="summary-text">This article is not in your feed. It may be older or from a different category.</div>
      </div>
    ` + debugHtml;
    return;
  }

  contentEl.innerHTML = `
    <div class="blog-title">${tab.title || 'Loading...'}</div>
    <div class="summary-card">
      <div class="summary-label">Summary</div>
      <div class="summary-text">Summary will appear here once connected to Gemini API.</div>
    </div>
  ` + debugHtml;
}

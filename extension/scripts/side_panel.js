import { renderBlogView } from './views/blog.js';
import { renderArticlesView } from './views/articles.js';

const contentEl = document.getElementById('content');
const headerEl = document.getElementById('header');

// ===== RENDER BASED ON TAB =====
async function render() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { storedArticles = [] } = await chrome.storage.sync.get(['storedArticles']);

  if (tab?.url) {
    const url = new URL(tab.url);
    if (url.hostname === 'blog.google') {
      const isTracked = storedArticles.some(a => a.link === tab.url);
      renderBlogView(contentEl, headerEl, tab, isTracked);
      return;
    }
  }

  // Default: articles view
  renderArticlesView(contentEl, headerEl, storedArticles);
}

// Initial render
render();

// Re-render when tab changes
chrome.tabs.onActivated.addListener(() => render());

// Re-render when tab URL/title updates
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url || info.title) render();
});

// Re-render when storage changes (for articles view)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.storedArticles) {
    render();
  }
});

// Debug: clear storage
contentEl.addEventListener('click', (e) => {
  if (e.target.id === 'debug-clear') {
    chrome.storage.sync.clear();
  }
});

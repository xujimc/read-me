import { renderBlogView } from './views/blog.js';
import { renderArticlesView } from './views/articles.js';
import { fetchModel } from './api.js';

const contentEl = document.getElementById('content');
const headerEl = document.getElementById('header');

// Fetch and display model info
async function updateModelIndicator() {
  const model = await fetchModel();
  let indicator = document.getElementById('model-indicator');

  if (!indicator) {
    indicator = document.createElement('div');
    indicator.id = 'model-indicator';
    headerEl.appendChild(indicator);
  }

  if (model) {
    indicator.textContent = model;
    indicator.className = 'model-badge connected';
  } else {
    indicator.textContent = 'offline';
    indicator.className = 'model-badge offline';
  }
}

// Update model on load
updateModelIndicator();

// ===== RENDER BASED ON TAB =====
async function render() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  const { storedArticles = [] } = await chrome.storage.sync.get(['storedArticles']);

  if (tab?.url) {
    const url = new URL(tab.url);
    if (url.hostname === 'blog.google') {
      const isTracked = storedArticles.some(a => a.link === tab.url);
      await renderBlogView(contentEl, headerEl, tab, isTracked);
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

// Re-render when tab URL updates (not title - fires too often)
chrome.tabs.onUpdated.addListener((tabId, info) => {
  if (info.url) render();
});

// Re-render when storage changes (for articles view)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.storedArticles) {
    render();
  }
});

// Debug: clear storage (both sync and local)
contentEl.addEventListener('click', (e) => {
  if (e.target.id === 'debug-clear') {
    chrome.storage.sync.clear();
    chrome.storage.local.clear();
  }
});

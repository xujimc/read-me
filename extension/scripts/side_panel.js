const contentEl = document.getElementById('content');
const headerEl = document.getElementById('header');

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

const debugHtml = `<div class="debug-btn" id="debug-clear">clear storage</div>`;

const ctaHtml = `
  <div class="card cta-card" id="cta-button">
    <div class="card-content cta-content">
      <div class="cta-text">View all articles</div>
      <svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M5 12h14M12 5l7 7-7 7"/>
      </svg>
    </div>
  </div>
`;

// ===== BLOG VIEW =====
function renderBlogView(tab) {
  headerEl.textContent = 'Article View';
  contentEl.className = 'blog-view';
  contentEl.innerHTML = `
    <div class="blog-title">${tab.title || 'Loading...'}</div>
    <div class="summary-card">
      <div class="summary-label">Summary</div>
      <div class="summary-text">Summary will appear here once connected to Gemini API.</div>
    </div>
  ` + debugHtml;
}

// ===== ARTICLES VIEW =====
function renderArticlesView(articles) {
  headerEl.textContent = 'The Keyword';
  contentEl.className = 'articles';

  const unopened = (articles || []).filter(a => !a.opened);
  if (unopened.length === 0) {
    contentEl.innerHTML = '<div class="empty">No new articles</div>' + ctaHtml + debugHtml;
    return;
  }

  contentEl.innerHTML = unopened.map(article => `
    <div class="card" data-link="${article.link}">
      ${article.image ? `<img class="card-image" src="${article.image}" alt="">` : ''}
      <div class="card-content">
        <div class="card-category"><span class="new-badge">New</span>${article.category}</div>
        <div class="card-title">${article.title}</div>
        <div class="card-meta">
          <span class="card-author">${article.author ? `By ${article.author} - ` : ''}${formatDate(article.pubDate)}</span>
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>
  `).join('') + ctaHtml + debugHtml;

  // Add click handlers for article cards
  document.querySelectorAll('.card[data-link]').forEach(card => {
    card.addEventListener('click', async () => {
      const link = card.dataset.link;
      if (link) {
        await chrome.tabs.create({ url: link });
        // Mark as opened
        const { storedArticles = [] } = await chrome.storage.sync.get(['storedArticles']);
        const article = storedArticles.find(a => a.link === link);
        if (article) {
          article.opened = true;
          await chrome.storage.sync.set({ storedArticles });
        }
      }
    });
  });
}

// ===== RENDER BASED ON TAB =====
async function render() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  if (tab?.url) {
    const url = new URL(tab.url);
    if (url.hostname === 'blog.google') {
      renderBlogView(tab);
      return;
    }
  }

  // Default: articles view
  const { storedArticles } = await chrome.storage.sync.get(['storedArticles']);
  renderArticlesView(storedArticles);
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

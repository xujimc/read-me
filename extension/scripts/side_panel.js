const articlesContainer = document.getElementById('articles');

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

function renderArticles(articles) {
  const unopened = (articles || []).filter(a => !a.opened);
  if (unopened.length === 0) {
    articlesContainer.innerHTML = '<div class="empty">No new articles</div>' + ctaHtml + debugHtml;
    return;
  }

  articlesContainer.innerHTML = unopened.map(article => `
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

  // Add click handlers
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', async () => {
      const link = card.dataset.link;
      if (link) {
        chrome.tabs.create({ url: link });
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

// Load articles from storage
chrome.storage.sync.get(['storedArticles'], (data) => {
  renderArticles(data.storedArticles);
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.storedArticles) {
    renderArticles(changes.storedArticles.newValue);
  }
});

// Debug: clear storage
articlesContainer.addEventListener('click', (e) => {
  if (e.target.id === 'debug-clear') {
    chrome.storage.sync.clear();
  }
});

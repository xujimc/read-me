const articlesContainer = document.getElementById('articles');

function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
}

function renderArticles(articles) {
  if (!articles || articles.length === 0) {
    articlesContainer.innerHTML = '<div class="empty">No articles found</div>';
    return;
  }

  articlesContainer.innerHTML = articles.map(article => `
    <div class="card" data-link="${article.link}">
      ${article.image ? `<img class="card-image" src="${article.image}" alt="">` : ''}
      <div class="card-content">
        <div class="card-category">${article.category}</div>
        <div class="card-title">${article.title}</div>
        <div class="card-meta">
          <span class="card-author">${article.author ? `By ${article.author} - ` : ''}${formatDate(article.pubDate)}</span>
          <svg class="card-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 12h14M12 5l7 7-7 7"/>
          </svg>
        </div>
      </div>
    </div>
  `).join('');

  // Add click handlers
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => {
      const link = card.dataset.link;
      if (link) chrome.tabs.create({ url: link });
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

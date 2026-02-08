const passagesContainer = document.getElementById('passages');
const clearBtn = document.getElementById('clearBtn');

let passages = [];

// Load saved passages on startup
chrome.storage.local.get(['savedPassages', 'currentPassage'], (data) => {
  passages = data.savedPassages || [];

  // If there's a new passage, add it
  if (data.currentPassage) {
    addPassage(data.currentPassage);
    // Clear current passage so it doesn't re-add on refresh
    chrome.storage.local.remove('currentPassage');
  }

  renderPassages();
});

// Listen for new passages
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.currentPassage && changes.currentPassage.newValue) {
    addPassage(changes.currentPassage.newValue);
    renderPassages();
    // Clear current passage
    chrome.storage.local.remove('currentPassage');
  }
});

function addPassage(passage) {
  // Avoid duplicates (same text)
  if (!passages.some(p => p.text === passage.text)) {
    passages.unshift(passage);
    savePassages();
  }
}

function savePassages() {
  chrome.storage.local.set({ savedPassages: passages });
}

function renderPassages() {
  if (passages.length === 0) {
    passagesContainer.innerHTML = `
      <div class="empty-state">
        Click on any paragraph in a blog article to save it here.
      </div>
    `;
    clearBtn.style.display = 'none';
    return;
  }

  clearBtn.style.display = 'block';

  passagesContainer.innerHTML = passages.map((p, i) => `
    <div class="passage-card ${i === 0 ? 'latest' : ''}">
      ${i === 0 ? '<span class="passage-badge">Latest</span>' : ''}
      <div class="passage-text">${escapeHtml(p.text.substring(0, 200))}${p.text.length > 200 ? '...' : ''}</div>
      <div class="passage-time">${formatTime(p.timestamp)}</div>
    </div>
  `).join('');
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(timestamp) {
  const diff = Date.now() - timestamp;
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return new Date(timestamp).toLocaleDateString();
}

clearBtn.addEventListener('click', () => {
  passages = [];
  savePassages();
  renderPassages();
});

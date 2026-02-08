// Side panel for blog.google pages

const titleEl = document.getElementById('title');
const summaryEl = document.getElementById('summary');

async function init() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.title && tab.title !== tab.url) {
    titleEl.textContent = tab.title;
  }
}

init();

// Update title when tab finishes loading
chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
  if (info.title) {
    titleEl.textContent = info.title;
  }
});

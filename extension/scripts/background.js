const DEFAULT_POLL_INTERVAL_MINUTES = 60;
const RSS_URL = 'https://blog.google/rss/';

// Setup alarm on install
chrome.runtime.onInstalled.addListener(async () => {
  await checkServer();
  chrome.alarms.create('pollServer', { periodInMinutes: DEFAULT_POLL_INTERVAL_MINUTES });
});

// Setup alarm on startup
chrome.runtime.onStartup.addListener(async () => {
  await checkServer();
  chrome.alarms.create('pollServer', { periodInMinutes: DEFAULT_POLL_INTERVAL_MINUTES });
});

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollServer') {
    await checkServer();
  }
});

// Regex-based XML parsing (DOMParser not available in service workers)
function parseRssItems(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];

    const title = itemXml.match(/<title>([^<]*)<\/title>/)?.[1] || '';
    const link = itemXml.match(/<link>([^<]*)<\/link>/)?.[1] || '';
    const pubDate = itemXml.match(/<pubDate>([^<]*)<\/pubDate>/)?.[1] || '';
    const category = itemXml.match(/<category>([^<]*)<\/category>/)?.[1] || '';
    const image = itemXml.match(/<media:content[^>]*url="([^"]*)"[^>]*>/)?.[1] || '';
    const author = itemXml.match(/<author[^>]*>[\s\S]*?<name>([^<]*)<\/name>/)?.[1] || '';

    items.push({ title, link, pubDate, category, image, author });
  }

  return items;
}

async function checkServer() {
  try {
    // Get previously newest article first
    const {storedArticles = [], unopenedCount = 0} = await chrome.storage.sync.get(["storedArticles", "unopenedCount"])

    // Fetch RSS
    const payload = await (await fetch(RSS_URL)).text();
    const items = parseRssItems(payload);

    // Parse articles, stop when we hit the lastOpened
    const articlesToAdd = [];

    for (const item of items) {
      const { title, link, pubDate, category, image, author } = item;

      // Stop if we hit the previous newest (we've seen this and everything after)
      if (storedArticles.length && link === storedArticles.at(-1).link) break;

      articlesToAdd.push({ title, link, pubDate, category, image, author });
    }

    // Show badge if there are new articles
    if (articlesToAdd.length > 0) {
      chrome.action.setBadgeText({ text: String(articlesToAdd.length + unopenedCount) });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });
    }

    // append (reversed) the new articles
    for(let i = articlesToAdd.length -1; i >= 0; i--){
      storedArticles.push(articlesToAdd.at(i));
    }

    // Store articles
    await chrome.storage.sync.set({
      storedArticles: storedArticles,
      unopenedCount: unopenedCount + articlesToAdd.length
    });

  } catch (e) {
    console.error('fetch error:', e);
  }
}

// Open side panel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.action.setBadgeText({ text: '' });
  chrome.storage.sync.set({ unopenedCount: 0 });
  chrome.sidePanel.open({ windowId: tab.windowId });
});

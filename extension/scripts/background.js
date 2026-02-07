const POLL_INTERVAL_MINUTES = 5;
const SERVER_URL = 'https://your-server.com/api/check'; // Replace with your server URL

// Setup alarm on install
chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('pollServer', { periodInMinutes: POLL_INTERVAL_MINUTES });
});

// Setup alarm on startup
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('pollServer', { periodInMinutes: POLL_INTERVAL_MINUTES });
});

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollServer') {
    await checkServer();
  }
});

async function checkServer() {
  try {
    const response = await fetch(SERVER_URL);
    const data = await response.json();

    if (data.hasNewArticle) {
      chrome.action.setBadgeText({ text: '!' });
      chrome.action.setBadgeBackgroundColor({ color: '#dc2626' });

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab) {
        chrome.sidePanel.open({ windowId: tab.windowId });
      }
    }
  } catch (error) {
    console.error('Polling error:', error);
  }
}

// Open side panel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.action.setBadgeText({ text: '' });
  chrome.sidePanel.open({ windowId: tab.windowId });
});

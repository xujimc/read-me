const DEFAULT_POLL_INTERVAL_MINUTES = 60;
const SERVER_URL = 'https://your-server.com/api/check'; // Replace with your server URL

// Setup alarm on install
chrome.runtime.onInstalled.addListener( async () => {
  await checkServer();
  chrome.alarms.create('pollServer', { periodInMinutes: DEFAULT_POLL_INTERVAL_MINUTES });
});

// Setup alarm on startup
chrome.runtime.onStartup.addListener( async () => {
  await checkServer();
  chrome.alarms.create('pollServer', { periodInMinutes: DEFAULT_POLL_INTERVAL_MINUTES });
});

// Handle alarm
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'pollServer') {
    await checkServer();
  }
});

async function checkServer() {
  try{
    const payload = (await fetch("https://blog.google/rss/")).text();                                                                                                                                                  
    const xml = new DOMParser().parseFromString(payload, 'text/xml');                                                                                                                                                
    const latestItem = xml.querySelector('item');                                                                                                                                                                    
    const title = latestItem.querySelector('title').textContent;                                                                                                                                                     
    const link = latestItem.querySelector('link').textContent;    
  }catch(e){
    
  }
}

// Open side panel on icon click
chrome.action.onClicked.addListener((tab) => {
  chrome.action.setBadgeText({ text: '' });
  chrome.sidePanel.open({ windowId: tab.windowId });
});

// RAM Lifesaver - Background Service Worker (QA Verified v1.1.1)

const DEFAULT_SETTINGS = {
  autoDiscard: true,
  idleMinutes: 3,
  ignoreAudible: true,
  ignorePinned: true,
  throttleYoutube: true,
  autoCloseDuplicates: false,
  maxTabsLimit: 20,
  whitelist: ['web.whatsapp.com', 'mail.google.com', 'discord.com', 'teams.microsoft.com']
};

const tabLastActive = {};

// Helper: Cek apakah URL masuk dalam daftar Whitelist
function isWhitelisted(url, whitelist = []) {
  if (!url) return false;
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname.toLowerCase();
    return whitelist.some(item => {
      const cleanItem = (item || '').trim().toLowerCase();
      return cleanItem && (hostname === cleanItem || hostname.endsWith('.' + cleanItem));
    });
  } catch (e) {
    return false;
  }
}

// Inisialisasi pengaturan bawaan saat pertama kali install
chrome.runtime.onInstalled.addListener(async () => {
  const data = await chrome.storage.local.get(['settings', 'savedGroups']);
  if (!data.settings) {
    await chrome.storage.local.set({ settings: DEFAULT_SETTINGS });
  } else {
    const merged = Object.assign({}, DEFAULT_SETTINGS, data.settings);
    await chrome.storage.local.set({ settings: merged });
  }
  if (!data.savedGroups) {
    await chrome.storage.local.set({ savedGroups: [] });
  }

  chrome.alarms.create('checkIdleTabs', { periodInMinutes: 1 });
  updateTabCountBadge();
});

// Update timestamp tab aktif
chrome.tabs.onActivated.addListener((activeInfo) => {
  tabLastActive[activeInfo.tabId] = Date.now();
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (tab.active) {
    tabLastActive[tabId] = Date.now();
  }
  if (changeInfo.status === 'complete') {
    checkDuplicatesIfEnabled();
  }
});

chrome.tabs.onCreated.addListener(() => {
  updateTabCountBadge();
  checkDuplicatesIfEnabled();
});

chrome.tabs.onRemoved.addListener((tabId) => {
  delete tabLastActive[tabId];
  updateTabCountBadge();
});

// Update indikator badge pada icon ekstensi
async function updateTabCountBadge() {
  try {
    const tabs = await chrome.tabs.query({});
    const count = tabs.length;
    const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get('settings');

    if (settings.maxTabsLimit > 0 && count >= settings.maxTabsLimit) {
      chrome.action.setBadgeText({ text: `${count}` });
      chrome.action.setBadgeBackgroundColor({ color: '#ff2a54' });
    } else {
      chrome.action.setBadgeText({ text: `${count}` });
      chrome.action.setBadgeBackgroundColor({ color: '#38ef7d' });
    }
  } catch (e) {}
}

// Handler Alarm periodik untuk auto-sleep
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'checkIdleTabs') {
    await checkAndDiscardIdleTabs();
  }
});

async function checkAndDiscardIdleTabs() {
  const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get('settings');
  if (!settings.autoDiscard) return;

  const thresholdMs = settings.idleMinutes * 60 * 1000;
  const now = Date.now();
  const tabs = await chrome.tabs.query({});

  for (const tab of tabs) {
    if (tab.active) continue;
    if (tab.discarded) continue;
    if (settings.ignoreAudible && tab.audible) continue;
    if (settings.ignorePinned && tab.pinned) continue;
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('edge://')) continue;
    if (isWhitelisted(tab.url, settings.whitelist)) continue;

    // Gunakan native tab.lastAccessed jika didukung, fallback ke memory / now
    const lastActive = tab.lastAccessed || tabLastActive[tab.id] || now;
    if (now - lastActive >= thresholdMs) {
      try {
        await chrome.tabs.discard(tab.id);
      } catch (err) {}
    }
  }
}

// Fungsi deteksi dan tutup tab duplikat
async function closeDuplicateTabs() {
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const seenUrls = new Set();
  const duplicateIds = [];

  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) continue;
    
    // Normalisasi URL (abaikan hash fragment)
    const cleanUrl = tab.url.split('#')[0].replace(/\/$/, '');
    if (seenUrls.has(cleanUrl)) {
      duplicateIds.push(tab.id);
    } else {
      seenUrls.add(cleanUrl);
    }
  }

  if (duplicateIds.length > 0) {
    try {
      await chrome.tabs.remove(duplicateIds);
    } catch (e) {}
  }
  return duplicateIds.length;
}

async function checkDuplicatesIfEnabled() {
  const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get('settings');
  if (settings.autoCloseDuplicates) {
    await closeDuplicateTabs();
  }
}

// Shortcut Keyboard Handler (Hotkeys)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'discard-current-tab') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab && !activeTab.discarded && activeTab.url && !activeTab.url.startsWith('chrome://') && !activeTab.url.startsWith('brave://')) {
      try {
        await chrome.tabs.discard(activeTab.id);
      } catch (e) {}
    }
  } else if (command === 'discard-all-background-tabs') {
    const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get('settings');
    const tabs = await chrome.tabs.query({ currentWindow: true });
    for (const tab of tabs) {
      if (tab.active || tab.discarded) continue;
      if (settings.ignoreAudible && tab.audible) continue;
      if (settings.ignorePinned && tab.pinned) continue;
      if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) continue;
      if (isWhitelisted(tab.url, settings.whitelist)) continue;

      try {
        await chrome.tabs.discard(tab.id);
      } catch (e) {}
    }
  }
});

// Komunikasi dengan Popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    if (message.type === 'DISCARD_ALL_OTHERS') {
      const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get('settings');
      const tabs = await chrome.tabs.query({ currentWindow: true });
      let count = 0;

      for (const tab of tabs) {
        if (tab.active || tab.discarded) continue;
        if (settings.ignoreAudible && tab.audible) continue;
        if (settings.ignorePinned && tab.pinned) continue;
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) continue;
        if (isWhitelisted(tab.url, settings.whitelist)) continue;

        try {
          await chrome.tabs.discard(tab.id);
          count++;
        } catch (e) {}
      }

      sendResponse({ success: true, count });
    } else if (message.type === 'CLOSE_DUPLICATES') {
      const count = await closeDuplicateTabs();
      sendResponse({ success: true, count });
    } else if (message.type === 'CONSOLIDATE_TABS') {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const tabsToSave = [];
      const tabIdsToClose = [];

      for (const tab of tabs) {
        if (tab.active || tab.pinned) continue;
        if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://')) continue;

        tabsToSave.push({
          title: tab.title || tab.url,
          url: tab.url,
          favIconUrl: tab.favIconUrl || ''
        });
        tabIdsToClose.push(tab.id);
      }

      if (tabsToSave.length > 0) {
        const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
        const newGroup = {
          id: 'group_' + Date.now(),
          date: new Date().toLocaleString('id-ID'),
          tabs: tabsToSave
        };
        savedGroups.unshift(newGroup);
        await chrome.storage.local.set({ savedGroups });
        await chrome.tabs.remove(tabIdsToClose);
      }

      sendResponse({ success: true, savedCount: tabsToSave.length });
    } else if (message.type === 'GET_STATS') {
      const allTabs = await chrome.tabs.query({});
      const sleepingTabs = allTabs.filter(t => t.discarded).length;
      sendResponse({
        totalTabs: allTabs.length,
        sleepingTabs: sleepingTabs,
        activeTabs: allTabs.length - sleepingTabs
      });
    } else if (message.type === 'GET_CURRENT_TAB_DOMAIN') {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        try {
          const u = new URL(tab.url);
          sendResponse({ domain: u.hostname || null });
        } catch(e) {
          sendResponse({ domain: null });
        }
      } else {
        sendResponse({ domain: null });
      }
    }
  })();

  return true;
});

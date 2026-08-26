// RAM Lifesaver - Background Service Worker (QA Verified v1.1.1)

const DEFAULT_SETTINGS = {
  autoDiscard: true,
  idleMinutes: 3,
  ignoreAudible: true,
  ignorePinned: true,
  protectForms: true,
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

// Inisialisasi Menu Klik Kanan (Context Menus)
function setupContextMenus() {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: 'menu-save-this-tab-onetab',
      title: '📑 Simpan tab ini ke OneTab',
      contexts: ['page', 'action']
    });
    chrome.contextMenus.create({
      id: 'menu-discard-this-tab',
      title: '💤 Tidurkan tab ini',
      contexts: ['page', 'action']
    });
    chrome.contextMenus.create({
      id: 'menu-whitelist-domain',
      title: '🛡️ Tambahkan domain ini ke Whitelist',
      contexts: ['page', 'action']
    });
    chrome.contextMenus.create({
      id: 'menu-consolidate-tabs',
      title: '📑 Satukan SEMUA tab latar ke OneTab',
      contexts: ['page', 'action']
    });
  });
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

  setupContextMenus();
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

    // Periksa apakah tab memiliki form/input yang belum tersimpan jika proteksi form aktif
    if (settings.protectForms) {
      try {
        const response = await chrome.tabs.sendMessage(tab.id, { type: 'CHECK_FORM_DIRTY' });
        if (response && response.isDirty) {
          continue; // Lewati tab ini, lindungi ketikan pengguna
        }
      } catch (e) {}
    }

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
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('edge://')) continue;
    
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

// Helper mengambil info Tab Group bawaan browser secara akurat
async function getTabGroupInfo(groupId) {
  if (typeof groupId !== 'number' || groupId <= 0 || !chrome.tabGroups) return null;
  try {
    const group = await chrome.tabGroups.get(groupId);
    if (group) {
      return {
        id: group.id,
        title: (group.title || '').trim(),
        color: group.color || ''
      };
    }
  } catch (err) {
    // Tab group mungkin baru saja ditutup
  }
  return null;
}

// Helper untuk OneTab consolidate tabs dengan deteksi Tab Group bawaan browser
async function consolidateTabs(windowId) {
  // Pastikan windowId didapatkan dari jendela aktif saat ini
  let targetWindowId = windowId;
  if (!targetWindowId) {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
      if (activeTab) targetWindowId = activeTab.windowId;
    } catch (e) {}
  }

  const queryOptions = targetWindowId ? { windowId: targetWindowId } : { currentWindow: true };
  const tabs = await chrome.tabs.query(queryOptions);
  const validTabs = [];
  const tabIdsToClose = [];

  for (const tab of tabs) {
    if (tab.active || tab.pinned) continue;
    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('edge://')) continue;

    validTabs.push(tab);
    tabIdsToClose.push(tab.id);
  }

  if (validTabs.length === 0) return 0;

  // Kelompokkan tab berdasarkan groupId aslinya
  const buckets = new Map();
  for (const tab of validTabs) {
    const gId = (tab.groupId !== undefined && tab.groupId > 0) ? tab.groupId : -1;
    
    if (!buckets.has(gId)) {
      let gTitle = '';
      let gColor = '';

      if (gId > 0) {
        const gInfo = await getTabGroupInfo(gId);
        if (gInfo) {
          gTitle = gInfo.title;
          gColor = gInfo.color;
        }
      }

      buckets.set(gId, {
        title: gTitle,
        color: gColor,
        tabs: []
      });
    }

    buckets.get(gId).tabs.push({
      title: tab.title || tab.url,
      url: tab.url,
      favIconUrl: tab.favIconUrl || ''
    });
  }

  const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
  const nowStr = new Date().toLocaleString('id-ID');

  for (const [gId, gData] of buckets.entries()) {
    let finalTitle = gData.title;
    if (!finalTitle && gId !== -1) {
      finalTitle = gData.color ? `Grup Tab (${gData.color})` : 'Grup Tab';
    } else if (!finalTitle && buckets.size > 1) {
      finalTitle = 'Tab Lainnya';
    }

    const newGroup = {
      id: 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
      title: finalTitle,
      color: gData.color || '',
      date: nowStr,
      tabs: gData.tabs
    };
    savedGroups.unshift(newGroup);
  }

  await chrome.storage.local.set({ savedGroups });
  await chrome.tabs.remove(tabIdsToClose);

  return validTabs.length;
}

// Helper untuk menyimpan 1 tab tertentu ke OneTab
async function saveSingleTabToOneTab(tab) {
  if (!tab || !tab.id) return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('edge://')) return;

  let groupTitle = '';
  let groupColor = '';

  if (tab.groupId && tab.groupId > 0) {
    const gInfo = await getTabGroupInfo(tab.groupId);
    if (gInfo) {
      groupTitle = gInfo.title || (gInfo.color ? `Grup Tab (${gInfo.color})` : 'Grup Tab');
      groupColor = gInfo.color || '';
    }
  }

  const tabToSave = {
    title: tab.title || tab.url,
    url: tab.url,
    favIconUrl: tab.favIconUrl || ''
  };

  const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
  const newGroup = {
    id: 'group_' + Date.now(),
    title: groupTitle,
    color: groupColor,
    date: new Date().toLocaleString('id-ID'),
    tabs: [tabToSave]
  };
  savedGroups.unshift(newGroup);
  await chrome.storage.local.set({ savedGroups });

  // Pindahkan fokus terlebih dahulu jika tab sedang aktif agar browser tidak menutup tiba-tiba
  if (tab.active) {
    const windowTabs = await chrome.tabs.query({ windowId: tab.windowId });
    const otherTabs = windowTabs.filter(t => t.id !== tab.id);
    if (otherTabs.length > 0) {
      const currentIndex = windowTabs.findIndex(t => t.id === tab.id);
      const targetNext = windowTabs[currentIndex + 1] || windowTabs[currentIndex - 1] || otherTabs[0];
      await chrome.tabs.update(targetNext.id, { active: true });
    }
  }

  try {
    await chrome.tabs.remove(tab.id);
  } catch (e) {}
}

// Helper untuk menidurkan tab secara aman (menangani batasan Chromium pada tab aktif)
async function discardTabSafely(tab) {
  if (!tab || !tab.id) return;
  if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('edge://')) return;

  try {
    if (tab.active) {
      // Chromium tidak mengizinkan tab yang sedang aktif ditidurkan langsung tanpa pindah fokus.
      // Kita alihkan fokus ke tab lain di jendela yang sama terlebih dahulu.
      const windowTabs = await chrome.tabs.query({ windowId: tab.windowId });
      const otherTabs = windowTabs.filter(t => t.id !== tab.id);

      if (otherTabs.length > 0) {
        // Cari tab terdekat (sebelah kanan atau kiri)
        const currentIndex = windowTabs.findIndex(t => t.id === tab.id);
        const targetNext = windowTabs[currentIndex + 1] || windowTabs[currentIndex - 1] || otherTabs[0];

        await chrome.tabs.update(targetNext.id, { active: true });

        // Berikan jeda sejenak agar status active berpindah sebelum discard dijalankan
        setTimeout(async () => {
          try {
            await chrome.tabs.discard(tab.id);
            updateTabCountBadge();
          } catch (err) {
            console.error('Gagal menidurkan tab:', err);
          }
        }, 150);
      } else {
        // Jika hanya ada 1 tab di jendela, buat tab baru agar tab lama dapat ditidurkan
        const newTab = await chrome.tabs.create({ active: true });
        setTimeout(async () => {
          try {
            await chrome.tabs.discard(tab.id);
            updateTabCountBadge();
          } catch (err) {}
        }, 150);
      }
    } else {
      await chrome.tabs.discard(tab.id);
      updateTabCountBadge();
    }
  } catch (err) {
    console.error('Error saat discardTabSafely:', err);
  }
}

// Handler Menu Klik Kanan (Context Menus)
chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  let targetTab = tab;
  if (!targetTab || !targetTab.id) {
    const [active] = await chrome.tabs.query({ active: true, currentWindow: true });
    targetTab = active;
  }

  if (info.menuItemId === 'menu-save-this-tab-onetab') {
    if (targetTab) {
      await saveSingleTabToOneTab(targetTab);
    }
  } else if (info.menuItemId === 'menu-discard-this-tab') {
    if (targetTab) {
      await discardTabSafely(targetTab);
    }
  } else if (info.menuItemId === 'menu-whitelist-domain') {
    if (targetTab && targetTab.url) {
      try {
        const u = new URL(targetTab.url);
        const hostname = u.hostname.toLowerCase();
        const { settings = DEFAULT_SETTINGS } = await chrome.storage.local.get('settings');
        const currentWhitelist = Array.isArray(settings.whitelist) ? settings.whitelist : [];
        if (!currentWhitelist.includes(hostname)) {
          currentWhitelist.push(hostname);
          settings.whitelist = currentWhitelist;
          await chrome.storage.local.set({ settings });
        }
      } catch (e) {}
    }
  } else if (info.menuItemId === 'menu-consolidate-tabs') {
    await consolidateTabs(targetTab ? targetTab.windowId : undefined);
  }
});

// Shortcut Keyboard Handler (Hotkeys)
chrome.commands.onCommand.addListener(async (command) => {
  if (command === 'discard-current-tab') {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (activeTab) {
      await discardTabSafely(activeTab);
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
      const savedCount = await consolidateTabs();
      sendResponse({ success: true, savedCount });
    } else if (message.type === 'SAVE_SINGLE_TAB') {
      const tab = await chrome.tabs.get(message.tabId);
      if (tab) {
        await saveSingleTabToOneTab(tab);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    } else if (message.type === 'SAVE_SELECTED_TABS') {
      const tabIds = message.tabIds || [];
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const validTabs = [];
      const tabIdsToClose = [];

      for (const tab of tabs) {
        if (tabIds.includes(tab.id)) {
          if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('brave://') || tab.url.startsWith('edge://')) continue;
          validTabs.push(tab);
          tabIdsToClose.push(tab.id);
        }
      }

      if (validTabs.length > 0) {
        // Kelompokkan tab yang dipilih berdasarkan Tab Group aslinya
        const buckets = new Map();
        for (const tab of validTabs) {
          const gId = (tab.groupId !== undefined && tab.groupId > 0) ? tab.groupId : -1;
          if (!buckets.has(gId)) {
            let gTitle = '';
            let gColor = '';

            if (gId > 0) {
              const gInfo = await getTabGroupInfo(gId);
              if (gInfo) {
                gTitle = gInfo.title;
                gColor = gInfo.color;
              }
            }

            buckets.set(gId, {
              title: gTitle,
              color: gColor,
              tabs: []
            });
          }
          buckets.get(gId).tabs.push({
            title: tab.title || tab.url,
            url: tab.url,
            favIconUrl: tab.favIconUrl || ''
          });
        }

        const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
        const nowStr = new Date().toLocaleString('id-ID');

        for (const [gId, gData] of buckets.entries()) {
          let groupTitle = gData.title;
          if (!groupTitle && gId !== -1) {
            groupTitle = gData.color ? `Grup Tab (${gData.color})` : 'Grup Tab';
          } else if (!groupTitle && buckets.size > 1) {
            groupTitle = 'Tab Terpilih';
          }

          const newGroup = {
            id: 'group_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            title: groupTitle,
            color: gData.color || '',
            date: nowStr,
            tabs: gData.tabs
          };
          savedGroups.unshift(newGroup);
        }

        await chrome.storage.local.set({ savedGroups });
        await chrome.tabs.remove(tabIdsToClose);
      }

      sendResponse({ success: true, count: validTabs.length });
    } else if (message.type === 'DISCARD_SINGLE_TAB') {
      const tab = await chrome.tabs.get(message.tabId);
      if (tab) {
        await discardTabSafely(tab);
        sendResponse({ success: true });
      } else {
        sendResponse({ success: false });
      }
    } else if (message.type === 'GET_WINDOW_TABS') {
      const tabs = await chrome.tabs.query({ currentWindow: true });
      const mappedTabs = [];

      for (const t of tabs) {
        let gTitle = '';
        let gColor = '';
        if (t.groupId && t.groupId > 0) {
          const gInfo = await getTabGroupInfo(t.groupId);
          if (gInfo) {
            gTitle = gInfo.title;
            gColor = gInfo.color;
          }
        }

        mappedTabs.push({
          id: t.id,
          groupId: t.groupId,
          groupTitle: gTitle,
          groupColor: gColor,
          title: t.title || t.url || 'Tab Tanpa Judul',
          url: t.url || '',
          favIconUrl: t.favIconUrl || '',
          active: !!t.active,
          pinned: !!t.pinned,
          audible: !!t.audible,
          discarded: !!t.discarded
        });
      }

      sendResponse({ tabs: mappedTabs });
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

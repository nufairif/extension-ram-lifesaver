// RAM Lifesaver - Popup Logic (QA Verified v1.1.1)

document.addEventListener('DOMContentLoaded', async () => {
  // Elements: Stats
  const totalTabsEl = document.getElementById('totalTabs');
  const sleepingTabsEl = document.getElementById('sleepingTabs');
  const estimatedSavedEl = document.getElementById('estimatedSaved');
  const engineStatusEl = document.getElementById('engineStatus');
  const savedGroupsCountEl = document.getElementById('savedGroupsCount');

  // Elements: Buttons
  const btnSleepAll = document.getElementById('btnSleepAll');
  const btnConsolidate = document.getElementById('btnConsolidate');
  const btnCloseDuplicates = document.getElementById('btnCloseDuplicates');
  const btnOpenSaved = document.getElementById('btnOpenSaved');

  // Elements: Settings
  const toggleAutoDiscard = document.getElementById('toggleAutoDiscard');
  const selectIdleMinutes = document.getElementById('selectIdleMinutes');
  const toggleThrottleYoutube = document.getElementById('toggleThrottleYoutube');
  const toggleAudible = document.getElementById('toggleAudible');
  const togglePinned = document.getElementById('togglePinned');
  const toggleProtectForms = document.getElementById('toggleProtectForms');
  const toggleAutoDuplicates = document.getElementById('toggleAutoDuplicates');
  const inputMaxTabs = document.getElementById('inputMaxTabs');

  // Elements: Whitelist
  const inputNewDomain = document.getElementById('inputNewDomain');
  const btnAddDomain = document.getElementById('btnAddDomain');
  const btnAddCurrentDomain = document.getElementById('btnAddCurrentDomain');
  const currentTabDomainText = document.getElementById('currentTabDomainText');
  const whitelistTags = document.getElementById('whitelistTags');

  // Elements: Toast
  const toastMessage = document.getElementById('toastMessage');

  let currentWhitelist = [];
  let currentActiveDomain = '';

  // 1. Tab Navigation
  const navButtons = document.querySelectorAll('.nav-btn');
  const tabPanels = document.querySelectorAll('.tab-panel');

  navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      navButtons.forEach(b => b.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      const targetPanel = document.getElementById(btn.dataset.target);
      if (targetPanel) targetPanel.classList.add('active');
    });
  });

  // 2. Muat Statistik Tab
  async function refreshStats() {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
      if (res) {
        totalTabsEl.textContent = res.totalTabs;
        sleepingTabsEl.textContent = res.sleepingTabs;
        const savedMB = res.sleepingTabs * 150;
        estimatedSavedEl.textContent = `${savedMB} MB`;
      }
    });

    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    const totalSavedTabs = savedGroups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);
    savedGroupsCountEl.textContent = `${totalSavedTabs} tab`;

    // Ambil Domain Tab Saat ini
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_DOMAIN' }, (res) => {
      if (res && res.domain) {
        currentActiveDomain = res.domain;
        currentTabDomainText.textContent = res.domain;
        btnAddCurrentDomain.style.display = 'block';
      } else {
        currentActiveDomain = '';
        currentTabDomainText.textContent = 'Tidak tersedia';
        btnAddCurrentDomain.style.display = 'none';
      }
    });
  }

  // 3. Muat & Simpan Pengaturan
  const { settings = {} } = await chrome.storage.local.get('settings');
  if (settings) {
    toggleAutoDiscard.checked = settings.autoDiscard !== false;
    selectIdleMinutes.value = settings.idleMinutes || '3';
    toggleThrottleYoutube.checked = settings.throttleYoutube !== false;
    toggleAudible.checked = settings.ignoreAudible !== false;
    togglePinned.checked = settings.ignorePinned !== false;
    toggleProtectForms.checked = settings.protectForms !== false;
    toggleAutoDuplicates.checked = !!settings.autoCloseDuplicates;
    inputMaxTabs.value = settings.maxTabsLimit || 20;

    currentWhitelist = Array.isArray(settings.whitelist) ? settings.whitelist : ['web.whatsapp.com', 'mail.google.com', 'discord.com', 'teams.microsoft.com'];
    renderWhitelist();
    updateEngineStatus(toggleAutoDiscard.checked);
  }

  function updateEngineStatus(isActive) {
    if (isActive) {
      engineStatusEl.textContent = 'Aktif';
      engineStatusEl.className = 'status-indicator active';
    } else {
      engineStatusEl.textContent = 'Jeda';
      engineStatusEl.className = 'status-indicator paused';
    }
  }

  async function saveSettings() {
    const updated = {
      autoDiscard: toggleAutoDiscard.checked,
      idleMinutes: parseInt(selectIdleMinutes.value, 10) || 3,
      throttleYoutube: toggleThrottleYoutube.checked,
      ignoreAudible: toggleAudible.checked,
      ignorePinned: togglePinned.checked,
      protectForms: toggleProtectForms.checked,
      autoCloseDuplicates: toggleAutoDuplicates.checked,
      maxTabsLimit: parseInt(inputMaxTabs.value, 10) || 20,
      whitelist: currentWhitelist
    };
    await chrome.storage.local.set({ settings: updated });
    updateEngineStatus(updated.autoDiscard);
    showToast('Pengaturan tersimpan');
  }

  [toggleAutoDiscard, selectIdleMinutes, toggleThrottleYoutube, toggleAudible, togglePinned, toggleProtectForms, toggleAutoDuplicates, inputMaxTabs].forEach(el => {
    el.addEventListener('change', saveSettings);
  });

  // 4. Whitelist Management (Safe DOM Injection)
  function renderWhitelist() {
    whitelistTags.innerHTML = '';
    currentWhitelist.forEach((domain, idx) => {
      const chip = document.createElement('div');
      chip.className = 'tag-chip';

      const domainSpan = document.createElement('span');
      domainSpan.textContent = domain;

      const deleteBtn = document.createElement('span');
      deleteBtn.className = 'tag-delete';
      deleteBtn.innerHTML = '&times;';
      deleteBtn.addEventListener('click', () => {
        currentWhitelist.splice(idx, 1);
        saveSettings();
        renderWhitelist();
      });

      chip.appendChild(domainSpan);
      chip.appendChild(deleteBtn);
      whitelistTags.appendChild(chip);
    });
  }

  function addDomainToWhitelist(domain) {
    if (!domain) return;
    const clean = domain.trim().toLowerCase().replace(/^https?:\/\//, '').split('/')[0];
    if (clean && !currentWhitelist.includes(clean)) {
      currentWhitelist.push(clean);
      saveSettings();
      renderWhitelist();
      showToast(`🛡️ ${clean} ditambahkan`);
    }
  }

  btnAddDomain.addEventListener('click', () => {
    if (inputNewDomain.value) {
      addDomainToWhitelist(inputNewDomain.value);
      inputNewDomain.value = '';
    }
  });

  inputNewDomain.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && inputNewDomain.value) {
      addDomainToWhitelist(inputNewDomain.value);
      inputNewDomain.value = '';
    }
  });

  btnAddCurrentDomain.addEventListener('click', () => {
    if (currentActiveDomain) {
      addDomainToWhitelist(currentActiveDomain);
    }
  });

  // Elements: Selective Tabs Manager
  const openTabsCountEl = document.getElementById('openTabsCount');
  const chkSelectAll = document.getElementById('chkSelectAll');
  const btnSaveSelectedTabs = document.getElementById('btnSaveSelectedTabs');
  const btnSleepSelectedTabs = document.getElementById('btnSleepSelectedTabs');
  const selectedCountEl = document.getElementById('selectedCount');
  const openTabsListEl = document.getElementById('openTabsList');

  // Helper memvalidasi URL
  function isValidHttpUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // 2. Muat Statistik Tab & Daftar Tab Terbuka
  async function refreshStats() {
    chrome.runtime.sendMessage({ type: 'GET_STATS' }, (res) => {
      if (res) {
        totalTabsEl.textContent = res.totalTabs;
        sleepingTabsEl.textContent = res.sleepingTabs;
        const savedMB = res.sleepingTabs * 150;
        estimatedSavedEl.textContent = `${savedMB} MB`;
      }
    });

    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    const totalSavedTabs = savedGroups.reduce((acc, g) => acc + (g.tabs ? g.tabs.length : 0), 0);
    savedGroupsCountEl.textContent = `${totalSavedTabs} tab`;

    // Ambil Domain Tab Saat ini
    chrome.runtime.sendMessage({ type: 'GET_CURRENT_TAB_DOMAIN' }, (res) => {
      if (res && res.domain) {
        currentActiveDomain = res.domain;
        currentTabDomainText.textContent = res.domain;
        btnAddCurrentDomain.style.display = 'block';
      } else {
        currentActiveDomain = '';
        currentTabDomainText.textContent = 'Tidak tersedia';
        btnAddCurrentDomain.style.display = 'none';
      }
    });

    await refreshOpenTabsList();
  }

  // Render Daftar Tab Jendela Ini (Per Page)
  async function refreshOpenTabsList() {
    chrome.runtime.sendMessage({ type: 'GET_WINDOW_TABS' }, (res) => {
      if (!res || !Array.isArray(res.tabs)) return;

      const tabs = res.tabs;
      openTabsCountEl.textContent = `${tabs.length} tab`;
      openTabsListEl.innerHTML = '';

      if (tabs.length === 0) {
        openTabsListEl.innerHTML = '<div style="text-align:center;font-size:11px;color:#8b949e;padding:10px;">Tidak ada tab</div>';
        return;
      }

      tabs.forEach(tab => {
        const row = document.createElement('div');
        row.className = 'open-tab-row';

        const left = document.createElement('div');
        left.className = 'open-tab-left';

        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'open-tab-checkbox';
        chk.dataset.tabId = tab.id;
        chk.addEventListener('change', updateSelectedTabControls);

        if (tab.favIconUrl && isValidHttpUrl(tab.favIconUrl)) {
          const icon = document.createElement('img');
          icon.className = 'open-tab-favicon';
          icon.src = tab.favIconUrl;
          icon.onerror = () => { icon.style.display = 'none'; };
          left.appendChild(chk);
          left.appendChild(icon);
        } else {
          left.appendChild(chk);
        }

        if (tab.groupTitle || (tab.groupId && tab.groupId > -1)) {
          const groupBadge = document.createElement('span');
          groupBadge.className = `tab-group-pill color-${tab.groupColor || 'grey'}`;
          groupBadge.textContent = tab.groupTitle || 'Grup';
          left.appendChild(groupBadge);
        }

        const title = document.createElement('span');
        title.className = 'open-tab-title';
        title.textContent = tab.title || tab.url || 'Tab Tanpa Judul';
        title.title = tab.url;
        left.appendChild(title);

        const right = document.createElement('div');
        right.className = 'open-tab-right';

        if (tab.discarded) {
          const badge = document.createElement('span');
          badge.className = 'tab-badge-sleep';
          badge.textContent = '💤 Tidur';
          right.appendChild(badge);
        } else if (tab.active) {
          const badge = document.createElement('span');
          badge.className = 'tab-badge-active';
          badge.textContent = '🟢 Aktif';
          right.appendChild(badge);
        }

        // Tombol aksi per halaman/tab: OneTab
        const btnOneTabSingle = document.createElement('button');
        btnOneTabSingle.className = 'btn-tab-action';
        btnOneTabSingle.title = 'Simpan tab ini ke OneTab';
        btnOneTabSingle.textContent = '📑';
        btnOneTabSingle.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.runtime.sendMessage({ type: 'SAVE_SINGLE_TAB', tabId: tab.id }, () => {
            showToast('📑 Tab disimpan ke OneTab!');
            refreshStats();
          });
        });

        // Tombol aksi per halaman/tab: Sleep
        const btnSleepSingle = document.createElement('button');
        btnSleepSingle.className = 'btn-tab-action';
        btnSleepSingle.title = 'Tidurkan tab ini';
        btnSleepSingle.textContent = '💤';
        btnSleepSingle.addEventListener('click', (e) => {
          e.stopPropagation();
          chrome.runtime.sendMessage({ type: 'DISCARD_SINGLE_TAB', tabId: tab.id }, () => {
            showToast('💤 Tab ditidurkan!');
            refreshStats();
          });
        });

        right.appendChild(btnOneTabSingle);
        if (!tab.discarded) {
          right.appendChild(btnSleepSingle);
        }

        row.appendChild(left);
        row.appendChild(right);
        openTabsListEl.appendChild(row);
      });

      updateSelectedTabControls();
    });
  }

  function updateSelectedTabControls() {
    const checkboxes = document.querySelectorAll('.open-tab-checkbox');
    const checked = Array.from(checkboxes).filter(c => c.checked);
    selectedCountEl.textContent = checked.length;

    const hasSelection = checked.length > 0;
    btnSaveSelectedTabs.disabled = !hasSelection;
    btnSleepSelectedTabs.disabled = !hasSelection;

    if (checkboxes.length > 0 && checked.length === checkboxes.length) {
      chkSelectAll.checked = true;
      chkSelectAll.indeterminate = false;
    } else if (checked.length > 0) {
      chkSelectAll.checked = false;
      chkSelectAll.indeterminate = true;
    } else {
      chkSelectAll.checked = false;
      chkSelectAll.indeterminate = false;
    }
  }

  chkSelectAll.addEventListener('change', () => {
    const checkboxes = document.querySelectorAll('.open-tab-checkbox');
    checkboxes.forEach(c => { c.checked = chkSelectAll.checked; });
    updateSelectedTabControls();
  });

  btnSaveSelectedTabs.addEventListener('click', () => {
    const checked = document.querySelectorAll('.open-tab-checkbox:checked');
    const tabIds = Array.from(checked).map(c => parseInt(c.dataset.tabId, 10));
    if (tabIds.length === 0) return;

    btnSaveSelectedTabs.disabled = true;
    chrome.runtime.sendMessage({ type: 'SAVE_SELECTED_TABS', tabIds }, (res) => {
      btnSaveSelectedTabs.disabled = false;
      if (res && res.success) {
        showToast(`📑 ${res.count} tab disimpan ke OneTab!`);
        refreshStats();
      }
    });
  });

  btnSleepSelectedTabs.addEventListener('click', async () => {
    const checked = document.querySelectorAll('.open-tab-checkbox:checked');
    const tabIds = Array.from(checked).map(c => parseInt(c.dataset.tabId, 10));
    if (tabIds.length === 0) return;

    btnSleepSelectedTabs.disabled = true;
    let count = 0;
    for (const tabId of tabIds) {
      await new Promise(resolve => {
        chrome.runtime.sendMessage({ type: 'DISCARD_SINGLE_TAB', tabId }, () => {
          count++;
          resolve();
        });
      });
    }
    btnSleepSelectedTabs.disabled = false;
    showToast(`💤 ${count} tab berhasil ditidurkan!`);
    refreshStats();
  });

  // 5. Tombol Aksi
  btnSleepAll.addEventListener('click', () => {
    btnSleepAll.disabled = true;
    chrome.runtime.sendMessage({ type: 'DISCARD_ALL_OTHERS' }, (res) => {
      btnSleepAll.disabled = false;
      if (res && res.success) {
        showToast(`✨ ${res.count} tab berhasil ditidurkan!`);
        refreshStats();
      }
    });
  });

  btnConsolidate.addEventListener('click', () => {
    if (confirm('Satukan seluruh tab latar ke dalam daftar dan tutup halamannya?')) {
      chrome.runtime.sendMessage({ type: 'CONSOLIDATE_TABS' }, (res) => {
        if (res && res.success) {
          showToast(`📑 ${res.savedCount} tab disatukan!`);
          refreshStats();
        }
      });
    }
  });

  btnCloseDuplicates.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLOSE_DUPLICATES' }, (res) => {
      if (res && res.success) {
        if (res.count > 0) {
          showToast(`🔍 ${res.count} tab duplikat ditutup!`);
        } else {
          showToast('✅ Tidak ada tab duplikat');
        }
        refreshStats();
      }
    });
  });

  btnOpenSaved.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('saved.html') });
  });

  function showToast(text) {
    toastMessage.textContent = text;
    toastMessage.classList.remove('hidden');
    setTimeout(() => {
      toastMessage.classList.add('hidden');
    }, 2500);
  }

  refreshStats();
});

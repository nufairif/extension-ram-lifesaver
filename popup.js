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
      autoCloseDuplicates: toggleAutoDuplicates.checked,
      maxTabsLimit: parseInt(inputMaxTabs.value, 10) || 20,
      whitelist: currentWhitelist
    };
    await chrome.storage.local.set({ settings: updated });
    updateEngineStatus(updated.autoDiscard);
    showToast('Pengaturan tersimpan');
  }

  [toggleAutoDiscard, selectIdleMinutes, toggleThrottleYoutube, toggleAudible, togglePinned, toggleAutoDuplicates, inputMaxTabs].forEach(el => {
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

// RAM Lifesaver - Saved Tabs Manager Logic (QA Verified v1.1.1)

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('groupsContainer');
  const emptyState = document.getElementById('emptyState');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const fileInput = document.getElementById('fileInput');

  // Helper untuk memvalidasi protokol URL
  function isValidHttpUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  async function loadGroups() {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');

    if (savedGroups.length === 0) {
      emptyState.style.display = 'block';
      container.innerHTML = '';
      container.appendChild(emptyState);
      return;
    }

    emptyState.style.display = 'none';
    container.innerHTML = '';

    savedGroups.forEach((group, groupIndex) => {
      const card = document.createElement('div');
      card.className = 'group-card';

      // Header Grup
      const groupHeader = document.createElement('div');
      groupHeader.className = 'group-header';

      const dateSpan = document.createElement('span');
      dateSpan.className = 'group-date';
      const validTabsCount = (group.tabs || []).length;
      dateSpan.textContent = `📅 Disimpan pada: ${group.date || 'Tanpa Tanggal'} (${validTabsCount} tab)`;

      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'group-actions';

      const btnRestoreGroup = document.createElement('button');
      btnRestoreGroup.className = 'btn btn-restore';
      btnRestoreGroup.textContent = 'Buka Semua Tab';
      btnRestoreGroup.addEventListener('click', () => restoreGroup(groupIndex));

      const btnDeleteGroup = document.createElement('button');
      btnDeleteGroup.className = 'btn btn-danger';
      btnDeleteGroup.textContent = 'Hapus Grup';
      btnDeleteGroup.addEventListener('click', () => deleteGroup(groupIndex));

      actionsDiv.appendChild(btnRestoreGroup);
      actionsDiv.appendChild(btnDeleteGroup);

      groupHeader.appendChild(dateSpan);
      groupHeader.appendChild(actionsDiv);
      card.appendChild(groupHeader);

      // List Tab
      const tabList = document.createElement('ul');
      tabList.className = 'tab-list';

      (group.tabs || []).forEach((tab, tabIndex) => {
        const item = document.createElement('li');
        item.className = 'tab-item';

        const link = document.createElement('a');
        link.className = 'tab-link';
        link.href = isValidHttpUrl(tab.url) ? tab.url : '#';
        link.target = '_blank';
        link.rel = 'noopener noreferrer';

        if (tab.favIconUrl && isValidHttpUrl(tab.favIconUrl)) {
          const icon = document.createElement('img');
          icon.className = 'tab-favicon';
          icon.src = tab.favIconUrl;
          icon.onerror = () => { icon.style.display = 'none'; };
          link.appendChild(icon);
        }

        const titleText = document.createTextNode(tab.title || tab.url || 'Halaman Tanpa Judul');
        link.appendChild(titleText);

        const btnRemove = document.createElement('button');
        btnRemove.className = 'tab-remove';
        btnRemove.title = 'Hapus tab dari daftar';
        btnRemove.innerHTML = '&times;';
        btnRemove.addEventListener('click', () => removeTabFromGroup(groupIndex, tabIndex));

        item.appendChild(link);
        item.appendChild(btnRemove);
        tabList.appendChild(item);
      });

      card.appendChild(tabList);
      container.appendChild(card);
    });
  }

  async function restoreGroup(groupIndex) {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    const group = savedGroups[groupIndex];
    if (group && Array.isArray(group.tabs)) {
      for (const tab of group.tabs) {
        if (tab && tab.url && isValidHttpUrl(tab.url)) {
          chrome.tabs.create({ url: tab.url, active: false });
        }
      }
      savedGroups.splice(groupIndex, 1);
      await chrome.storage.local.set({ savedGroups });
      loadGroups();
    }
  }

  async function deleteGroup(groupIndex) {
    if (confirm('Yakin ingin menghapus seluruh tab dalam grup ini?')) {
      const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
      savedGroups.splice(groupIndex, 1);
      await chrome.storage.local.set({ savedGroups });
      loadGroups();
    }
  }

  async function removeTabFromGroup(groupIndex, tabIndex) {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    if (savedGroups[groupIndex] && savedGroups[groupIndex].tabs) {
      savedGroups[groupIndex].tabs.splice(tabIndex, 1);
      if (savedGroups[groupIndex].tabs.length === 0) {
        savedGroups.splice(groupIndex, 1);
      }
      await chrome.storage.local.set({ savedGroups });
      loadGroups();
    }
  }

  // 1. Export JSON Backup
  btnExport.addEventListener('click', async () => {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    if (savedGroups.length === 0) {
      alert('Tidak ada data tab tersimpan untuk diexport.');
      return;
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(savedGroups, null, 2));
    const downloadAnchor = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `ram_lifesaver_backup_${dateStr}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  // 2. Import JSON Backup dengan Validasi Schema
  btnImport.addEventListener('click', () => {
    fileInput.click();
  });

  fileInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const importedData = JSON.parse(e.target.result);
        if (!Array.isArray(importedData)) {
          throw new Error('Data harus berupa array grup tab');
        }

        // Sanitasi dan validasi format
        const sanitized = importedData.filter(g => g && Array.isArray(g.tabs)).map(g => ({
          id: g.id || 'group_' + Math.random(),
          date: g.date || new Date().toLocaleString('id-ID'),
          tabs: g.tabs.filter(t => t && t.url && isValidHttpUrl(t.url)).map(t => ({
            title: String(t.title || t.url),
            url: String(t.url),
            favIconUrl: t.favIconUrl ? String(t.favIconUrl) : ''
          }))
        })).filter(g => g.tabs.length > 0);

        if (sanitized.length === 0) {
          alert('Tidak ditemukan data tab valid di dalam file backup.');
          return;
        }

        const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
        const combined = sanitized.concat(savedGroups);
        await chrome.storage.local.set({ savedGroups: combined });
        alert(`Berhasil mengimpor ${sanitized.length} grup tab!`);
        loadGroups();
      } catch (err) {
        alert('Gagal membaca file: ' + err.message);
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  // 3. Clear All
  btnClearAll.addEventListener('click', async () => {
    if (confirm('Yakin ingin menghapus seluruh riwayat tab yang disimpan?')) {
      await chrome.storage.local.set({ savedGroups: [] });
      loadGroups();
    }
  });

  loadGroups();
});

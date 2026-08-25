// RAM Lifesaver - Saved Tabs Manager Logic with Export & Import

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('groupsContainer');
  const emptyState = document.getElementById('emptyState');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const fileInput = document.getElementById('fileInput');

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
      dateSpan.textContent = `📅 Disimpan pada: ${group.date} (${group.tabs.length} tab)`;

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

      group.tabs.forEach((tab, tabIndex) => {
        const item = document.createElement('li');
        item.className = 'tab-item';

        const link = document.createElement('a');
        link.className = 'tab-link';
        link.href = tab.url;
        link.target = '_blank';

        if (tab.favIconUrl) {
          const icon = document.createElement('img');
          icon.className = 'tab-favicon';
          icon.src = tab.favIconUrl;
          icon.onerror = () => { icon.style.display = 'none'; };
          link.appendChild(icon);
        }

        const titleText = document.createTextNode(tab.title || tab.url);
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
    if (group && group.tabs) {
      for (const tab of group.tabs) {
        chrome.tabs.create({ url: tab.url, active: false });
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
    if (savedGroups[groupIndex]) {
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

  // 2. Import JSON Backup
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
        if (Array.isArray(importedData)) {
          const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
          const combined = importedData.concat(savedGroups);
          await chrome.storage.local.set({ savedGroups: combined });
          alert(`Berhasil mengimpor ${importedData.length} grup tab!`);
          loadGroups();
        } else {
          alert('Format file backup JSON tidak valid.');
        }
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

// RAM Lifesaver - Saved Tabs Manager Logic (Enhanced v1.2)

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('groupsContainer');
  const emptyState = document.getElementById('emptyState');
  const btnClearAll = document.getElementById('btnClearAll');
  const btnExport = document.getElementById('btnExport');
  const btnImport = document.getElementById('btnImport');
  const btnCopyAllMd = document.getElementById('btnCopyAllMd');
  const fileInput = document.getElementById('fileInput');
  const searchInput = document.getElementById('searchInput');
  const btnClearSearch = document.getElementById('btnClearSearch');
  const searchResultsCount = document.getElementById('searchResultsCount');
  const toastMessage = document.getElementById('toastMessage');

  let activeSearchQuery = '';
  let editingGroupId = null;

  // Helper untuk memvalidasi protokol URL
  function isValidHttpUrl(string) {
    try {
      const url = new URL(string);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  // Toast feedback floating
  function showToast(text) {
    if (!toastMessage) return;
    toastMessage.textContent = text;
    toastMessage.classList.remove('hidden');
    setTimeout(() => {
      toastMessage.classList.add('hidden');
    }, 2500);
  }

  // Render semua grup tab
  async function loadGroups() {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');

    if (savedGroups.length === 0) {
      emptyState.style.display = 'block';
      emptyState.querySelector('h3').textContent = 'Belum ada tab yang disimpan';
      emptyState.querySelector('p').textContent = 'Gunakan tombol "Satukan Tab (OneTab Mode)" di popup ekstensi untuk menyimpan dan meringkas tab aktif Anda.';
      container.innerHTML = '';
      container.appendChild(emptyState);
      searchResultsCount.textContent = '';
      return;
    }

    const query = activeSearchQuery.trim().toLowerCase();
    container.innerHTML = '';

    let totalMatchingTabs = 0;
    let totalMatchingGroups = 0;

    savedGroups.forEach((group, groupIndex) => {
      const allTabs = group.tabs || [];
      const groupTitle = group.title || '';
      const groupDate = group.date || 'Tanpa Tanggal';
      const isGroupTitleMatch = query && groupTitle.toLowerCase().includes(query);

      // Filter tab yang sesuai dengan query
      const matchingTabs = allTabs.map((tab, originalIndex) => ({ tab, originalIndex })).filter(({ tab }) => {
        if (!query || isGroupTitleMatch) return true;
        const titleMatch = (tab.title || '').toLowerCase().includes(query);
        const urlMatch = (tab.url || '').toLowerCase().includes(query);
        return titleMatch || urlMatch;
      });

      if (query && matchingTabs.length === 0) {
        return; // Lewati grup jika tidak ada tab yang cocok
      }

      totalMatchingGroups++;
      totalMatchingTabs += matchingTabs.length;

      const card = document.createElement('div');
      card.className = group.color ? `group-card color-border-${group.color}` : 'group-card';

      // Header Grup
      const groupHeader = document.createElement('div');
      groupHeader.className = 'group-header';

      // Meta (Judul & Tanggal)
      const groupMeta = document.createElement('div');
      groupMeta.className = 'group-meta';

      const titleRow = document.createElement('div');
      titleRow.className = 'group-title-row';

      if (editingGroupId === group.id) {
        // Mode Edit Nama Grup
        const renameGroup = document.createElement('div');
        renameGroup.className = 'rename-input-group';

        const inputRename = document.createElement('input');
        inputRename.type = 'text';
        inputRename.className = 'rename-input';
        inputRename.value = group.title || '';
        inputRename.placeholder = 'Beri nama grup tab...';

        const btnSave = document.createElement('button');
        btnSave.className = 'btn-save-rename';
        btnSave.textContent = 'Simpan';
        btnSave.addEventListener('click', () => saveRenameGroup(groupIndex, inputRename.value));

        const btnCancel = document.createElement('button');
        btnCancel.className = 'btn-cancel-rename';
        btnCancel.textContent = 'Batal';
        btnCancel.addEventListener('click', () => {
          editingGroupId = null;
          loadGroups();
        });

        inputRename.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            saveRenameGroup(groupIndex, inputRename.value);
          } else if (e.key === 'Escape') {
            editingGroupId = null;
            loadGroups();
          }
        });

        renameGroup.appendChild(inputRename);
        renameGroup.appendChild(btnSave);
        renameGroup.appendChild(btnCancel);
        titleRow.appendChild(renameGroup);

        setTimeout(() => inputRename.focus(), 50);
      } else {
        // Mode Normal Display Nama Grup
        if (group.color) {
          const colorDot = document.createElement('span');
          colorDot.className = `group-color-dot color-${group.color}`;
          titleRow.appendChild(colorDot);
        }

        const titleSpan = document.createElement('span');
        titleSpan.className = 'group-title';
        titleSpan.textContent = group.title || `Grup Sesi (${allTabs.length} tab)`;

        const btnRename = document.createElement('button');
        btnRename.className = 'btn-rename';
        btnRename.title = 'Ubah nama grup';
        btnRename.innerHTML = '✏️ Rename';
        btnRename.addEventListener('click', () => {
          editingGroupId = group.id;
          loadGroups();
        });

        titleRow.appendChild(titleSpan);
        titleRow.appendChild(btnRename);
      }

      const dateSpan = document.createElement('span');
      dateSpan.className = 'group-date';
      dateSpan.textContent = `📅 ${groupDate} • ${allTabs.length} total tab${query ? ` (${matchingTabs.length} cocok)` : ''}`;

      groupMeta.appendChild(titleRow);
      groupMeta.appendChild(dateSpan);

      // Action Buttons
      const actionsDiv = document.createElement('div');
      actionsDiv.className = 'group-actions';

      const btnCopyMd = document.createElement('button');
      btnCopyMd.className = 'btn btn-copy-md';
      btnCopyMd.innerHTML = '📋 Markdown';
      btnCopyMd.title = 'Salin daftar tab ini ke format Markdown';
      btnCopyMd.addEventListener('click', () => copyGroupToMarkdown(group));

      const btnRestoreGroup = document.createElement('button');
      btnRestoreGroup.className = 'btn btn-restore';
      btnRestoreGroup.textContent = 'Buka Semua';
      btnRestoreGroup.addEventListener('click', () => restoreGroup(groupIndex));

      const btnDeleteGroup = document.createElement('button');
      btnDeleteGroup.className = 'btn btn-danger';
      btnDeleteGroup.textContent = 'Hapus';
      btnDeleteGroup.addEventListener('click', () => deleteGroup(groupIndex));

      actionsDiv.appendChild(btnCopyMd);
      actionsDiv.appendChild(btnRestoreGroup);
      actionsDiv.appendChild(btnDeleteGroup);

      groupHeader.appendChild(groupMeta);
      groupHeader.appendChild(actionsDiv);
      card.appendChild(groupHeader);

      // List Tab
      const tabList = document.createElement('ul');
      tabList.className = 'tab-list';

      matchingTabs.forEach(({ tab, originalIndex }) => {
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
        btnRemove.addEventListener('click', () => removeTabFromGroup(groupIndex, originalIndex));

        item.appendChild(link);
        item.appendChild(btnRemove);
        tabList.appendChild(item);
      });

      card.appendChild(tabList);
      container.appendChild(card);
    });

    // Update status pencarian
    if (query) {
      if (totalMatchingTabs === 0) {
        emptyState.style.display = 'block';
        emptyState.querySelector('h3').textContent = 'Tidak ada tab yang cocok';
        emptyState.querySelector('p').textContent = `Tidak ditemukan tab yang mengandung kata kunci "${query}".`;
        container.innerHTML = '';
        container.appendChild(emptyState);
      }
      searchResultsCount.textContent = `Menampilkan ${totalMatchingTabs} tab dari ${totalMatchingGroups} grup`;
    } else {
      searchResultsCount.textContent = '';
    }
  }

  // 1. Rename Grup Tab
  async function saveRenameGroup(groupIndex, newTitle) {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    if (savedGroups[groupIndex]) {
      savedGroups[groupIndex].title = (newTitle || '').trim();
      await chrome.storage.local.set({ savedGroups });
      editingGroupId = null;
      loadGroups();
      showToast('✏️ Nama grup berhasil diubah!');
    }
  }

  // 2. Salin Grup ke Markdown
  function copyGroupToMarkdown(group) {
    const title = group.title || `Tab Tersimpan (${group.date || ''})`;
    let md = `### ${title}\n`;
    (group.tabs || []).forEach(tab => {
      const tabTitle = (tab.title || tab.url || 'Link').replace(/[\[\]]/g, '');
      md += `- [${tabTitle}](${tab.url})\n`;
    });

    navigator.clipboard.writeText(md).then(() => {
      showToast('📋 Format Markdown disalin ke clipboard!');
    }).catch(() => {
      alert('Gagal menyalin ke clipboard.');
    });
  }

  // 3. Salin Semua Grup ke Markdown
  btnCopyAllMd.addEventListener('click', async () => {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    if (savedGroups.length === 0) {
      alert('Tidak ada tab tersimpan untuk disalin.');
      return;
    }

    let allMd = `# ⚡ RAM Lifesaver — Tab Tersimpan Backup\n\n`;
    savedGroups.forEach((group, i) => {
      const title = group.title || `Grup Sesi ${i + 1} (${group.date || ''})`;
      allMd += `## ${title}\n`;
      (group.tabs || []).forEach(tab => {
        const tabTitle = (tab.title || tab.url || 'Link').replace(/[\[\]]/g, '');
        allMd += `- [${tabTitle}](${tab.url})\n`;
      });
      allMd += '\n';
    });

    navigator.clipboard.writeText(allMd).then(() => {
      showToast('📋 Seluruh tab berhasil disalin sebagai Markdown!');
    }).catch(() => {
      alert('Gagal menyalin ke clipboard.');
    });
  });

  // 4. Search Filter Input Handler
  searchInput.addEventListener('input', (e) => {
    activeSearchQuery = e.target.value;
    if (activeSearchQuery.length > 0) {
      btnClearSearch.style.display = 'block';
    } else {
      btnClearSearch.style.display = 'none';
    }
    loadGroups();
  });

  btnClearSearch.addEventListener('click', () => {
    searchInput.value = '';
    activeSearchQuery = '';
    btnClearSearch.style.display = 'none';
    loadGroups();
  });

  // 5. Restore, Delete, Remove Tab
  async function restoreGroup(groupIndex) {
    const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
    const group = savedGroups[groupIndex];
    if (group && Array.isArray(group.tabs)) {
      const createdTabIds = [];
      for (const tab of group.tabs) {
        if (tab && tab.url && isValidHttpUrl(tab.url)) {
          const created = await chrome.tabs.create({ url: tab.url, active: false });
          if (created && created.id) {
            createdTabIds.push(created.id);
          }
        }
      }

      // Recreate Tab Group bawaan browser jika ada lebih dari 1 tab atau memiliki nama grup
      if (chrome.tabs.group && createdTabIds.length > 0) {
        try {
          const newGroupId = await chrome.tabs.group({ tabIds: createdTabIds });
          const updateProps = {};
          if (group.title && group.title !== 'Tab Lainnya') {
            updateProps.title = group.title;
          }
          if (group.color) {
            updateProps.color = group.color;
          }
          if (Object.keys(updateProps).length > 0 && chrome.tabGroups) {
            await chrome.tabGroups.update(newGroupId, updateProps);
          }
        } catch (err) {
          console.error('Gagal mengelompokkan tab saat restore:', err);
        }
      }

      savedGroups.splice(groupIndex, 1);
      await chrome.storage.local.set({ savedGroups });
      loadGroups();
      showToast('🚀 Tab dibuka di jendela browser');
    }
  }

  async function deleteGroup(groupIndex) {
    if (confirm('Yakin ingin menghapus seluruh tab dalam grup ini?')) {
      const { savedGroups = [] } = await chrome.storage.local.get('savedGroups');
      savedGroups.splice(groupIndex, 1);
      await chrome.storage.local.set({ savedGroups });
      loadGroups();
      showToast('🗑️ Grup berhasil dihapus');
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

  // 6. Export JSON Backup
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

  // 7. Import JSON Backup dengan Validasi Schema
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
          title: g.title ? String(g.title) : '',
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
        showToast(`📥 Berhasil mengimpor ${sanitized.length} grup tab!`);
        loadGroups();
      } catch (err) {
        alert('Gagal membaca file: ' + err.message);
      }
      fileInput.value = '';
    };
    reader.readAsText(file);
  });

  // 8. Clear All
  btnClearAll.addEventListener('click', async () => {
    if (confirm('Yakin ingin menghapus seluruh riwayat tab yang disimpan?')) {
      await chrome.storage.local.set({ savedGroups: [] });
      loadGroups();
      showToast('🗑️ Seluruh riwayat tab dihapus');
    }
  });

  loadGroups();
});

// RAM Lifesaver - Form Unsaved Input Protector Content Script
// Mendeteksi apakah pengguna sedang mengetik atau memiliki data form yang belum disubmit

(function() {
  // Fungsi memeriksa apakah ada elemen form yang memiliki input belum tersimpan
  function hasUnsavedInput() {
    try {
      // 1. Periksa elemen input standar (teks, email, password, number, search, tel, url, textarea)
      const inputs = document.querySelectorAll(
        'input:not([type="hidden"]):not([type="submit"]):not([type="button"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="file"]), textarea'
      );

      for (const el of inputs) {
        if (el.value && el.value.trim().length > 0) {
          // Jika nilai berbeda dari nilai awal (defaultValue) atau jika textarea memiliki teks
          if (el.value !== el.defaultValue) {
            return true;
          }
        }
      }

      // 2. Periksa rich text editors / contenteditable (Docs, Notion, Quill, TinyMCE, dll)
      const editables = document.querySelectorAll('[contenteditable="true"], [contenteditable=""], .ProseMirror, .monaco-editor');
      for (const el of editables) {
        const text = el.innerText || el.textContent || '';
        if (text.trim().length > 0) {
          // Jika elemen sedang difokuskan atau memiliki konten yang diedit
          if (document.activeElement === el || text.trim().length > 10) {
            return true;
          }
        }
      }
    } catch (e) {
      // Jika terjadi error pada akses DOM, default aman (false)
    }

    return false;
  }

  // Listener pesan dari background service worker
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request && request.type === 'CHECK_FORM_DIRTY') {
      const isDirty = hasUnsavedInput();
      sendResponse({ isDirty });
    }
    return true;
  });
})();

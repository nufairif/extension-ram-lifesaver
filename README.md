# ⚡ RAM Lifesaver — Brave & Chrome Memory Optimizer

**RAM Lifesaver** adalah ekstensi browser berbasis Manifest V3 yang dirancang untuk mengoptimalkan dan memangkas penggunaan RAM secara drastis pada browser **Brave**, **Google Chrome**, dan peramban berbasis **Chromium** lainnya.

---

## ✨ Fitur Utama

- 💤 **Auto Tab Discard (Smart Sleep):** Otomatis menidurkan tab yang tidak aktif setelah durasi tertentu (1, 3, 5, 10, atau 15 menit) untuk membebaskan ratusan megabyte RAM.
- 🎵 **Audio & Pin Immunity:** Tab yang sedang memutar suara (YouTube, Spotify) dan tab yang dipin (*pinned*) aman dari proses peniduran.
- 🛡️ **Whitelist Domain:** Tentukan website penting (seperti WhatsApp Web, Gmail, Discord) agar tidak pernah ditidurkan.
- 📑 **OneTab Mode (Satukan Tab):** Mengumpulkan seluruh tab latar belakang ke dalam satu daftar tautan dan menutup halamannya, memangkas penggunaan RAM hingga **95%**.
- 🔍 **Duplicate Tab Cleaner:** Mendeteksi dan menutup tab kembar secara otomatis atau manual dengan satu klik.
- 🎬 **YouTube Background Throttler:** Menurunkan resolusi video ke 144p saat tab YouTube berada di latar belakang untuk menghemat decoding memori, VRAM, dan bandwidth internet.
- 🚨 **Tab Limiter & Live Badge:** Menampilkan jumlah tab aktif secara real-time pada ikon ekstensi dan memberi sinyal merah jika melewati ambang batas maksimal.
- ⌨️ **Shortcut Keyboard (Hotkeys):**
  - `Alt + S` : Tidurkan tab aktif saat ini.
  - `Alt + Shift + S` : Tidurkan seluruh tab di latar belakang seketika.
- 💾 **Export & Import Backup:** Simpan cadangan riwayat tab tersimpan ke format JSON dan pulihkan kapan saja.

---

## 📥 Cara Instalasi (Developer Mode)

1. **Clone repository ini:**
   ```bash
   git clone https://github.com/nufairif/extension-ram-lifesaver.git
   ```
2. Buka browser Brave atau Chrome, lalu buka alamat:
   ```text
   brave://extensions  (atau chrome://extensions)
   ```
3. Aktifkan **Developer mode** (Mode pengembang) di pojok kanan atas.
4. Klik **Load unpacked** (Muat yang belum dibongkar) di pojok kiri atas.
5. Pilih folder repository ini (`extension-ram-lifesaver`).
6. Ekstensi **RAM Lifesaver** ⚡ siap digunakan!

---

## 📂 Struktur Proyek

```text
├── icons/                  # Icon ekstensi (16x16, 48x48, 128x128)
├── manifest.json           # Konfigurasi Manifest V3
├── background.js           # Service worker pengelola alarm, memory discarding & hotkeys
├── youtube_optimizer.js    # Content script penurun resolusi video background
├── popup.html / .css / .js # UI Dashboard, Pengaturan, Whitelist, & Hotkey
├── saved.html / .css / .js # Halaman manajer OneTab (restore & export/import)
└── README.md
```

---

## 📄 Lisensi
MIT License © 2026 [nufairif](https://github.com/nufairif)

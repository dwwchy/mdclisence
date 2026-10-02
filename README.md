# 🏛️ MDC.Dev • License Admin Multi-Tool Web Portal
> **Progressive Web App (PWA) & Control Center Lisensi Multi-Tool Berbasis Cloud**

Web Portal ini dirancang khusus agar Anda dapat mengelola lisensi seluruh software MDC.Dev (seperti **RE-Merger Pro**, **Suno Downloader**, **Auto Massal Video**, dsb.) langsung dari **Handphone (Android / iOS)** maupun Komputer dengan sangat cepat, mulus (*anti-lemot*), dan **100% permanen bebas kadaluarsa**.

---

## 🌟 Keunggulan Menggunakan GitHub Pages PWA

1. **Portabilitas 100% (Sangat Mudah Saat Ganti HP Baru)**:
   - Tidak perlu repot kirim-kirim file APK atau menghubungkan kabel USB ke laptop.
   - Saat Anda ganti HP, cukup buka link GitHub Pages Anda di browser HP baru, lalu ketuk **"Instal Aplikasi"** / **"Tambahkan ke Layar Utama"**. Dalam 5 detik aplikasi langsung terpasang!
2. **Bebas Masalah Multi-Akun Google**:
   - Berjalan pada domain HTTPS independen milik Anda sendiri di GitHub Pages, sehingga terbebas dari bug pengalihan multi-akun yang sering terjadi di Google Apps Script.
3. **Bebas Kadaluarsa Selamanya**:
   - Berbeda dari APK bawaan generator trial (seperti Appilix) yang memiliki batas waktu kedaluwarsa, GitHub Pages PWA ini aktif selamanya tanpa biaya bulanan / tahunan.
4. **Auto-Update & Real-Time Sync**:
   - Terhubung langsung ke Google Sheets Anda secara *real-time*. Jika ada lisensi yang diperpanjang di HP, software pembeli langsung aktif seketika.

---

## 🚀 Panduan Setup GitHub Pages (Hanya 2 Menit)

### Langkah 1: Buat Repositori di GitHub
1. Buka [github.com](https://github.com) dan login ke akun Anda.
2. Klik tombol hijau **New** (Buat Repositori Baru).
3. Beri nama repositori, misalnya: `mdc-license-admin`.
4. Pilih opsi **Public** (agar GitHub Pages gratis dapat aktif).
5. Klik **Create repository**.

### Langkah 2: Unggah File
1. Di halaman repositori baru Anda, klik tautan **uploading an existing file**.
2. Tarik dan lepas (*drag and drop*) seluruh file dari folder ini:
   - `index.html`
   - `manifest.json`
   - `sw.js`
   - folder `icons/`
   - folder `backend/`
   - folder `desktop/`
3. Klik tombol hijau **Commit changes**.

### Langkah 3: Aktifkan Fitur GitHub Pages
1. Di repositori Anda, klik menu tab **Settings** di bagian atas.
2. Di menu bilah kiri, klik **Pages**.
3. Pada bagian **Build and deployment > Branch**:
   - Ubah dari `None` menjadi **`main`** (atau `master`).
   - Biarkan foldernya tetap **`/(root)`**.
   - Klik tombol **Save**.
4. Tunggu sekitar 1–2 menit, lalu segarkan (*refresh*) halaman Settings Pages.
5. Link aplikasi Anda akan muncul di bagian atas, contohnya:
   ```
   https://username-anda.github.io/mdc-license-admin/
   ```

---

## 📱 Cara Memasang di HP Baru (Tampil Layar Penuh Persis Aplikasi)

1. Buka link GitHub Pages Anda di browser HP:
   - **Di Android (Google Chrome):**
     Ketuk menu titik tiga (⋮) di pojok kanan atas > pilih **"Instal aplikasi"** atau **"Tambahkan ke Layar Utama"**.
   - **Di iPhone (Safari):**
     Ketuk tombol Share (kotak dengan panah ke atas di bagian bawah) > pilih **"Add to Home Screen"** (*Tambahkan ke Layar Utama*).
2. Ikon **MDC License Admin** berlogo Cyber-Neon akan muncul di menu aplikasi HP Anda.
3. Buka aplikasinya, masukkan **PIN: 2026** (atau PIN kustom Anda).
4. Portal siap digunakan kapan saja dan di mana saja!

---

## ⚙️ Fitur Pengaturan Server API Dinamis
Jika suatu saat Anda mengganti URL deployment Google Apps Script Anda:
- Pada layar login (saat memasukkan PIN), ketuk **"⚙️ Pengaturan URL Server API"**.
- Tempelkan URL Google Apps Script yang baru, lalu klik **Simpan**.
- Aplikasi akan otomatis terhubung ke server baru tanpa perlu mengubah kode sumber di GitHub!

---

## 📁 Struktur Repositori
- `index.html` : Aplikasi Web & PWA Portal Admin Mobile
- `manifest.json` : Konfigurasi Web App Manifest
- `sw.js` : Service Worker untuk performa secepat kilat & offline shell
- `icons/` : Aset ikon resolusi tinggi (192px & 512px)
- `backend/` : Salinan kode `google_apps_script_backend.js` (Versi 2.3)
- `desktop/` : Salinan software desktop Windows (`admin_app.py`)

---
Ditetapkan dan Dipatenkan oleh **MDC.Dev • 2026**

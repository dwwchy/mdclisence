# 🏛️ STANDAR KODE AWALAN (PREFIX 3 HURUF) LISENSI TOOLS MDC.Dev

Dokumen ini merupakan panduan paten penamaan kode lisensi (Hardware AppID) untuk seluruh aplikasi di bawah naungan **MDC.Dev**.

---

## 🔒 1. Jaminan Keamanan: Apakah Lisensi Lama Akan Hilang?

> [!IMPORTANT]
> **TIDAK AKAN HILANG SAMA SEKALI (100% AMAN).**
> Seluruh lisensi yang saat ini sudah aktif tetap aman karena:
> 1. **Sistem Salin Aman (*Non-Destructive*):** Saat tombol *"Pisahkan Data Sheet1"* dijalankan, sistem **menyalin (copy)** setiap baris lisensi ke tab sheet tool masing-masing (`Suno Downloader` dan `RE-Merger Pro`), dan sheet lama otomatis diarsipkan sebagai `_Backup_Sheet1` sehingga tidak ada 1 baris pun data yang terhapus.
> 2. **Offline Cache di Laptop Pembeli:** Setiap software pembeli yang sudah aktif memiliki file cache terenkripsi `.license_cache` di laptop mereka.
> 3. **Smart Search Multi-Sheet:** Saat software pembeli melakukan verifikasi lisensi ke server, backend otomatis memeriksa di semua tab sheet yang ada (bahkan sheet lama), sehingga aplikasi pembeli **tidak akan pernah terkunci atau gagal verifikasi**.

---

## 🏷️ 2. Standar Format AppID 3 Huruf

Format baku AppID untuk seluruh software MDC.Dev adalah:
```text
[PREFIX]-[XXXX]-[XXXX]-[XXXX]
```
Contoh:
- `SND-356E-8A5F-95C0`
- `REM-4CA4-C118-565E`
- `AMV-4CA4-C118-565E` (atau `AVM-...`)
- `ORB-4CA4-C118-565E`

---

## 📋 3. Daftar Kode Awalan (Prefix) Bawaan

| Prefix | Nama Tool / Sheet Tab | Keterangan |
|---|---|---|
| `MDC` | **Paket Bundle** | **All-in-One Multi-Tool** (Membuka 3 Tools Sekaligus) |
| `SND` | **Suno Downloader** | Sudah aktif (16+ pengguna) |
| `REM` | **RE-Merger Pro** | Sudah aktif (DWI, Admin) |
| `AMV` / `AVM` | **Auto Massal Video** | Siap digunakan kapan saja |
| `ORB` / `OBA` | **Orbit Analyzer** | Siap digunakan kapan saja |
| `ADC` | **Adcut Analyzer** | Siap digunakan kapan saja |

---

## 🚀 4. Cara Menambahkan Tool Baru & Menentukan Prefix Sendiri

Anda bebas menentukan 3 huruf apa saja untuk tool baru (misal: `AVM` untuk Auto Massal Video, `TKB` untuk TikTok Bot, dll.).

### Cara Menambahkan lewat Desktop (`MDC-License-Admin.exe`):
1. Buka aplikasi **MDC License Admin**.
2. Klik tombol **`➕ Buat Sheet Tool Baru`** di pojok kanan atas.
3. Masukkan **Nama Tool** (contoh: `Auto Massal Video`).
4. Masukkan **Kode Awalan 3 Huruf** (contoh: `AVM`).
5. **Selesai!** 
   - Tab Sheet baru langsung otomatis muncul di Google Spreadsheet Anda dengan header rapi.
   - Di aplikasi Admin, saat Anda mengetik atau paste AppID berawalan `AVM-...`, sistem akan **otomatis memilih tool Auto Massal Video** tanpa perlu dipilih manual!

### Cara Menambahkan lewat HP (Web App PWA):
1. Buka link Web App di browser HP Anda.
2. Di baris tab atas, geser ke kanan lalu tap **`➕ Buat Sheet Tool Baru`**.
3. Masukkan Nama Tool dan Kode 3 Huruf-nya.
4. Sheet baru langsung tercipta di Google Spreadsheet detik itu juga!

---

## 💻 5. Potongan Kode Client untuk Tool Baru

Setiap kali Anda membuat tool baru (berbasis Python atau JS/Electron), gunakan fungsi penghasil Hardware ID standar ini:

### Versi Python:
```python
import hashlib, subprocess, os, uuid

TOOL_PREFIX = "AVM"  # <-- Ganti 3 huruf sesuai tool Anda (misal: AVM / AMV / ORB)

def get_hardware_id() -> str:
    raw_id = ""
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY)
        guid, _ = winreg.QueryValueEx(key, "MachineGuid")
        winreg.CloseKey(key)
        if guid: raw_id += str(guid).strip()
    except Exception:
        pass
    if not raw_id:
        raw_id = f"{uuid.getnode()}_{os.environ.get('COMPUTERNAME', '')}"

    sha = hashlib.sha256(raw_id.encode("utf-8")).hexdigest().upper()
    return f"{TOOL_PREFIX}-{sha[0:4]}-{sha[4:8]}-{sha[8:12]}"
```

### Versi JavaScript / Node.js (Electron):
```javascript
const crypto = require('crypto');
const { execSync } = require('child_process');

const TOOL_PREFIX = 'AVM'; // <-- Ganti 3 huruf sesuai tool Anda

function getHardwareId() {
  let rawId = '';
  try {
    const regOut = execSync('reg query "HKLM\\SOFTWARE\\Microsoft\\Cryptography" /v MachineGuid', { encoding: 'utf-8' });
    const match = regOut.match(/MachineGuid\s+REG_SZ\s+(\S+)/i);
    if (match && match[1]) rawId = match[1].trim();
  } catch {}
  if (!rawId) rawId = `${process.env.COMPUTERNAME || 'PC'}_MDC`;

  const hash = crypto.createHash('sha256').update(rawId, 'utf-8').digest('hex').toUpperCase();
  return `${TOOL_PREFIX}-${hash.slice(0, 4)}-${hash.slice(4, 8)}-${hash.slice(8, 12)}`;
}
```

---

## 📱 6. Fitur Konversi AppID ke QR Code untuk Scan Kilat di HP

Untuk mempercepat proses aktivasi saat order ramai, pembeli tidak perlu mengetik kode panjang. Software Anda bisa langsung menampilkan **QR Code AppID**.

### Cara Menampilkan QR di Software Client (Python CustomTkinter):
Gunakan modul pembantu `tampilkan_qr_client_helper.py` yang sudah kami sediakan di folder ini:

```python
from tampilkan_qr_client_helper import show_qr_popup_customtkinter

# Saat tombol "Aktivasi" atau "Tampilkan QR" diklik di software Anda:
my_appid = get_hardware_id()
show_qr_popup_customtkinter(root, my_appid, "Auto Massal Video")
```

### Alur Aktivasi Kilat oleh Admin via HP:
1. Pembeli membuka software, QR Code AppID otomatis muncul di layar laptopnya (atau pembeli mengirim screenshot QR tersebut via WhatsApp).
2. Admin membuka Web App di HP, lalu ketuk tombol **`📷 Scan`** di samping kotak AppID.
3. Arahkan kamera HP ke layar pembeli (atau pilih file screenshot jika dikirim lewat WA).
4. **Beep!** Kode AppID otomatis terisi, dan tool (misal: *Suno Downloader*, *RE-Merger*, atau *Auto Massal Video*) **otomatis terpilih sendiri** berdasarkan kode awalannya.
5. Admin hanya tinggal mengetik **Nama Pembeli** lalu ketuk **⚡ AKTIFKAN SEKARANG**! Selesai dalam 3 detik!

---
*Ditetapkan dan Dipatenkan oleh MDC.Dev • 2026*

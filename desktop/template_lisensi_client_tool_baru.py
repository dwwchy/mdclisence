"""
========================================================================
     🏛️ MDC.Dev • TEMPLATE RESMI SISTEM LISENSI & QR CODE SOFTWARE BARU
========================================================================
Cukup salin (copy) file ini ke proyek software baru Anda!
Anda HANYA PERLU MENGUBAH 2 BARIS di bawah ini:
1. TOOL_NAME   : Nama software Anda (Contoh: "TikTok Bot")
2. TOOL_PREFIX : Kode awalan 3 huruf (Contoh: "TKB")

Begitu software dibuka di laptop pembeli:
✅ Otomatis mendeteksi Hardware ID laptop pembeli
✅ Otomatis membuatkan BARCODE / QR CODE di layar software
✅ Pembeli tinggal menunjukkan layar laptop ke HP Admin
✅ Admin tinggal klik "📷 Scan" di HP -> Langsung Aktif!
========================================================================
"""

import os
import sys
import json
import uuid
import hashlib
import urllib.request
import urllib.parse
from datetime import datetime
import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk
import customtkinter as ctk

# ========================================================================
# ⚙️ 1. KONFIGURASI TOOL ANDA (UBAH 2 BARIS INI SAJA!)
# ========================================================================
TOOL_NAME = "Software Baru MDC"    # <-- Ganti dengan nama software Anda
TOOL_PREFIX = "NEW"                 # <-- Ganti dengan 3 huruf awalan (misal: TKB, AMV, ADC)

# URL Backend Google Apps Script resmi MDC.Dev
API_URL = "https://script.google.com/macros/s/AKfycbzK0fCAMv6AZz8fL3L23CShQkmFKmoVJPVUoN20_hjAgvh5QIoP43H0Fmfjt3E3SPU8hA/exec"
CACHE_FILE = f".{TOOL_PREFIX.lower()}_license_cache.json"


# ========================================================================
# 🔑 2. GENERATOR HARDWARE ID OTOMATIS
# ========================================================================
def get_hardware_id() -> str:
    """Menghasilkan AppID unik permanen per laptop pembeli."""
    raw_id = ""
    try:
        import winreg
        key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SOFTWARE\Microsoft\Cryptography", 0, winreg.KEY_READ | winreg.KEY_WOW64_64KEY)
        guid, _ = winreg.QueryValueEx(key, "MachineGuid")
        winreg.CloseKey(key)
        if guid:
            raw_id += str(guid).strip()
    except Exception:
        pass

    if not raw_id:
        raw_id = f"{uuid.getnode()}_{os.environ.get('COMPUTERNAME', '')}"

    sha = hashlib.sha256(raw_id.encode("utf-8")).hexdigest().upper()
    return f"{TOOL_PREFIX}-{sha[0:4]}-{sha[4:8]}-{sha[8:12]}"


# ========================================================================
# 📱 3. GENERATOR GAMBAR BARCODE / QR CODE OTOMATIS
# ========================================================================
def get_qr_image(appid: str, size: int = 220) -> Image.Image:
    """Mengambil gambar QR Code dari AppID secara instan (100% Offline via modul qrcode)."""
    clean_id = str(appid).strip().upper()

    # 1. Prioritas Offline (Super Cepat < 0.001 detik tanpa internet)
    try:
        import qrcode
        qr = qrcode.QRCode(box_size=6, border=2)
        qr.add_data(clean_id)
        qr.make(fit=True)
        img = qr.make_image(fill_color="black", back_color="white").convert('RGB')
        return img.resize((size, size), Image.Resampling.LANCZOS)
    except Exception:
        pass

    # 2. Fallback online API jika module qrcode belum terpasang
    url = f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&margin=8&data={urllib.parse.quote(clean_id)}"
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            import io
            return Image.open(io.BytesIO(response.read()))
    except Exception:
        from PIL import ImageDraw
        img = Image.new('RGB', (size, size), color=(15, 23, 42))
        d = ImageDraw.Draw(img)
        d.text((20, size // 2 - 10), clean_id, fill=(0, 240, 255))
        return img


# ========================================================================
# 🌐 4. VERIFIKASI LISENSI KE GOOGLE SPREADSHEET
# ========================================================================
def check_license(hwid: str) -> dict:
    """Memeriksa status lisensi ke server backend."""
    params = urllib.parse.urlencode({
        "action": "check",
        "hwid": hwid,
        "tool": TOOL_NAME
    })
    try:
        req = urllib.request.Request(f"{API_URL}?{params}", headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req, timeout=12) as response:
            data = json.loads(response.read().decode("utf-8"))
            if data.get("valid"):
                # Simpan cache offline
                try:
                    with open(CACHE_FILE, "w") as f:
                        json.dump({"hwid": hwid, "cached_at": datetime.now().isoformat(), "data": data}, f)
                except Exception:
                    pass
            return data
    except Exception as e:
        # Periksa cache offline jika koneksi internet terputus
        if os.path.exists(CACHE_FILE):
            try:
                with open(CACHE_FILE, "r") as f:
                    cached = json.load(f)
                    if cached.get("hwid") == hwid and cached.get("data", {}).get("valid"):
                        res = cached["data"]
                        res["message"] = "(Mode Offline) " + res.get("message", "")
                        return res
            except Exception:
                pass
        return {"valid": False, "status": "network_error", "message": f"Gagal terhubung ke server lisensi ({e})."}


# ========================================================================
# 🖥️ 5. JENDELA AKTIVASI DENGAN QR CODE OTOMATIS
# ========================================================================
class ActivationWindow(ctk.CTkToplevel):
    def __init__(self, parent, on_success_callback):
        super().__init__(parent)
        self.on_success = on_success_callback
        self.hwid = get_hardware_id()

        self.title(f"Aktivasi Lisensi • {TOOL_NAME}")
        self.geometry("380x560")
        self.resizable(False, False)
        self.attributes("-topmost", True)
        self.configure(fg_color="#070A11")

        # Header Cyber-Neon
        ctk.CTkLabel(self, text=TOOL_NAME.upper(), font=("Segoe UI", 16, "bold"), text_color="#00F0FF").pack(pady=(20, 2))
        ctk.CTkLabel(self, text="SISTEM KEAMANAN & LISENSI RESMI MDC.Dev", font=("Segoe UI", 8, "bold"), text_color="#8EA0B8").pack(pady=(0, 14))

        # Kotak QR Code Otomatis
        qr_card = ctk.CTkFrame(self, fg_color="#0F1626", border_color="#1B273D", border_width=1, corner_radius=14)
        qr_card.pack(padx=24, fill="x", pady=4)

        ctk.CTkLabel(qr_card, text="📱 SCAN QR INI UNTUK AKTIVASI KILAT", font=("Segoe UI", 11, "bold"), text_color="#38BDF8").pack(pady=(12, 6))

        # Tampilkan Gambar QR Code
        white_box = ctk.CTkFrame(qr_card, fg_color="#FFFFFF", corner_radius=10)
        white_box.pack(pady=4)

        try:
            pil_img = get_qr_image(self.hwid, size=180)
            ctk_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(180, 180))
            self.qr_label = ctk.CTkLabel(white_box, image=ctk_img, text="")
            self.qr_label.pack(padx=8, pady=8)
        except Exception:
            ctk.CTkLabel(white_box, text="[QR Code Error]", text_color="#000").pack(padx=20, pady=20)

        # Label AppID
        ctk.CTkLabel(qr_card, text=self.hwid, font=("Consolas", 13, "bold"), text_color="#00F0FF").pack(pady=(8, 2))
        
        # Tombol Salin AppID
        self.btn_copy = ctk.CTkButton(qr_card, text="📋 Salin AppID", width=140, height=28, fg_color="#141D2F", border_color="#1B273D", border_width=1, text_color="#F8FAFC", font=("Segoe UI", 10), command=self.copy_hwid)
        self.btn_copy.pack(pady=(2, 12))

        # Status text
        self.status_lbl = ctk.CTkLabel(self, text="Tunjukkan QR di atas ke Admin via HP.", font=("Segoe UI", 10), text_color="#8EA0B8")
        self.status_lbl.pack(pady=(10, 6))

        # Tombol Cek Aktivasi
        self.btn_check = ctk.CTkButton(self, text="⚡ SAYA SUDAH DIAKTIFKAN OLEH ADMIN", width=320, height=42, fg_color="#00F0FF", hover_color="#00C8D6", text_color="#000000", font=("Segoe UI", 12, "bold"), command=self.verify_activation)
        self.btn_check.pack(pady=6)

    def copy_hwid(self):
        self.clipboard_clear()
        self.clipboard_append(self.hwid)
        self.btn_copy.configure(text="✅ AppID Disalin!")
        self.after(1500, lambda: self.btn_copy.configure(text="📋 Salin AppID"))

    def verify_activation(self):
        self.btn_check.configure(state="disabled", text="⏳ Memeriksa ke Server...")
        self.update()

        res = check_license(self.hwid)
        self.btn_check.configure(state="normal", text="⚡ SAYA SUDAH DIAKTIFKAN OLEH ADMIN")

        if res.get("valid"):
            messagebox.showinfo("Aktivasi Berhasil", f"Selamat! Lisensi {TOOL_NAME} Anda telah aktif!\n\nPaket: {res.get('plan')}\nSisa Waktu: {res.get('daysLeft')} hari")
            self.destroy()
            self.on_success()
        else:
            msg = res.get("message", "Perangkat belum terdaftar.")
            messagebox.showwarning("Belum Aktif", f"{msg}\n\nSilakan tunjukkan QR Code di atas kepada Admin untuk diaktifkan.")


# ========================================================================
# 🚀 6. CONTOH CARA MEMAKAI DI SOFTWARE ANDA
# ========================================================================
def start_my_app():
    """Fungsi utama software Anda setelah lisensi aktif."""
    print(f"🎉 Lisensi valid! Memulai aplikasi utama {TOOL_NAME}...")

    main_win = ctk.CTk()
    main_win.title(f"{TOOL_NAME} • Berhasil Masuk")
    main_win.geometry("500x300")
    
    ctk.CTkLabel(main_win, text=f"SELAMAT DATANG DI {TOOL_NAME.upper()}!", font=("Segoe UI", 16, "bold"), text_color="#00F0FF").pack(pady=40)
    ctk.CTkLabel(main_win, text="Lisensi software Anda aktif dan terverifikasi secara resmi.", text_color="#CBD5E1").pack()
    
    main_win.mainloop()


def main():
    """Fungsi peluncur yang memeriksa lisensi sebelum membuka aplikasi."""
    ctk.set_appearance_mode("dark")
    
    # Buat jendela root tersembunyi untuk pengecekan awal
    root = ctk.CTk()
    root.withdraw()

    my_hwid = get_hardware_id()
    print(f"[{TOOL_NAME}] Hardware ID: {my_hwid}")

    # Cek apakah lisensi sudah aktif
    res = check_license(my_hwid)
    if res.get("valid"):
        print(f"[{TOOL_NAME}] Lisensi sudah aktif ({res.get('plan')}). Langsung membuka software.")
        root.destroy()
        start_my_app()
    else:
        print(f"[{TOOL_NAME}] Lisensi belum aktif. Menampilkan jendela aktivasi QR...")
        def on_success():
            root.destroy()
            start_my_app()
        
        act_win = ActivationWindow(root, on_success)
        root.mainloop()


if __name__ == "__main__":
    main()

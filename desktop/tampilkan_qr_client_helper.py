"""
========================================================================
     🏛️ MDC.Dev • MODUL GENERATOR QR CODE UNTUK SOFTWARE KLIEN
========================================================================
Modul ini dapat dipasang pada software client buatan Anda:
- Suno Downloader
- RE-Merger Pro
- Auto Massal Video
- Orbit Analyzer, dll.

Fungsi: Menampilkan QR Code dari Hardware AppID pembeli di layar software.
Admin tinggal membuka HP -> tap "📷 Scan" -> AppID otomatis terisi sekejap!
========================================================================
"""

import io
import urllib.request
import urllib.parse
from PIL import Image

def get_qr_image_for_appid(appid: str, size: int = 240) -> Image.Image:
    """
    Mengambil gambar PIL Image QR Code dari AppID.
    Mendukung online fetch super cepat dan aman.
    """
    clean_id = str(appid).strip().upper()
    url = f"https://api.qrserver.com/v1/create-qr-code/?size={size}x{size}&margin=10&data={urllib.parse.quote(clean_id)}"
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=5) as response:
            img_data = response.read()
            return Image.open(io.BytesIO(img_data))
    except Exception as e:
        # Fallback offline jika tidak ada koneksi internet saat generate QR
        try:
            import qrcode
            qr = qrcode.QRCode(box_size=8, border=2)
            qr.add_data(clean_id)
            qr.make(fit=True)
            return qr.make_image(fill_color="black", back_color="white").convert('RGB')
        except ImportError:
            # Jika qrcode belum diinstall, buat gambar placeholder teks
            from PIL import ImageDraw
            img = Image.new('RGB', (size, size), color=(20, 20, 20))
            d = ImageDraw.Draw(img)
            d.text((20, size // 2 - 10), clean_id, fill=(0, 240, 255))
            return img


def show_qr_popup_customtkinter(parent, appid: str, tool_name: str = "Software MDC"):
    """
    Menampilkan popup jendela CustomTkinter berisi QR Code AppID.
    Panggil fungsi ini di software client Anda!
    
    Contoh penggunaan di software client:
    from tampilkan_qr_client_helper import show_qr_popup_customtkinter
    show_qr_popup_customtkinter(root, my_appid, "Suno Downloader")
    """
    import customtkinter as ctk
    
    popup = ctk.CTkToplevel(parent)
    popup.title(f"Aktivasi QR • {tool_name}")
    popup.geometry("340x440")
    popup.resizable(False, False)
    popup.attributes("-topmost", True)
    popup.configure(fg_color="#070A11")

    # Header
    ctk.CTkLabel(popup, text="📱 AKTIVASI KILAT VIA QR", font=("Segoe UI", 14, "bold"), text_color="#00F0FF").pack(pady=(16, 4))
    ctk.CTkLabel(popup, text="Tunjukkan QR ini ke Admin untuk aktivasi otomatis", font=("Segoe UI", 10), text_color="#8EA0B8").pack(pady=(0, 12))

    # Frame Gambar QR
    qr_frame = ctk.CTkFrame(popup, fg_color="#FFFFFF", corner_radius=12)
    qr_frame.pack(pady=6, padx=20)

    try:
        pil_img = get_qr_image_for_appid(appid, size=200)
        ctk_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(200, 200))
        img_label = ctk.CTkLabel(qr_frame, image=ctk_img, text="")
        img_label.pack(padx=10, pady=10)
    except Exception as e:
        ctk.CTkLabel(qr_frame, text=f"Gagal memuat QR:\n{e}", text_color="#000000").pack(padx=20, pady=20)

    # Teks AppID
    ctk.CTkLabel(popup, text=appid, font=("Consolas", 13, "bold"), text_color="#38BDF8").pack(pady=(10, 4))
    
    def copy_text():
        parent.clipboard_clear()
        parent.clipboard_append(appid)
        btn_copy.configure(text="✅ Disalin!")
        popup.after(1500, lambda: btn_copy.configure(text="📋 Salin AppID"))

    btn_copy = ctk.CTkButton(popup, text="📋 Salin AppID", width=140, height=32, fg_color="#141D2F", border_color="#1B273D", border_width=1, text_color="#FFFFFF", command=copy_text)
    btn_copy.pack(pady=6)


if __name__ == "__main__":
    import tkinter as tk
    root = tk.Tk()
    root.withdraw()
    test_id = "SND-356E-8A5F-95C0"
    print(f"Menguji generate QR untuk: {test_id}")
    img = get_qr_image_for_appid(test_id)
    print("Berhasil menghasilkan gambar QR:", img.size)

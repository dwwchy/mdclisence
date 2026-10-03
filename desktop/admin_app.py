"""
MDC.Dev License Admin • Multi-Tool Control Center
Desktop Management Software (Windows .EXE)
Theme: Cyber-Neon MDC.Dev
"""

import os
import sys
import json
import urllib.request
import urllib.parse
import threading
from datetime import datetime
import tkinter as tk
from tkinter import messagebox

from PIL import Image
import customtkinter as ctk

# Konfigurasi Tampilan Cyber-Neon
ctk.set_appearance_mode("dark")
ctk.set_default_color_theme("blue")

THEME = {
    "bg_main": "#070A11",        # Obsidian Deep Dark
    "card_bg": "#0D1424",        # Cyber Blue-Grey Slate
    "card_border": "#1B273D",    # Card Border
    "card_inner": "#121A2C",     # Inner container
    "cyan_neon": "#00F0FF",      # Electric Neon Cyan
    "cyan_glow": "#00C8D6",
    "cyan_dim": "#082B36",       # Dim Cyan
    "text_white": "#F8FAFC",
    "text_label": "#CBD5E1",     # Crisp Readable Label
    "text_muted": "#8EA0B8",     # Muted secondary text
    "text_cyan": "#38BDF8",
    "input_bg": "#0B101D",
    "input_border": "#1E2C44",
    "danger": "#F43F5E",
    "danger_hover": "#E11D48",
    "danger_dim": "#35101A",
    "success": "#10B981",
    "success_dim": "#063A2A",
    "warning": "#F59E0B",
    "warning_dim": "#3B2606",
    "purple_neon": "#A855F7",
    "purple_dim": "#2E1065"
}

if getattr(sys, 'frozen', False):
    BASE_DIR = getattr(sys, '_MEIPASS', os.path.dirname(sys.executable))
    APP_DIR = os.path.dirname(sys.executable)
else:
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    APP_DIR = BASE_DIR

CONFIG_FILE = os.path.join(APP_DIR, "license_config.json")
ADMIN_CACHE_FILE = os.path.join(APP_DIR, ".admin_license_cache.json")
LOGO_PATH = os.path.join(BASE_DIR, "assets", "logo_circular.png")
ICO_PATH = os.path.join(BASE_DIR, "assets", "logo.ico")

DEFAULT_API_URL = "https://script.google.com/macros/s/AKfycbzK0fCAMv6AZz8fL3L23CShQkmFKmoVJPVUoN20_hjAgvh5QIoP43H0Fmfjt3E3SPU8hA/exec"

DEFAULT_PREFIX_MAP = {
    "MDC": "Paket Bundle",
    "BDL": "Paket Bundle",
    "REM": "RE-Merger Pro",
    "SND": "Suno Downloader",
    "AMV": "Auto Massal Video",
    "AVM": "Auto Massal Video",
    "ORB": "Orbit Analyzer",
    "OBA": "Orbit Analyzer",
    "ADC": "Adcut Analyzer"
}


def load_config() -> dict:
    default_cfg = {
        "api_url": DEFAULT_API_URL,
        "admin_pin": "2026",
        "admin_whatsapp": "6282244797292",
        "app_name": "MDC License Admin",
        "developer": "MDC.Dev"
    }
    if os.path.exists(CONFIG_FILE):
        try:
            with open(CONFIG_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                url = data.get("api_url", "").strip()
                if url and "PLACEHOLDER" not in url:
                    default_cfg["api_url"] = url
                if "admin_pin" in data:
                    default_cfg["admin_pin"] = str(data["admin_pin"])
                if "admin_whatsapp" in data:
                    default_cfg["admin_whatsapp"] = str(data["admin_whatsapp"])
        except Exception:
            pass
    return default_cfg


def save_config(cfg: dict):
    try:
        with open(CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception:
        pass


def load_admin_cache() -> dict:
    if os.path.exists(ADMIN_CACHE_FILE):
        try:
            with open(ADMIN_CACHE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {}


def save_admin_cache(data: dict):
    try:
        with open(ADMIN_CACHE_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    except Exception:
        pass


class MDCLicenseAdminApp(ctk.CTk):
    def __init__(self):
        super().__init__()

        self.title("MDC License Admin • Multi-Tool Control Center")
        self.geometry("1220, 780")
        self.minsize(1080, 720)
        self.configure(fg_color=THEME["bg_main"])

        if os.path.exists(ICO_PATH):
            try:
                self.iconbitmap(ICO_PATH)
            except Exception:
                pass

        self.config = load_config()
        self.licenses_data = []
        self.available_tools = ["RE-Merger Pro", "Suno Downloader"]
        self.prefix_map = DEFAULT_PREFIX_MAP.copy()
        self.selected_filter_tool = "Semua Tools"
        self.active_plan = "1 Bulan"
        self.server_status = "loading"
        self.has_sheet1_data = False

        # INSTANT OFFLINE-FIRST: Muat data cache lokal seketika (< 0.01 detik)
        cached = load_admin_cache()
        if cached and cached.get("licenses"):
            self.licenses_data = cached.get("licenses", [])
            if cached.get("tools"):
                self.available_tools = cached.get("tools")
            if cached.get("prefixMap"):
                self.prefix_map.update(cached.get("prefixMap"))
            self.has_sheet1_data = cached.get("hasSheet1Data", False)
            self.server_status = "offline_cache"

        self._build_ui()
        if self.licenses_data:
            self._filter_display()
        self._start_live_clock()
        self.after(300, self.refresh_licenses)

    def _start_live_clock(self):
        self._tick_live_clock()

    def _tick_live_clock(self):
        try:
            now_str = datetime.now().strftime("%H:%M:%S")
            status = getattr(self, "server_status", "online")
            if status == "offline_cache":
                cnt = len(getattr(self, "licenses_data", []))
                self.lbl_form_status.configure(text=f"📶 Mode Offline ({cnt} Data Tersimpan) • {now_str}", text_color=THEME["warning"])
            elif status == "error":
                self.lbl_form_status.configure(text=f"❌ Server Terputus • {now_str}", text_color=THEME["danger"])
            elif status == "loading":
                self.lbl_form_status.configure(text=f"⏳ Menghubungkan Server... {now_str}", text_color=THEME["warning"])
            else:
                cnt = len(getattr(self, "licenses_data", []))
                self.lbl_form_status.configure(text=f"🟢 Sinkron Server ({cnt} Data): {now_str}", text_color=THEME["success"])
        except Exception:
            pass
        finally:
            self.after(1000, self._tick_live_clock)

    def _build_ui(self):
        self.grid_columnconfigure(0, weight=0, minsize=480)
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(1, weight=1)

        # ==========================================
        # TOP HEADER BAR
        # ==========================================
        top_bar = ctk.CTkFrame(self, fg_color=THEME["card_bg"], corner_radius=0, height=68, border_width=1, border_color=THEME["card_border"])
        top_bar.grid(row=0, column=0, columnspan=2, sticky="ew")

        top_inner = ctk.CTkFrame(top_bar, fg_color="transparent")
        top_inner.pack(fill="both", expand=True, padx=20, pady=10)

        # Brand / Logo
        brand_frame = ctk.CTkFrame(top_inner, fg_color="transparent")
        brand_frame.pack(side="left")

        if os.path.exists(LOGO_PATH):
            try:
                pil_img = Image.open(LOGO_PATH)
                self.logo_img = ctk.CTkImage(light_image=pil_img, dark_image=pil_img, size=(38, 38))
                ctk.CTkLabel(brand_frame, image=self.logo_img, text="").pack(side="left", padx=(0, 12))
            except Exception:
                pass

        title_box = ctk.CTkFrame(brand_frame, fg_color="transparent")
        title_box.pack(side="left")
        ctk.CTkLabel(
            title_box,
            text="MDC LICENSE ADMIN",
            font=ctk.CTkFont(size=18, weight="bold"),
            text_color=THEME["cyan_neon"]
        ).pack(anchor="w")
        ctk.CTkLabel(
            title_box,
            text="MULTI-TOOL GOOGLE SHEETS CONTROL • POWERED BY MDC.Dev",
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color=THEME["text_muted"]
        ).pack(anchor="w", pady=(1, 0))

        # Top Right Actions
        act_frame = ctk.CTkFrame(top_inner, fg_color="transparent")
        act_frame.pack(side="right")

        # Tombol Buat Tool Baru
        ctk.CTkButton(
            act_frame,
            text="➕ Buat Sheet Tool Baru",
            font=ctk.CTkFont(size=12, weight="bold"),
            height=36,
            fg_color=THEME["cyan_dim"],
            hover_color=THEME["cyan_glow"],
            border_width=1,
            border_color=THEME["cyan_neon"],
            text_color=THEME["cyan_neon"],
            corner_radius=8,
            command=self._prompt_create_tool
        ).pack(side="left", padx=(0, 8))

        # Tombol Migrasi Sheet1 (Hidden by default, shown if legacy data detected)
        self.btn_migrate = ctk.CTkButton(
            act_frame,
            text="📦 Pisahkan Data Sheet1",
            font=ctk.CTkFont(size=12, weight="bold"),
            height=36,
            fg_color=THEME["purple_dim"],
            hover_color="#6B21A8",
            border_width=1,
            border_color=THEME["purple_neon"],
            text_color="#E9D5FF",
            corner_radius=8,
            command=self._do_migrate_sheet1
        )
        # Will pack if hasSheet1Data is true

        # Refresh
        ctk.CTkButton(
            act_frame,
            text="🔄",
            width=38,
            height=36,
            font=ctk.CTkFont(family="Segoe UI Emoji", size=15),
            fg_color=THEME["input_bg"],
            hover_color=THEME["card_inner"],
            border_width=1,
            border_color=THEME["card_border"],
            text_color=THEME["cyan_neon"],
            corner_radius=8,
            command=self.refresh_licenses
        ).pack(side="left", padx=(0, 8))

        # Settings
        ctk.CTkButton(
            act_frame,
            text="⚙️",
            width=38,
            height=36,
            font=ctk.CTkFont(family="Segoe UI Emoji", size=15),
            fg_color=THEME["input_bg"],
            hover_color=THEME["cyan_dim"],
            border_width=1,
            border_color=THEME["card_border"],
            text_color=THEME["text_cyan"],
            corner_radius=8,
            command=self._open_settings
        ).pack(side="left")

        # ==========================================
        # LEFT PANEL (Stats + Multi-Tool Quick Activation Form)
        # ==========================================
        self.left_panel = ctk.CTkFrame(
            self,
            fg_color=THEME["card_bg"],
            corner_radius=14,
            border_width=1,
            border_color=THEME["card_border"]
        )
        self.left_panel.grid(row=1, column=0, sticky="nsew", padx=(16, 8), pady=16)

        # --- STATISTIK ROW (3 Cards) ---
        stats_frame = ctk.CTkFrame(self.left_panel, fg_color="transparent")
        stats_frame.pack(fill="x", padx=16, pady=(16, 10))

        self.stat_total = self._create_stat_widget(stats_frame, "TOTAL PEMBELI", "0", THEME["cyan_neon"])
        self.stat_active = self._create_stat_widget(stats_frame, "LISENSI AKTIF", "0", THEME["success"])
        self.stat_trial = self._create_stat_widget(stats_frame, "UJI COBA TRIAL", "0", THEME["warning"])

        # Divider
        ctk.CTkFrame(self.left_panel, height=1, fg_color=THEME["card_border"]).pack(fill="x", padx=16, pady=(2, 10))

        # --- FORM AKTIVASI LISENSI CONTAINER ---
        form_box = ctk.CTkFrame(
            self.left_panel,
            fg_color=THEME["card_inner"],
            corner_radius=12,
            border_width=1,
            border_color=THEME["card_border"]
        )
        form_box.pack(fill="both", expand=True, padx=16, pady=(0, 10))

        form_inner = ctk.CTkScrollableFrame(form_box, fg_color="transparent")
        form_inner.pack(fill="both", expand=True, padx=14, pady=12)

        # Form Header
        ctk.CTkLabel(
            form_inner,
            text="⚡ AKTIVASI LISENSI PEMBELI",
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=THEME["cyan_neon"]
        ).pack(anchor="w")

        ctk.CTkLabel(
            form_inner,
            text="Pilih Tool tujuan untuk menempatkan lisensi pada sheet terkait",
            font=ctk.CTkFont(size=11),
            text_color=THEME["text_muted"]
        ).pack(anchor="w", pady=(1, 10))

        # 1. Pilihan Tool (Sheet Target)
        ctk.CTkLabel(
            form_inner,
            text="PILIH TOOLS (TAB SHEET SPREADSHEET)",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=THEME["text_label"]
        ).pack(anchor="w")

        tool_select_row = ctk.CTkFrame(form_inner, fg_color="transparent")
        tool_select_row.pack(fill="x", pady=(4, 8))

        self.form_tool_var = ctk.StringVar(value="RE-Merger Pro")
        self.form_tool_menu = ctk.CTkOptionMenu(
            tool_select_row,
            variable=self.form_tool_var,
            values=self.available_tools + ["➕ Tambah Tool Baru..."],
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=THEME["input_bg"],
            button_color=THEME["cyan_dim"],
            button_hover_color=THEME["cyan_glow"],
            text_color=THEME["cyan_neon"],
            dropdown_font=ctk.CTkFont(size=12),
            dropdown_fg_color=THEME["card_bg"],
            dropdown_hover_color=THEME["cyan_dim"],
            height=36,
            corner_radius=8,
            command=self._on_form_tool_selected
        )
        self.form_tool_menu.pack(side="left", fill="x", expand=True, padx=(0, 6))

        # Entry Tool Kustom (Tersembunyi kecuali dipilih tambah baru)
        self.entry_custom_tool = ctk.CTkEntry(
            form_inner,
            placeholder_text="Ketik Nama Tool Baru...",
            font=ctk.CTkFont(size=12),
            fg_color=THEME["input_bg"],
            border_color=THEME["cyan_neon"],
            text_color=THEME["text_white"],
            height=36,
            corner_radius=8
        )

        # 2. Input AppID
        ctk.CTkLabel(
            form_inner,
            text="HARDWARE APPID PEMBELI",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=THEME["text_label"]
        ).pack(anchor="w", pady=(6, 0))

        hwid_row = ctk.CTkFrame(form_inner, fg_color="transparent")
        hwid_row.pack(fill="x", pady=(4, 8))

        self.entry_hwid = ctk.CTkEntry(
            hwid_row,
            placeholder_text="MDC-XXXX-XXXX / SND-XXXX-XXXX",
            font=ctk.CTkFont(family="Consolas", size=13, weight="bold"),
            fg_color=THEME["input_bg"],
            border_color=THEME["input_border"],
            text_color=THEME["cyan_neon"],
            height=36,
            corner_radius=8
        )
        self.entry_hwid.pack(side="left", fill="x", expand=True, padx=(0, 6))
        self.entry_hwid.bind("<KeyRelease>", self._on_hwid_typed)

        ctk.CTkButton(
            hwid_row,
            text="📋 Paste",
            width=70,
            height=36,
            fg_color=THEME["cyan_dim"],
            hover_color=THEME["cyan_glow"],
            border_width=1,
            border_color=THEME["cyan_neon"],
            text_color=THEME["cyan_neon"],
            font=ctk.CTkFont(size=11, weight="bold"),
            corner_radius=8,
            command=self._paste_hwid
        ).pack(side="right")

        # 3. Input Nama Pembeli
        ctk.CTkLabel(
            form_inner,
            text="NAMA PEMBELI",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=THEME["text_label"]
        ).pack(anchor="w")

        self.entry_name = ctk.CTkEntry(
            form_inner,
            placeholder_text="Contoh: Budi Santoso",
            font=ctk.CTkFont(size=12),
            fg_color=THEME["input_bg"],
            border_color=THEME["input_border"],
            text_color=THEME["text_white"],
            height=36,
            corner_radius=8
        )
        self.entry_name.pack(fill="x", pady=(4, 8))

        # 4. Pilihan Paket Lisensi (2x2 Grid)
        ctk.CTkLabel(
            form_inner,
            text="PILIH PAKET LISENSI",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=THEME["text_label"]
        ).pack(anchor="w")

        plan_grid = ctk.CTkFrame(form_inner, fg_color="transparent")
        plan_grid.pack(fill="x", pady=(4, 8))

        self.plan_btns = {}
        plans = [
            ("💎 1 Bulan", "1 Bulan"),
            ("🌟 1 Tahun", "1 Tahun"),
            ("👑 Lifetime", "Lifetime"),
            ("⚡ Trial 24 Jam", "Trial 24 Jam")
        ]
        for idx, (label, val) in enumerate(plans):
            r = idx // 2
            c = idx % 2
            btn = ctk.CTkButton(
                plan_grid,
                text=label,
                font=ctk.CTkFont(size=11, weight="bold"),
                height=34,
                corner_radius=8,
                fg_color=THEME["cyan_neon"] if val == self.active_plan else THEME["input_bg"],
                text_color="#000000" if val == self.active_plan else THEME["text_white"],
                border_width=1,
                border_color=THEME["cyan_neon"] if val == self.active_plan else THEME["input_border"],
                hover_color=THEME["cyan_glow"],
                command=lambda v=val: self._select_plan(v)
            )
            btn.grid(row=r, column=c, padx=3, pady=3, sticky="ew")
            plan_grid.grid_columnconfigure(c, weight=1)
            self.plan_btns[val] = btn

        # 5. Input Catatan / WA
        ctk.CTkLabel(
            form_inner,
            text="CATATAN / NOMOR WA (OPSIONAL)",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=THEME["text_label"]
        ).pack(anchor="w")

        self.entry_notes = ctk.CTkEntry(
            form_inner,
            placeholder_text="Contoh: WA: 08123456789 (BCA Lunas)",
            font=ctk.CTkFont(size=12),
            fg_color=THEME["input_bg"],
            border_color=THEME["input_border"],
            text_color=THEME["text_white"],
            height=36,
            corner_radius=8
        )
        self.entry_notes.pack(fill="x", pady=(4, 12))

        # Tombol Submit Aktivasi
        self.btn_activate = ctk.CTkButton(
            form_inner,
            text="⚡ AKTIFKAN LISENSI SEKARANG",
            font=ctk.CTkFont(size=13, weight="bold"),
            fg_color=THEME["cyan_neon"],
            hover_color=THEME["cyan_glow"],
            text_color="#000000",
            height=42,
            corner_radius=8,
            command=self._do_activate
        )
        self.btn_activate.pack(fill="x", pady=(2, 4))

        # Bottom Status Bar Left Panel
        bottom_status_box = ctk.CTkFrame(self.left_panel, fg_color="transparent")
        bottom_status_box.pack(fill="x", padx=16, pady=(0, 10))

        self.lbl_form_status = ctk.CTkLabel(
            bottom_status_box,
            text="🟢 Server Online • Siap mendaftarkan lisensi.",
            font=ctk.CTkFont(size=11, weight="bold"),
            text_color=THEME["text_muted"]
        )
        self.lbl_form_status.pack(anchor="center")

        # ==========================================
        # RIGHT PANEL (Live License Search & Multi-Tool List)
        # ==========================================
        self.right_panel = ctk.CTkFrame(
            self,
            fg_color=THEME["card_bg"],
            corner_radius=14,
            border_width=1,
            border_color=THEME["card_border"]
        )
        self.right_panel.grid(row=1, column=1, sticky="nsew", padx=(8, 16), pady=16)
        self.right_panel.grid_rowconfigure(1, weight=1)
        self.right_panel.grid_columnconfigure(0, weight=1)

        # Header Right Panel
        right_header = ctk.CTkFrame(self.right_panel, fg_color="transparent")
        right_header.grid(row=0, column=0, sticky="ew", padx=16, pady=(16, 10))

        head_left = ctk.CTkFrame(right_header, fg_color="transparent")
        head_left.pack(side="left")

        ctk.CTkLabel(
            head_left,
            text="📁",
            font=ctk.CTkFont(size=15),
            width=24
        ).pack(side="left", padx=(0, 4))

        # Filter Tool Dropdown
        self.filter_tool_var = ctk.StringVar(value="Semua Tools")
        self.filter_tool_menu = ctk.CTkOptionMenu(
            head_left,
            variable=self.filter_tool_var,
            values=["Semua Tools"] + self.available_tools,
            font=ctk.CTkFont(size=12, weight="bold"),
            fg_color=THEME["input_bg"],
            button_color=THEME["cyan_dim"],
            button_hover_color=THEME["cyan_glow"],
            text_color=THEME["cyan_neon"],
            dropdown_font=ctk.CTkFont(size=12),
            dropdown_fg_color=THEME["card_bg"],
            dropdown_hover_color=THEME["cyan_dim"],
            height=34,
            corner_radius=8,
            command=self._on_filter_tool_changed
        )
        self.filter_tool_menu.pack(side="left", padx=(0, 8))

        self.lbl_count_badge = ctk.CTkLabel(
            head_left,
            text="0 Pembeli",
            font=ctk.CTkFont(size=11, weight="bold"),
            fg_color=THEME["card_inner"],
            text_color=THEME["text_cyan"],
            corner_radius=6,
            padx=8,
            pady=3
        )
        self.lbl_count_badge.pack(side="left")

        # Search Bar
        self.search_entry = ctk.CTkEntry(
            right_header,
            placeholder_text="🔍 Cari AppID / Nama / Tool / WA...",
            font=ctk.CTkFont(size=12),
            width=240,
            height=34,
            fg_color=THEME["input_bg"],
            border_color=THEME["input_border"],
            text_color=THEME["text_white"],
            corner_radius=8
        )
        self.search_entry.pack(side="right")
        self.search_entry.bind("<KeyRelease>", lambda e: self._filter_display())

        # Scrollable Cards Container
        self.cards_scroll = ctk.CTkScrollableFrame(
            self.right_panel,
            fg_color="transparent",
            corner_radius=0
        )
        self.cards_scroll.grid(row=1, column=0, sticky="nsew", padx=16, pady=(0, 16))

    def _create_stat_widget(self, parent, label: str, val: str, color: str):
        box = ctk.CTkFrame(
            parent,
            fg_color=THEME["input_bg"],
            corner_radius=10,
            border_width=1,
            border_color=THEME["card_border"]
        )
        box.pack(side="left", fill="x", expand=True, padx=4)

        num_lbl = ctk.CTkLabel(box, text=val, font=ctk.CTkFont(size=22, weight="bold"), text_color=color)
        num_lbl.pack(pady=(6, 0))

        ctk.CTkLabel(box, text=label, font=ctk.CTkFont(size=9, weight="bold"), text_color=THEME["text_muted"]).pack(pady=(0, 6))
        return num_lbl

    def _on_form_tool_selected(self, val: str):
        if val == "➕ Tambah Tool Baru...":
            self.entry_custom_tool.pack(fill="x", pady=(0, 8), before=self.entry_hwid.master.master)
            self.entry_custom_tool.focus()
        else:
            self.entry_custom_tool.pack_forget()

    def _on_filter_tool_changed(self, val: str):
        self.selected_filter_tool = val
        self._filter_display()

    def _on_hwid_typed(self, event=None):
        raw = self.entry_hwid.get().strip().upper()
        parts = raw.split("-")
        if len(parts) > 1 and parts[0]:
            pref = parts[0].strip()
            matched_tool = None
            if pref in self.prefix_map:
                matched_tool = self.prefix_map[pref]
            else:
                # Pencocokan otomatis cerdas untuk tools baru tanpa konfigurasi manual
                for t in self.available_tools:
                    if t in ("Semua Tools", "+ Tambah Tool Baru..."):
                        continue
                    words = [w for w in t.replace("-", " ").split() if w]
                    initials = "".join(w[0] for w in words).upper()
                    if pref == initials or pref in t.upper() or t.upper().startswith(pref):
                        matched_tool = t
                        break
            if matched_tool and matched_tool in self.available_tools:
                self.form_tool_var.set(matched_tool)
                self.entry_custom_tool.pack_forget()


    def _select_plan(self, plan: str):
        self.active_plan = plan
        for k, btn in self.plan_btns.items():
            if k == plan:
                btn.configure(
                    fg_color=THEME["cyan_neon"],
                    text_color="#000000",
                    border_color=THEME["cyan_neon"]
                )
            else:
                btn.configure(
                    fg_color=THEME["input_bg"],
                    text_color=THEME["text_white"],
                    border_color=THEME["input_border"]
                )

    def _paste_hwid(self):
        try:
            txt = self.clipboard_get().strip()
            self.entry_hwid.delete(0, tk.END)
            self.entry_hwid.insert(0, txt)
            self._on_hwid_typed()
        except Exception:
            pass

    def _copy_text(self, text: str):
        try:
            self.clipboard_clear()
            self.clipboard_append(text)
            messagebox.showinfo("Tersalin", f"Teks berhasil disalin ke clipboard:\n{text}")
        except Exception:
            pass

    # =====================================================================
    # API CALLS & DATA HANDLING
    # =====================================================================

    def refresh_licenses(self):
        api_url = self.config.get("api_url", DEFAULT_API_URL)
        pin = self.config.get("admin_pin", "2026")

        if "PLACEHOLDER" in api_url or not api_url.startswith("http"):
            self.server_status = "error"
            self.lbl_form_status.configure(text="⚠️ URL Server belum diatur. Klik Pengaturan.", text_color=THEME["warning"])
            return

        def worker():
            try:
                qs = urllib.parse.urlencode({"action": "admin_list", "pin": pin})
                req = urllib.request.Request(f"{api_url}?{qs}", headers={"User-Agent": "MDC-Admin/2.0"})
                with urllib.request.urlopen(req, timeout=25) as res:
                    raw = json.loads(res.read().decode("utf-8"))
                    self.after(0, lambda: self._on_list_loaded(raw))
            except Exception as e:
                def _handle_err(err_text):
                    if self.licenses_data:
                        self.server_status = "offline_cache"
                        now_str = datetime.now().strftime("%H:%M:%S")
                        self.lbl_form_status.configure(
                            text=f"📶 Mode Offline ({len(self.licenses_data)} Data Tersimpan) • {now_str}",
                            text_color=THEME["warning"]
                        )
                    else:
                        self.server_status = "error"
                        self.lbl_form_status.configure(text=f"❌ Gagal koneksi: {err_text}", text_color=THEME["danger"])
                self.after(0, lambda: _handle_err(str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _on_list_loaded(self, res: dict):
        if res.get("success"):
            self.server_status = "online"
            self.licenses_data = res.get("licenses", [])
            server_tools = res.get("tools", [])
            self.has_sheet1_data = res.get("hasSheet1Data", False)
            save_admin_cache(res)

            if server_tools:
                self.available_tools = server_tools
                # Update dropdown menus
                self.form_tool_menu.configure(values=self.available_tools + ["➕ Tambah Tool Baru..."])
                self.filter_tool_menu.configure(values=["Semua Tools"] + self.available_tools)

            if res.get("prefixMap"):
                self.prefix_map.update(res.get("prefixMap"))

            if self.has_sheet1_data:
                self.btn_migrate.pack(side="left", padx=(0, 8), before=self.btn_migrate.master.winfo_children()[-2])
            else:
                self.btn_migrate.pack_forget()

            now_str = datetime.now().strftime("%H:%M:%S")
            self.lbl_form_status.configure(
                text=f"🟢 Sinkron Server: {now_str}",
                text_color=THEME["success"]
            )
            self._filter_display()
        else:
            self.server_status = "error"
            err = res.get("error", "Gagal memuat data.")
            self.lbl_form_status.configure(text=f"❌ Error: {err}", text_color=THEME["danger"])

    def _filter_display(self):
        q = self.search_entry.get().strip().lower()
        filter_tool = self.selected_filter_tool

        for w in self.cards_scroll.winfo_children():
            w.destroy()

        filtered = []
        for l in self.licenses_data:
            match_tool = (filter_tool == "Semua Tools") or (l.get("tool") == filter_tool)
            match_q = (
                not q
                or q in l.get("hwid", "").lower()
                or q in l.get("name", "").lower()
                or q in l.get("tool", "").lower()
                or q in l.get("notes", "").lower()
            )
            if match_tool and match_q:
                filtered.append(l)

        # Update stats
        total = len(filtered)
        active = len([l for l in filtered if l.get("status") == "Aktif" and not l.get("isExpired")])
        trial = len([l for l in filtered if "trial" in l.get("plan", "").lower()])

        self.stat_total.configure(text=str(total))
        self.stat_active.configure(text=str(active))
        self.stat_trial.configure(text=str(trial))
        self.lbl_count_badge.configure(text=f"{total} Pembeli ({filter_tool})")

        if not filtered:
            empty_box = ctk.CTkFrame(self.cards_scroll, fg_color="transparent")
            empty_box.pack(pady=60)
            ctk.CTkLabel(empty_box, text="📭", font=ctk.CTkFont(size=42)).pack(pady=(0, 8))
            ctk.CTkLabel(
                empty_box,
                text="Tidak ada data lisensi ditemukan.",
                font=ctk.CTkFont(size=14, weight="bold"),
                text_color=THEME["text_white"]
            ).pack()
            ctk.CTkLabel(
                empty_box,
                text=f"Filter aktif: {filter_tool}. Gunakan form kiri untuk menambahkan lisensi.",
                font=ctk.CTkFont(size=11),
                text_color=THEME["text_muted"]
            ).pack(pady=(4, 0))
            return

        for lic in filtered:
            self._create_license_card(lic)

    def _create_license_card(self, lic: dict):
        card = ctk.CTkFrame(
            self.cards_scroll,
            fg_color=THEME["card_inner"],
            corner_radius=12,
            border_width=1,
            border_color=THEME["card_border"]
        )
        card.pack(fill="x", pady=6, padx=4)

        inner = ctk.CTkFrame(card, fg_color="transparent")
        inner.pack(fill="both", expand=True, padx=14, pady=10)

        name = lic.get("name", "Pembeli")
        hwid = lic.get("hwid", "")
        plan = lic.get("plan", "")
        tool = lic.get("tool", "RE-Merger Pro")
        exp = lic.get("expiryDate", "")
        status = lic.get("status", "Aktif")
        notes = lic.get("notes", "-")
        is_banned = lic.get("isBanned", False)
        is_exp = lic.get("isExpired", False)
        days = lic.get("daysLeft", 0)

        # --- ROW 1: HEADER (Nama + Tool Pill + Paket Badge + Status Badge) ---
        row1 = ctk.CTkFrame(inner, fg_color="transparent")
        row1.pack(fill="x", pady=(0, 6))

        r1_left = ctk.CTkFrame(row1, fg_color="transparent")
        r1_left.pack(side="left")

        ctk.CTkLabel(
            r1_left,
            text=name,
            font=ctk.CTkFont(size=14, weight="bold"),
            text_color=THEME["text_white"]
        ).pack(side="left", padx=(0, 8))

        # Tool Pill Badge
        ctk.CTkLabel(
            r1_left,
            text=f"📁 {tool}",
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#14283F",
            text_color=THEME["text_cyan"],
            corner_radius=6,
            padx=7,
            pady=2
        ).pack(side="left", padx=(0, 8))

        # Paket Pill
        # Paket Pill
        p_low = plan.lower()
        is_life = "lifetime" in p_low or days >= 9999 or exp.upper() == "LIFETIME"
        is_trial = "trial" in p_low or "24" in p_low
        hrs = lic.get("hoursLeft", days * 24 if days else 0)

        if is_life:
            p_text = "👑 LIFETIME"
            p_bg = THEME["success_dim"]
            p_fg = THEME["success"]
        elif is_trial:
            disp_h = hrs if hrs > 0 else (days * 24 if days > 0 else 0)
            p_text = f"⚡ TRIAL ({disp_h} Jam)"
            p_bg = THEME["warning_dim"]
            p_fg = THEME["warning"]
        elif "tahun" in p_low or "year" in p_low:
            p_text = f"🌟 1 TAHUN ({days} Hari)"
            p_bg = "#1A1A3A"
            p_fg = THEME["purple_neon"]
        else:
            p_text = f"💎 {plan} ({days} Hari)"
            p_bg = THEME["cyan_dim"]
            p_fg = THEME["cyan_neon"]

        ctk.CTkLabel(
            r1_left,
            text=p_text,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=p_bg,
            text_color=p_fg,
            corner_radius=6,
            padx=7,
            pady=2
        ).pack(side="left")

        # Status Pill di kanan
        if is_banned:
            s_text = "🚫 DIBLOKIR"
            s_bg = THEME["danger_dim"]
            s_fg = THEME["danger"]
        elif is_exp:
            s_text = "⏳ EXPIRED"
            s_bg = "#1F2937"
            s_fg = "#9CA3AF"
        else:
            s_text = "🟢 AKTIF"
            s_bg = THEME["success_dim"]
            s_fg = THEME["success"]

        ctk.CTkLabel(
            row1,
            text=s_text,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=s_bg,
            text_color=s_fg,
            corner_radius=6,
            padx=8,
            pady=2
        ).pack(side="right")

        # --- ROW 2: HWID & DETAILS ---
        row2 = ctk.CTkFrame(inner, fg_color="transparent")
        row2.pack(fill="x", pady=(0, 6))

        hwid_box = ctk.CTkFrame(
            row2,
            fg_color=THEME["input_bg"],
            corner_radius=6,
            border_width=1,
            border_color=THEME["card_border"]
        )
        hwid_box.pack(side="left", padx=(0, 10))

        ctk.CTkLabel(
            hwid_box,
            text=hwid,
            font=ctk.CTkFont(family="Consolas", size=11, weight="bold"),
            text_color=THEME["cyan_neon"],
            padx=8,
            pady=2
        ).pack(side="left")

        ctk.CTkButton(
            hwid_box,
            text="📋 Salin",
            width=48,
            height=22,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=THEME["cyan_dim"],
            hover_color=THEME["cyan_glow"],
            text_color=THEME["cyan_neon"],
            corner_radius=4,
            command=lambda h=hwid: self._copy_text(h)
        ).pack(side="left", padx=(2, 2))

        # Expiry info
        exp_text = f"📅 Berakhir: {exp.split(' ')[0]}" if "lifetime" not in plan.lower() else "📅 Masa Aktif: SELAMANYA"
        ctk.CTkLabel(
            row2,
            text=exp_text,
            font=ctk.CTkFont(size=11),
            text_color=THEME["text_muted"]
        ).pack(side="left", padx=(6, 10))

        if notes and notes != "-":
            ctk.CTkLabel(
                row2,
                text=f"📝 {notes}",
                font=ctk.CTkFont(size=11),
                text_color=THEME["text_label"]
            ).pack(side="left")

        # Divider
        ctk.CTkFrame(inner, height=1, fg_color=THEME["card_border"]).pack(fill="x", pady=(0, 6))

        # --- ROW 3: ACTION TOOLBAR ---
        row3 = ctk.CTkFrame(inner, fg_color="transparent")
        row3.pack(fill="x")

        ctk.CTkLabel(
            row3,
            text="Aksi:",
            font=ctk.CTkFont(size=10, weight="bold"),
            text_color=THEME["text_muted"]
        ).pack(side="left", padx=(0, 6))

        # +24 Jam
        ctk.CTkButton(
            row3,
            text="⚡ +24 Jam",
            width=70,
            height=26,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#362204",
            border_width=1,
            border_color=THEME["warning"],
            hover_color="#523207",
            text_color=THEME["warning"],
            corner_radius=6,
            command=lambda: self._extend_license(hwid, tool, days=1, hours=24)
        ).pack(side="left", padx=2)

        # +30 Hari
        ctk.CTkButton(
            row3,
            text="💎 +30 Hari",
            width=74,
            height=26,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=THEME["cyan_dim"],
            border_width=1,
            border_color=THEME["cyan_neon"],
            hover_color=THEME["cyan_glow"],
            text_color=THEME["cyan_neon"],
            corner_radius=6,
            command=lambda: self._extend_license(hwid, tool, 30)
        ).pack(side="left", padx=2)

        # +1 Tahun
        ctk.CTkButton(
            row3,
            text="🌟 +1 Tahun",
            width=76,
            height=26,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color="#14283F",
            border_width=1,
            border_color=THEME["text_cyan"],
            hover_color="#0284C7",
            text_color=THEME["text_cyan"],
            corner_radius=6,
            command=lambda: self._extend_license(hwid, tool, 365)
        ).pack(side="left", padx=2)

        # Blokir / Buka
        ban_label = "🔓 Buka Blokir" if is_banned else "🚫 Blokir"
        ban_color = THEME["success_dim"] if is_banned else THEME["danger_dim"]
        ban_border = THEME["success"] if is_banned else THEME["danger"]
        ban_text_col = THEME["success"] if is_banned else THEME["danger"]

        ctk.CTkButton(
            row3,
            text=ban_label,
            width=80,
            height=26,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=ban_color,
            border_width=1,
            border_color=ban_border,
            hover_color=THEME["danger_hover"] if not is_banned else "#059669",
            text_color=ban_text_col,
            corner_radius=6,
            command=lambda: self._toggle_block(hwid, tool, status)
        ).pack(side="left", padx=2)

        # Hapus
        ctk.CTkButton(
            row3,
            text="🗑️ Hapus",
            width=64,
            height=26,
            font=ctk.CTkFont(size=10, weight="bold"),
            fg_color=THEME["input_bg"],
            border_width=1,
            border_color=THEME["card_border"],
            hover_color=THEME["danger_dim"],
            text_color=THEME["text_muted"],
            corner_radius=6,
            command=lambda: self._delete_license(hwid, tool)
        ).pack(side="right")

    def _do_activate(self):
        hwid = self.entry_hwid.get().strip()
        name = self.entry_name.get().strip() or "Pembeli"
        notes = self.entry_notes.get().strip() or "Ditambahkan via Desktop Admin"
        plan = self.active_plan

        tool_choice = self.form_tool_var.get()
        if tool_choice == "➕ Tambah Tool Baru...":
            tool = self.entry_custom_tool.get().strip()
            if not tool:
                messagebox.showwarning("Perhatian", "Harap isi nama Tool Baru.")
                return
        else:
            tool = tool_choice

        if not hwid:
            messagebox.showwarning("Perhatian", "Harap isi AppID pembeli.")
            return

        self.btn_activate.configure(text="Memproses...", state="disabled")
        api_url = self.config.get("api_url", "")
        pin = self.config.get("admin_pin", "2026")

        def worker():
            try:
                qs = urllib.parse.urlencode({
                    "action": "admin_add",
                    "pin": pin,
                    "hwid": hwid,
                    "name": name,
                    "plan": plan,
                    "tool": tool,
                    "notes": notes
                })
                req = urllib.request.Request(f"{api_url}?{qs}")
                with urllib.request.urlopen(req, timeout=25) as res:
                    raw = json.loads(res.read().decode("utf-8"))
                    self.after(0, lambda: self._on_activated(raw))
            except Exception as e:
                self.after(0, lambda: self._on_activate_failed(str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _on_activated(self, res: dict):
        self.btn_activate.configure(text="⚡ AKTIFKAN LISENSI SEKARANG", state="normal")
        if res.get("success"):
            messagebox.showinfo("Berhasil", res.get("message", "Lisensi berhasil diaktifkan!"))
            self.entry_hwid.delete(0, tk.END)
            self.entry_name.delete(0, tk.END)
            self.entry_notes.delete(0, tk.END)
            self.entry_custom_tool.delete(0, tk.END)
            self.refresh_licenses()
        else:
            messagebox.showerror("Gagal", res.get("error", "Gagal mengaktifkan lisensi."))

    def _on_activate_failed(self, err: str):
        self.btn_activate.configure(text="⚡ AKTIFKAN LISENSI SEKARANG", state="normal")
        messagebox.showerror("Error", f"Gagal menghubungi server:\n{err}")

    def _prompt_create_tool(self):
        dialog1 = ctk.CTkInputDialog(
            text="1/2. Masukkan Nama Tool Baru:\n(Contoh: Auto Massal Video, TikTok Bot, dll)",
            title="Buat Sheet Tool Baru (Langkah 1/2)"
        )
        tool_name = dialog1.get_input()
        if not tool_name or not tool_name.strip():
            return
        tool_name = tool_name.strip()

        default_pref = "".join([c for c in tool_name if c.isalpha()])[:3].upper()
        dialog2 = ctk.CTkInputDialog(
            text=f"2/2. Masukkan Kode Awalan 3 Huruf untuk {tool_name}:\n(Contoh: AVM, AMV, SND, ORB, dsb)",
            title="Tentukan Kode Awalan Lisensi (Langkah 2/2)"
        )
        tool_prefix = dialog2.get_input()
        prefix = tool_prefix.strip().upper() if tool_prefix and tool_prefix.strip() else default_pref

        api_url = self.config.get("api_url", "")
        pin = self.config.get("admin_pin", "2026")

        def worker():
            try:
                qs = urllib.parse.urlencode({
                    "action": "admin_create_tool",
                    "pin": pin,
                    "tool_name": tool_name,
                    "prefix": prefix
                })
                with urllib.request.urlopen(f"{api_url}?{qs}", timeout=25) as res:
                    raw = json.loads(res.read().decode("utf-8"))
                    def on_done():
                        if raw.get("success"):
                            if prefix:
                                self.prefix_map[prefix] = tool_name
                            messagebox.showinfo("Sukses", raw.get("message", "Sheet tool berhasil dibuat!"))
                            self.refresh_licenses()
                        else:
                            messagebox.showerror("Gagal", raw.get("error", "Gagal membuat sheet."))
                    self.after(0, on_done)
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Gagal", str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _do_migrate_sheet1(self):
        if not messagebox.askyesno(
            "Konfirmasi Migrasi Sheet1",
            "Apakah Anda ingin memindahkan seluruh lisensi lama dari Sheet1 ke Sheet tool masing-masing (RE-Merger Pro & Suno Downloader)?\n\nSheet1 lama akan diarsipkan dengan aman."
        ):
            return

        api_url = self.config.get("api_url", "")
        pin = self.config.get("admin_pin", "2026")

        def worker():
            try:
                qs = urllib.parse.urlencode({"action": "admin_migrate_sheet1", "pin": pin})
                with urllib.request.urlopen(f"{api_url}?{qs}", timeout=25) as res:
                    raw = json.loads(res.read().decode("utf-8"))
                    def on_done():
                        if raw.get("success"):
                            messagebox.showinfo("Migrasi Berhasil 🎉", raw.get("message", "Migrasi selesai!"))
                            self.refresh_licenses()
                        else:
                            messagebox.showerror("Gagal Migrasi", raw.get("error", "Gagal memproses migrasi."))
                    self.after(0, on_done)
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Gagal Koneksi", str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _extend_license(self, hwid: str, tool: str, days: int = 30, hours: int = 0):
        dur_label = f"{hours} jam" if (hours and hours > 0) else f"{days} hari"
        if not messagebox.askyesno("Konfirmasi", f"Perpanjang lisensi {hwid} di tab '{tool}' selama {dur_label}?"):
            return

        api_url = self.config.get("api_url", "")
        pin = self.config.get("admin_pin", "2026")

        def worker():
            try:
                params = {"action": "admin_extend", "pin": pin, "hwid": hwid, "tool": tool}
                if hours and hours > 0:
                    params["hours"] = hours
                else:
                    params["days"] = days
                qs = urllib.parse.urlencode(params)
                with urllib.request.urlopen(f"{api_url}?{qs}", timeout=25) as res:
                    raw = json.loads(res.read().decode("utf-8"))
                    self.after(0, lambda: self._on_action_done(raw))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Gagal", str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _toggle_block(self, hwid: str, tool: str, cur_status: str):
        new_status = "Aktif" if cur_status == "Blokir" else "Blokir"
        if not messagebox.askyesno("Konfirmasi", f"Ubah status {hwid} di tab '{tool}' menjadi {new_status}?"):
            return

        api_url = self.config.get("api_url", "")
        pin = self.config.get("admin_pin", "2026")

        def worker():
            try:
                qs = urllib.parse.urlencode({"action": "admin_set_status", "pin": pin, "hwid": hwid, "tool": tool, "status": new_status})
                with urllib.request.urlopen(f"{api_url}?{qs}", timeout=25) as res:
                    raw = json.loads(res.read().decode("utf-8"))
                    self.after(0, lambda: self._on_action_done(raw))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Gagal", str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _delete_license(self, hwid: str, tool: str):
        if not messagebox.askyesno("Peringatan", f"Apakah Anda yakin ingin MENGHAPUS lisensi {hwid} dari tab '{tool}'?"):
            return

        api_url = self.config.get("api_url", "")
        pin = self.config.get("admin_pin", "2026")

        def worker():
            try:
                qs = urllib.parse.urlencode({"action": "admin_delete", "pin": pin, "hwid": hwid, "tool": tool})
                with urllib.request.urlopen(f"{api_url}?{qs}", timeout=25) as res:
                    raw = json.loads(res.read().decode("utf-8"))
                    self.after(0, lambda: self._on_action_done(raw))
            except Exception as e:
                self.after(0, lambda: messagebox.showerror("Gagal", str(e)))

        threading.Thread(target=worker, daemon=True).start()

    def _on_action_done(self, res: dict):
        if res.get("success"):
            self.refresh_licenses()
        else:
            messagebox.showerror("Error", res.get("error", "Aksi gagal dijalankan."))

    def _open_settings(self):
        dialog = ctk.CTkInputDialog(
            text="Masukkan Web App URL Google Apps Script:\n(Contoh: https://script.google.com/macros/s/.../exec)",
            title="Pengaturan Server Admin"
        )
        val = dialog.get_input()
        if val and val.strip().startswith("http"):
            self.config["api_url"] = val.strip()
            save_config(self.config)
            messagebox.showinfo("Tersimpan", "URL Server berhasil diperbarui!")
            self.refresh_licenses()


if __name__ == "__main__":
    app = MDCLicenseAdminApp()
    app.mainloop()

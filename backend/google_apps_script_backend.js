/**
 * ====================================================================
 * MDC.Dev - MULTI-TOOL LICENSE ENGINE & MOBILE ADMIN APP BACKEND
 * VERSI 2.3 (ULTRA-RESILIENT MOBILE ENGINE & ZERO-ERROR EDITION)
 * ====================================================================
 * 
 * Update & Perbaikan Masalah Akses di HP (Mobile):
 * 1. Safe Storage Engine: Proteksi penuh dari DOMException / SecurityError
 *    di iOS Safari & Android Chrome (akibat pemblokiran storage iframe sandbox).
 * 2. Hybrid Dual-Transport API:
 *    - Otomatis memilih google.script.run dengan failover instan ke direct HTTP fetch.
 *    - Kebal dari error multi-akun Google di HP (ScriptError 403 / "Authorization required").
 *    - Otomatis auto-retry saat koneksi internet HP mengalami fluktuasi/delay.
 * 3. Smart Error Diagnostics & Feedback:
 *    - Membedakan antara salah PIN vs kendala jaringan/timeout.
 *    - Indikator status koneksi real-time & spinner loading anti-klik ganda.
 * 4. Concurrency Protection (LockService):
 *    - Mencegah collision / bentrok saat admin HP dan software klien menulis ke Sheets bersamaan.
 * 5. Cyber-Neon Inline Confirmation Modal:
 *    - Menggantikan dialog confirm() bawaan browser yang sering terblokir/hang di HP.
 * 6. Cyber-Neon Toast Notification System:
 *    - Notifikasi melayang modern tanpa popup alert() yang mengganggu.
 * 7. Safe Data Filtering & Formatting:
 *    - Kebal dari error crash toLowerCase() pada AppID/Nama kosong/numerik.
 *    - formatDate aman dari format tanggal tidak valid / NaN.
 * 8. PWA (Progressive Web App) Ready:
 *    - Dapat dipasang ke Layar Utama (Add to Home Screen) HP, bebas expired selamanya!
 * 
 * PIN ADMIN DEFAULT: 2026 (Dapat Anda ubah pada variabel ADMIN_PIN di bawah)
 */

var ADMIN_PIN = "2026";
var DEFAULT_HEADERS = ["AppID", "Nama Pembeli", "Paket Lisensi", "Tanggal Mulai", "Tanggal Berakhir", "Status", "Catatan"];
var SYSTEM_SHEETS = ["_backup_sheet1", "sheet1_backup", "template", "settings", "config", "__config__"];
var DEFAULT_APP_URL = "https://script.google.com/macros/s/AKfycbzK0fCAMv6AZz8fL3L23CShQkmFKmoVJPVUoN20_hjAgvh5QIoP43H0Fmfjt3E3SPU8hA/exec";

// =============================================================
// ROUTER UTAMA WEB & API
// =============================================================

function doGet(e) {
  var params = e ? e.parameter || {} : {};
  var action = (params.action || "").trim();

  // JIKA DIBUKA LEWAT BROWSER HP TANPA PARAMETER -> TAMPILKAN APLIKASI MOBILE
  if (!action || action === "app") {
    return HtmlService.createHtmlOutput(getMobileAppHtml())
      .setTitle("MDC License Admin • Multi-Tool")
      .addMetaTag("viewport", "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // JIKA PARAMETER ACTION ADA -> PROSES SEBAGAI API JSON
  return handleApiRequest(params);
}

function doPost(e) {
  var params = {};
  if (e && e.postData && e.postData.contents) {
    try {
      params = JSON.parse(e.postData.contents);
    } catch(err) {
      params = e.parameter || {};
    }
  } else {
    params = e ? e.parameter || {} : {};
  }
  return handleApiRequest(params);
}

// Handler RPC khusus dari antarmuka Web Mobile Google Apps Script
function callApiFromMobile(action, params) {
  try {
    params = params || {};
    params.action = action;
    var res = handleApiRequest(params);
    var content = res.getContent();
    return JSON.parse(content);
  } catch(err) {
    return { success: false, error: "Panggilan server gagal: " + err.toString() };
  }
}

// =============================================================
// HELPER CONCURRENCY LOCKSERVICE
// =============================================================

function executeWithLock(fn, timeoutMs) {
  timeoutMs = timeoutMs || 10000;
  var lock = LockService.getScriptLock();
  var hasLock = false;
  try {
    hasLock = lock.tryLock(timeoutMs);
  } catch(e) {}
  try {
    return fn();
  } finally {
    if (hasLock) {
      try {
        lock.releaseLock();
      } catch(e) {}
    }
  }
}

// =============================================================
// HELPER MULTI-SHEET & SMART TOOL DETECTION
// =============================================================

function isSystemSheet(sheetName) {
  var lower = String(sheetName || "").trim().toLowerCase();
  if (lower.indexOf("_") === 0) return true;
  for (var i = 0; i < SYSTEM_SHEETS.length; i++) {
    if (lower === SYSTEM_SHEETS[i]) return true;
  }
  return false;
}

function cleanToolName(toolName) {
  var name = String(toolName || "").trim();
  // Sanitasi karakter terlarang Google Sheet: [ ] * ? : / \
  name = name.replace(/[\[\]\*\?\:\/\\]/g, " ").trim();
  if (name.length > 50) name = name.substring(0, 50).trim();
  return name;
}

// =============================================================
// SISTEM KODE AWALAN (PREFIX 3 HURUF) MULTI-TOOL
// =============================================================

var DEFAULT_PREFIX_MAP = {
  "MDC": "Paket Bundle",
  "BDL": "Paket Bundle",
  "REM": "RE-Merger Pro",
  "SND": "Suno Downloader",
  "AMV": "Auto Massal Video",
  "AVM": "Auto Massal Video",
  "ORB": "Orbit Analyzer",
  "OBA": "Orbit Analyzer",
  "ADC": "Adcut Analyzer"
};

function getPrefixMap() {
  var map = {};
  for (var k in DEFAULT_PREFIX_MAP) {
    map[k] = DEFAULT_PREFIX_MAP[k];
  }
  try {
    var props = PropertiesService.getScriptProperties().getProperties();
    for (var key in props) {
      if (key.indexOf("PREFIX_") === 0) {
        var p = key.substring(7).toUpperCase().trim();
        map[p] = props[key];
      }
    }
  } catch(e) {}
  return map;
}

function registerToolPrefix(prefix, toolName) {
  if (!prefix || !toolName) return;
  prefix = String(prefix).trim().toUpperCase();
  toolName = cleanToolName(toolName);
  try {
    PropertiesService.getScriptProperties().setProperty("PREFIX_" + prefix, toolName);
  } catch(e) {}
}

function detectToolFromData(hwid, notes, preferredTool) {
  if (preferredTool && cleanToolName(preferredTool) && preferredTool !== "Semua Tools" && preferredTool !== "all") {
    return cleanToolName(preferredTool);
  }
  var h = String(hwid || "").toUpperCase().trim();
  var n = String(notes || "").toLowerCase();

  // 1. Ekstrak kode awalan 3-4 huruf sebelum strip pertama (misal: SND-XXXX -> SND)
  var parts = h.split("-");
  var prefix = parts.length > 1 ? parts[0].trim() : "";

  var map = getPrefixMap();
  if (prefix && map[prefix]) {
    return map[prefix];
  }

  // 2. Deteksi dari keyword catatan atau nama tool
  for (var p in map) {
    var tName = map[p];
    if (n.indexOf(tName.toLowerCase()) !== -1) {
      return tName;
    }
  }

  if (n.indexOf("bundle") !== -1 || n.indexOf("suite") !== -1) return "Paket Bundle";
  if (n.indexOf("suno") !== -1) return "Suno Downloader";
  if (n.indexOf("merger") !== -1) return "RE-Merger Pro";
  if (n.indexOf("massal") !== -1 || n.indexOf("video") !== -1) return "Auto Massal Video";
  if (n.indexOf("orbit") !== -1) return "Orbit Analyzer";

  return "RE-Merger Pro";
}

function getOrCreateToolSheet(ss, toolName) {
  var target = cleanToolName(toolName);
  if (!target) target = "RE-Merger Pro";

  var sheet = ss.getSheetByName(target);
  if (!sheet) {
    sheet = ss.insertSheet(target);
    sheet.appendRow(DEFAULT_HEADERS);

    var headerRange = sheet.getRange(1, 1, 1, DEFAULT_HEADERS.length);
    headerRange.setBackground("#0D1424");
    headerRange.setFontColor("#00F0FF");
    headerRange.setFontWeight("bold");
    headerRange.setFontFamily("Segoe UI");
    headerRange.setHorizontalAlignment("center");
    headerRange.setVerticalAlignment("middle");
    sheet.setRowHeight(1, 36);
    sheet.setFrozenRows(1);

    sheet.setColumnWidth(1, 195); // AppID
    sheet.setColumnWidth(2, 170); // Nama Pembeli
    sheet.setColumnWidth(3, 140); // Paket Lisensi
    sheet.setColumnWidth(4, 160); // Tanggal Mulai
    sheet.setColumnWidth(5, 160); // Tanggal Berakhir
    sheet.setColumnWidth(6, 110); // Status
    sheet.setColumnWidth(7, 240); // Catatan
  }
  return sheet;
}

function getAllToolSheets(ss) {
  var sheets = ss.getSheets();
  var toolSheets = [];
  for (var i = 0; i < sheets.length; i++) {
    var name = sheets[i].getName();
    if (!isSystemSheet(name)) {
      toolSheets.push(sheets[i]);
    }
  }
  return toolSheets;
}

function getAllToolNames(ss) {
  var toolSheets = getAllToolSheets(ss);
  var names = [];
  for (var i = 0; i < toolSheets.length; i++) {
    var n = toolSheets[i].getName();
    if (n === "Sheet1") {
      var data = toolSheets[i].getDataRange().getValues();
      if (data.length <= 1) continue;
    }
    names.push(n);
  }
  if (names.length === 0) names.push("RE-Merger Pro");
  return names;
}

function extractCoreHwid(hwid) {
  var s = String(hwid || "").trim().toUpperCase();
  var parts = s.split("-");
  if (parts.length >= 4) {
    return parts.slice(1).join("-");
  }
  return s;
}

function searchHwidInSheet(sheet, hwid, allowCoreMatch) {
  var data = sheet.getDataRange().getValues();
  var targetHwid = String(hwid || "").trim().toUpperCase();
  var targetCore = extractCoreHwid(targetHwid);

  for (var i = 1; i < data.length; i++) {
    var rowHwid = String(data[i][0] || "").trim().toUpperCase();
    if (rowHwid === targetHwid) {
      return { found: true, row: i + 1, data: data[i] };
    }
    if (allowCoreMatch && targetCore && targetCore.length >= 10) {
      var rowCore = extractCoreHwid(rowHwid);
      if (rowCore === targetCore) {
        return { found: true, row: i + 1, data: data[i], matchedByCore: true };
      }
    }
  }
  return { found: false };
}

function findLicenseAcrossSheets(ss, hwid, preferredTool) {
  hwid = String(hwid || "").trim();
  if (!hwid) return { found: false };

  // 1. Cek di preferredTool jika ada
  if (preferredTool && cleanToolName(preferredTool)) {
    var prefSheet = ss.getSheetByName(cleanToolName(preferredTool));
    if (prefSheet) {
      var r1 = searchHwidInSheet(prefSheet, hwid, false);
      if (r1.found) {
        return { found: true, sheet: prefSheet, tool: prefSheet.getName(), row: r1.row, data: r1.data };
      }
    }
  }

  // 2. CEK KHUSUS: Sheet "Paket Bundle" (Lisensi All-in-One Multi-Tool)
  var bundleSheet = ss.getSheetByName("Paket Bundle");
  if (bundleSheet) {
    var rBundle = searchHwidInSheet(bundleSheet, hwid, true);
    if (rBundle.found) {
      return { found: true, sheet: bundleSheet, tool: "Paket Bundle", isBundle: true, row: rBundle.row, data: rBundle.data };
    }
  }

  // 3. Cek di tool yang terdeteksi dari prefix HWID
  var detectedName = detectToolFromData(hwid, "");
  var detSheet = ss.getSheetByName(detectedName);
  if (detSheet && (!bundleSheet || detSheet.getName() !== bundleSheet.getName())) {
    var r2 = searchHwidInSheet(detSheet, hwid, false);
    if (r2.found) {
      return { found: true, sheet: detSheet, tool: detSheet.getName(), row: r2.row, data: r2.data };
    }
  }

  // 4. Cari di semua Sheet yang ada (termasuk Sheet1 legacy)
  var allSheets = ss.getSheets();
  for (var s = 0; s < allSheets.length; s++) {
    var curSheet = allSheets[s];
    var sName = curSheet.getName();
    if (preferredTool && sName === cleanToolName(preferredTool)) continue;
    if (sName === "Paket Bundle") continue;
    if (sName === detectedName) continue;
    if (isSystemSheet(sName)) continue;

    var r3 = searchHwidInSheet(curSheet, hwid, false);
    if (r3.found) {
      return { found: true, sheet: curSheet, tool: curSheet.getName(), row: r3.row, data: r3.data };
    }
  }

  return { found: false };
}

// =============================================================
// LOGIKA PEMROSESAN API UTAMA
// =============================================================

function handleApiRequest(params) {
  try {
    var action = (params.action || "check").toLowerCase();
    var hwid = String(params.hwid || "").trim();
    var pin = String(params.pin || "").trim();
    var toolParam = String(params.tool || "").trim();

    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // =========================================================
    // 1. CEK LISENSI (CLIENT DESKTOP RE-MERGER / SUNO / DLL)
    // =========================================================
    if (action === "check") {
      if (!hwid) return responseJSON({ valid: false, message: "AppID wajib diisi." });

      var resLic = findLicenseAcrossSheets(ss, hwid, toolParam);
      if (!resLic.found) {
        return responseJSON({ valid: false, status: "unregistered", message: "Perangkat belum terdaftar." });
      }

      var rowData = resLic.data;
      var foundTool = resLic.tool;
      var nama = String(rowData[1] || "Pembeli");
      var paket = String(rowData[2] || "1 Bulan").trim();
      var expRaw = rowData[4];
      var status = String(rowData[5] || "Aktif").trim();

      if (status.toLowerCase() === "blokir" || status.toLowerCase() === "banned") {
        return responseJSON({ valid: false, status: "banned", tool: foundTool, message: "Akses perangkat ini telah diblokir oleh Admin." });
      }

      if (paket.toLowerCase().indexOf("lifetime") !== -1 || String(expRaw).toUpperCase() === "LIFETIME") {
        return responseJSON({
          valid: true,
          status: "active",
          plan: "Lifetime",
          tool: foundTool,
          daysLeft: 99999,
          hoursLeft: 999999,
          expiry: "LIFETIME",
          message: "Lisensi Lifetime Aktif untuk " + nama
        });
      }

      var expDate = parseFlexibleDate(expRaw);
      if (!expDate) {
        return responseJSON({
          valid: true,
          status: "active",
          plan: paket,
          tool: foundTool,
          daysLeft: 30,
          hoursLeft: 720,
          expiry: String(expRaw),
          message: "Lisensi " + paket + " Aktif."
        });
      }

      var nowTime = new Date();
      var diffMs = expDate.getTime() - nowTime.getTime();

      if (diffMs <= 0) {
        return responseJSON({ valid: false, status: "expired", plan: paket, tool: foundTool, expiry: formatDate(expDate), message: "Masa aktif lisensi telah berakhir." });
      }

      var diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      var diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      return responseJSON({
        valid: true,
        status: "active",
        plan: paket,
        tool: foundTool,
        daysLeft: diffDays,
        hoursLeft: diffHours,
        expiry: formatDate(expDate),
        message: "Lisensi " + paket + " Aktif. Sisa waktu: " + (diffDays > 0 ? diffDays + " hari" : diffHours + " jam")
      });
    }

    // =========================================================
    // 2. TRIAL 24 JAM (CLIENT DESKTOP)
    // =========================================================
    if (action === "trial") {
      if (!hwid) return responseJSON({ valid: false, message: "AppID wajib diisi." });

      return executeWithLock(function() {
        var targetTool = detectToolFromData(hwid, params.notes, toolParam);
        var sheetTrial = getOrCreateToolSheet(ss, targetTool);

        var existingTrial = searchHwidInSheet(sheetTrial, hwid);
        if (existingTrial.found) {
          return responseJSON({ valid: false, message: "Perangkat ini sudah pernah menggunakan uji coba untuk " + targetTool + "." });
        }

        var nowTrial = new Date();
        var expTrial = new Date(nowTrial.getTime() + (24 * 60 * 60 * 1000));
        var autoNote = params.notes || "Uji Coba Otomatis via App";
        sheetTrial.appendRow([hwid, "Pengguna Uji Coba", "Trial 24 Jam", formatDate(nowTrial), formatDate(expTrial), "Aktif", autoNote]);

        return responseJSON({
          valid: true,
          status: "active",
          plan: "Trial 24 Jam",
          tool: targetTool,
          daysLeft: 1,
          hoursLeft: 24,
          expiry: formatDate(expTrial),
          message: "Uji coba 24 jam berhasil diaktifkan untuk " + targetTool + "!"
        });
      });
    }

    // =========================================================
    // VERIFIKASI PIN ADMIN UNTUK SELURUH AKSI DI BAWAH INI
    // =========================================================
    if (pin !== ADMIN_PIN) {
      return responseJSON({ success: false, isAuthError: true, error: "PIN Admin salah atau tidak valid." });
    }

    // =========================================================
    // 3. ADMIN: GET LIST LISENSI (SINGLE-PASS ULTRA FAST)
    // =========================================================
    if (action === "admin_list") {
      var list = [];
      var now = new Date();
      var allSheets = ss.getSheets();
      var availableTools = [];
      var hasSheet1Data = false;
      var targetSheets = [];

      for (var sIdx = 0; sIdx < allSheets.length; sIdx++) {
        var sh = allSheets[sIdx];
        var shName = sh.getName();
        if (isSystemSheet(shName)) continue;

        if (shName === "Sheet1") {
          try {
            var s1Values = sh.getDataRange().getValues();
            if (s1Values.length > 1) {
              hasSheet1Data = true;
              availableTools.push("Sheet1");
              if (!toolParam || toolParam === "Semua Tools" || toolParam === "all" || toolParam === "Sheet1") {
                targetSheets.push(sh);
              }
            }
          } catch(e) {}
          continue;
        }

        availableTools.push(shName);
        if (!toolParam || toolParam === "Semua Tools" || toolParam === "all" || cleanToolName(toolParam) === shName) {
          targetSheets.push(sh);
        }
      }

      if (availableTools.length === 0) {
        availableTools = ["RE-Merger Pro", "Suno Downloader"];
      }

      for (var tIdx = 0; tIdx < targetSheets.length; tIdx++) {
        var curSh = targetSheets[tIdx];
        var curName = curSh.getName();
        try {
          var dataRows = curSh.getDataRange().getValues();
          for (var r = 1; r < dataRows.length; r++) {
            var rowHwid = String(dataRows[r][0] || "").trim();
            if (!rowHwid) continue;

            var rNama = String(dataRows[r][1] || "Tanpa Nama");
            var rPaket = String(dataRows[r][2] || "1 Bulan");
            var rMulai = dataRows[r][3];
            var rAkhir = dataRows[r][4];
            var rStatus = String(dataRows[r][5] || "Aktif");
            var rCatatan = String(dataRows[r][6] || "");

            var isLifetime = rPaket.toLowerCase().indexOf("lifetime") !== -1 || String(rAkhir).toUpperCase() === "LIFETIME";
            var isBanned = rStatus.toLowerCase() === "blokir" || rStatus.toLowerCase() === "banned";
            var isExpired = false;
            var sisaHari = 99999;
            var sisaJam = 999999;

            if (!isLifetime) {
              var dExp = parseFlexibleDate(rAkhir);
              if (dExp && !isNaN(dExp.getTime())) {
                var sisaMs = dExp.getTime() - now.getTime();
                if (sisaMs <= 0) {
                  isExpired = true;
                  sisaHari = 0;
                  sisaJam = 0;
                } else {
                  sisaHari = Math.floor(sisaMs / (1000 * 60 * 60 * 24));
                  sisaJam = Math.floor(sisaMs / (1000 * 60 * 60));
                }
              }
            }

            list.push({
              row: r + 1,
              tool: curName,
              hwid: rowHwid,
              name: rNama,
              plan: rPaket,
              startDate: formatDate(rMulai),
              expiryDate: isLifetime ? "LIFETIME" : formatDate(rAkhir),
              status: rStatus,
              notes: rCatatan,
              isBanned: isBanned,
              isExpired: isExpired,
              daysLeft: sisaHari,
              hoursLeft: sisaJam
            });
          }
        } catch(shErr) {
          console.warn("Gagal membaca sheet " + curName + ": " + shErr);
        }
      }

      return responseJSON({
        success: true,
        count: list.length,
        licenses: list,
        tools: availableTools,
        prefixMap: getPrefixMap(),
        hasSheet1Data: hasSheet1Data
      });
    }

    // =========================================================
    // 4. ADMIN: AKTIFKAN / TAMBAH LISENSI BARU KE SHEET TOOL
    // =========================================================
    if (action === "admin_add" || action === "admin_activate") {
      if (!hwid) return responseJSON({ success: false, error: "AppID tidak boleh kosong." });

      return executeWithLock(function() {
        var targetName = String(params.name || "Pembeli").trim();
        var targetPlan = String(params.plan || "1 Bulan").trim();
        var targetNotes = String(params.notes || "Ditambahkan via Admin App").trim();
        var targetTool = detectToolFromData(hwid, targetNotes, toolParam);

        var sheetTarget = getOrCreateToolSheet(ss, targetTool);
        var nowAdd = new Date();
        var expAddStr = "LIFETIME";

        if (targetPlan.toLowerCase().indexOf("lifetime") !== -1 || String(params.expiry || "").toUpperCase() === "LIFETIME") {
          expAddStr = "LIFETIME";
        } else {
          var pLow = targetPlan.toLowerCase();
          var daysToAdd = 30;
          var hoursToAdd = 0;

          if (params.hours && parseInt(params.hours) > 0) {
            hoursToAdd = parseInt(params.hours);
            daysToAdd = 0;
          } else if (params.days && parseInt(params.days) > 0) {
            daysToAdd = parseInt(params.days);
          } else if (pLow.indexOf("trial") !== -1 || pLow.indexOf("24") !== -1 || pLow.indexOf("1 hari") !== -1 || pLow.indexOf("sehari") !== -1) {
            daysToAdd = 1;
          } else if (pLow.indexOf("tahun") !== -1 || pLow.indexOf("year") !== -1 || pLow.indexOf("365") !== -1) {
            daysToAdd = 365;
          } else if (pLow.indexOf("bulan") !== -1 || pLow.indexOf("month") !== -1 || pLow.indexOf("30") !== -1) {
            daysToAdd = 30;
          }

          var addMs = (daysToAdd * 24 * 60 * 60 * 1000) + (hoursToAdd * 60 * 60 * 1000);
          var expTarget = new Date(nowAdd.getTime() + addMs);
          expAddStr = formatDate(expTarget);
        }

        var searchRes = searchHwidInSheet(sheetTarget, hwid);
        if (searchRes.found) {
          sheetTarget.getRange(searchRes.row, 2).setValue(targetName);
          sheetTarget.getRange(searchRes.row, 3).setValue(targetPlan);
          sheetTarget.getRange(searchRes.row, 4).setValue(formatDate(nowAdd));
          sheetTarget.getRange(searchRes.row, 5).setValue(expAddStr);
          sheetTarget.getRange(searchRes.row, 6).setValue("Aktif");
          sheetTarget.getRange(searchRes.row, 7).setValue(targetNotes);
        } else {
          sheetTarget.appendRow([hwid, targetName, targetPlan, formatDate(nowAdd), expAddStr, "Aktif", targetNotes]);
        }

        return responseJSON({
          success: true,
          tool: targetTool,
          message: "Lisensi " + targetTool + " untuk " + targetName + " (" + hwid + ") berhasil diaktifkan!"
        });
      });
    }

    // =========================================================
    // 5. ADMIN: PERPANJANG MASA AKTIF (+X HARI / JAM)
    // =========================================================
    if (action === "admin_extend") {
      if (!hwid) return responseJSON({ success: false, error: "AppID wajib diisi." });
      var addDays = params.days ? parseInt(params.days) : 0;
      var addHours = params.hours ? parseInt(params.hours) : 0;
      if (addDays === 0 && addHours === 0) {
        addDays = 30;
      }

      return executeWithLock(function() {
        var foundExtend = findLicenseAcrossSheets(ss, hwid, toolParam);
        if (!foundExtend.found) {
          return responseJSON({ success: false, error: "AppID tidak ditemukan di sheet tool mana pun." });
        }

        var curExp = foundExtend.data[4];
        var baseDate = new Date();
        var curParsed = parseFlexibleDate(curExp);
        if (curParsed && curParsed.getTime() > baseDate.getTime()) {
          baseDate = curParsed;
        }

        var addMs = (addDays * 24 * 60 * 60 * 1000) + (addHours * 60 * 60 * 1000);
        var newExp = new Date(baseDate.getTime() + addMs);
        var newExpStr = formatDate(newExp);

        foundExtend.sheet.getRange(foundExtend.row, 5).setValue(newExpStr);
        foundExtend.sheet.getRange(foundExtend.row, 6).setValue("Aktif");

        var durMsg = addDays > 0 ? (addDays + " hari") : (addHours + " jam");
        return responseJSON({
          success: true,
          tool: foundExtend.tool,
          message: "Berhasil memperpanjang lisensi " + hwid + " di tab " + foundExtend.tool + " selama " + durMsg + "."
        });
      });
    }

    // =========================================================
    // 6. ADMIN: UBAH STATUS (BLOKIR / AKTIFKAN)
    // =========================================================
    if (action === "admin_set_status") {
      if (!hwid) return responseJSON({ success: false, error: "AppID wajib diisi." });
      var newStatus = String(params.status || "Aktif").trim();

      return executeWithLock(function() {
        var foundStatus = findLicenseAcrossSheets(ss, hwid, toolParam);
        if (!foundStatus.found) {
          return responseJSON({ success: false, error: "AppID tidak ditemukan." });
        }

        foundStatus.sheet.getRange(foundStatus.row, 6).setValue(newStatus);
        return responseJSON({
          success: true,
          tool: foundStatus.tool,
          message: "Status " + hwid + " di tab " + foundStatus.tool + " diubah menjadi: " + newStatus
        });
      });
    }

    // =========================================================
    // 7. ADMIN: HAPUS LISENSI
    // =========================================================
    if (action === "admin_delete") {
      if (!hwid) return responseJSON({ success: false, error: "AppID wajib diisi." });

      return executeWithLock(function() {
        var foundDel = findLicenseAcrossSheets(ss, hwid, toolParam);
        if (!foundDel.found) {
          return responseJSON({ success: false, error: "AppID tidak ditemukan." });
        }

        foundDel.sheet.deleteRow(foundDel.row);
        return responseJSON({
          success: true,
          tool: foundDel.tool,
          message: "Lisensi " + hwid + " berhasil dihapus dari tab " + foundDel.tool + "."
        });
      });
    }

    // =========================================================
    // 8. ADMIN: BUAT SHEET TOOL BARU SECARA OTOMATIS
    // =========================================================
    if (action === "admin_create_tool") {
      var newToolName = cleanToolName(params.tool_name || params.tool);
      var newPrefix = String(params.prefix || params.tool_prefix || "").trim().toUpperCase();
      if (!newToolName) return responseJSON({ success: false, error: "Nama tool baru tidak boleh kosong." });

      return executeWithLock(function() {
        var createdSheet = getOrCreateToolSheet(ss, newToolName);
        if (newPrefix) {
          registerToolPrefix(newPrefix, createdSheet.getName());
        }

        return responseJSON({
          success: true,
          tool: createdSheet.getName(),
          prefix: newPrefix,
          tools: getAllToolNames(ss),
          prefixMap: getPrefixMap(),
          message: "Sheet tab '" + createdSheet.getName() + "'" + (newPrefix ? " (Prefix: " + newPrefix + ")" : "") + " berhasil dibuat di bagian bawah Spreadsheet!"
        });
      });
    }

    // =========================================================
    // 9. ADMIN: MIGRASI DARI SHEET1 KE TAB MASING-MASING TOOL
    // =========================================================
    if (action === "admin_migrate_sheet1") {
      return executeWithLock(function() {
        var sheet1 = ss.getSheetByName("Sheet1");
        if (!sheet1) {
          return responseJSON({ success: false, error: "Sheet1 tidak ditemukan atau sudah dipindahkan." });
        }

        var s1Data = sheet1.getDataRange().getValues();
        if (s1Data.length <= 1) {
          return responseJSON({ success: false, error: "Sheet1 kosong, tidak ada data untuk dimigrasikan." });
        }

        var migratedCount = 0;
        for (var m = 1; m < s1Data.length; m++) {
          var mRow = s1Data[m];
          var mHwid = String(mRow[0] || "").trim();
          if (!mHwid) continue;

          var mNama = mRow[1] || "Pembeli";
          var mPaket = mRow[2] || "1 Bulan";
          var mMulai = mRow[3];
          var mAkhir = mRow[4];
          var mStatus = mRow[5] || "Aktif";
          var mCatatan = mRow[6] || "";

          var mTool = detectToolFromData(mHwid, mCatatan);
          var targetSh = getOrCreateToolSheet(ss, mTool);

          var existCheck = searchHwidInSheet(targetSh, mHwid);
          if (!existCheck.found) {
            targetSh.appendRow([
              mHwid,
              mNama,
              mPaket,
              formatDate(mMulai),
              formatDate(mAkhir),
              mStatus,
              mCatatan
            ]);
            migratedCount++;
          }
        }

        try {
          var backupName = "_Backup_Sheet1_" + Utilities.formatDate(new Date(), "GMT+7", "yyyyMMdd_HHmmss");
          sheet1.setName(backupName);
        } catch(e) {
          sheet1.setName("_Backup_Sheet1");
        }

        return responseJSON({
          success: true,
          migratedCount: migratedCount,
          tools: getAllToolNames(ss),
          message: "SUKSES! " + migratedCount + " lisensi berhasil dipisahkan ke tab masing-masing tool. Sheet1 lama diarsipkan sebagai backup."
        });
      });
    }

    return responseJSON({ success: false, error: "Action tidak dikenali." });

  } catch (err) {
    return responseJSON({ success: false, error: "Server Error: " + err.toString() });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function parseFlexibleDate(val) {
  if (!val) return null;
  if (val instanceof Date) return isNaN(val.getTime()) ? null : val;
  var s = String(val).trim();
  if (!s || s.toUpperCase() === "LIFETIME" || s.toUpperCase() === "PERMANENT" || s === "-") return null;

  // Handle Indonesian dot separator in time: "2026-10-04 11.14.42" -> "2026-10-04 11:14:42"
  var timeMatch = s.match(/\b(\d{1,2})\.(\d{2})\.(\d{2})\b/);
  if (timeMatch) {
    s = s.replace(timeMatch[0], timeMatch[1] + ":" + timeMatch[2] + ":" + timeMatch[3]);
  }

  // Coba native Date
  var d = new Date(s);
  if (!isNaN(d.getTime())) return d;

  // Coba format DD/MM/YYYY atau DD-MM-YYYY
  var dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (dmyMatch) {
    var day = parseInt(dmyMatch[1], 10);
    var month = parseInt(dmyMatch[2], 10) - 1;
    var year = parseInt(dmyMatch[3], 10);
    var hour = dmyMatch[4] ? parseInt(dmyMatch[4], 10) : 0;
    var min = dmyMatch[5] ? parseInt(dmyMatch[5], 10) : 0;
    var sec = dmyMatch[6] ? parseInt(dmyMatch[6], 10) : 0;
    var res = new Date(year, month, day, hour, min, sec);
    if (!isNaN(res.getTime())) return res;
  }

  // Coba format YYYY/MM/DD atau YYYY-MM-DD
  var ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if (ymdMatch) {
    var y = parseInt(ymdMatch[1], 10);
    var m = parseInt(ymdMatch[2], 10) - 1;
    var d2 = parseInt(ymdMatch[3], 10);
    var h = ymdMatch[4] ? parseInt(ymdMatch[4], 10) : 0;
    var mi = ymdMatch[5] ? parseInt(ymdMatch[5], 10) : 0;
    var se = ymdMatch[6] ? parseInt(ymdMatch[6], 10) : 0;
    var res2 = new Date(y, m, d2, h, mi, se);
    if (!isNaN(res2.getTime())) return res2;
  }

  return null;
}

function formatDate(d) {
  if (!d) return "-";
  if (d === "LIFETIME") return "LIFETIME";
  var dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return String(d);
  var year = dt.getFullYear();
  var month = ("0" + (dt.getMonth() + 1)).slice(-2);
  var day = ("0" + dt.getDate()).slice(-2);
  var hours = ("0" + dt.getHours()).slice(-2);
  var minutes = ("0" + dt.getMinutes()).slice(-2);
  var seconds = ("0" + dt.getSeconds()).slice(-2);
  return year + "-" + month + "-" + day + " " + hours + ":" + minutes + ":" + seconds;
}

// =====================================================================
// ANTARMUKA MOBILE ADMIN APP (CYBER-NEON MDC.Dev MULTI-TOOL THEME)
// =====================================================================
function getMobileAppHtml() {
  var serviceUrl = "";
  try {
    serviceUrl = ScriptApp.getService().getUrl() || "";
  } catch(e) {}
  if (!serviceUrl) {
    serviceUrl = DEFAULT_APP_URL;
  }

  return `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
  <meta name="theme-color" content="#070A11">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <link rel="manifest" href="manifest.json">
  <link rel="icon" type="image/png" sizes="192x192" href="icons/icon-192.png">
  <link rel="apple-touch-icon" href="icons/icon-192.png">
  <title>MDC License Admin • Multi-Tool</title>
  <style>
    :root {
      --bg-main: #070A11;
      --card-bg: #0F1626;
      --card-border: #1B273D;
      --input-bg: #141D2F;
      --cyan-neon: #00F0FF;
      --cyan-glow: #00C8D6;
      --cyan-dim: #082B36;
      --text-white: #F8FAFC;
      --text-muted: #8EA0B8;
      --text-cyan: #38BDF8;
      --success: #10B981;
      --danger: #F43F5E;
      --warning: #F59E0B;
      --purple-neon: #A855F7;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background-color: var(--bg-main); color: var(--text-white); min-height: 100vh; padding-bottom: 50px; }
    
    /* Top Bar */
    .topbar { background: var(--card-bg); border-bottom: 1px solid var(--card-border); padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 100; backdrop-filter: blur(10px); }
    .brand { display: flex; align-items: center; gap: 10px; }
    .logo-circle { width: 36px; height: 36px; border-radius: 50%; border: 2px solid var(--cyan-neon); background: #000; display: flex; align-items: center; justify-content: center; font-weight: 800; color: var(--cyan-neon); font-size: 16px; box-shadow: 0 0 10px rgba(0,240,255,0.3); }
    .brand-title { font-size: 14px; font-weight: 800; color: var(--text-white); letter-spacing: 0.5px; }
    .brand-sub { font-size: 9px; font-weight: 700; color: var(--cyan-neon); letter-spacing: 1px; }
    
    .container { max-width: 520px; margin: 0 auto; padding: 12px; }
    
    /* Tips PWA Banner */
    .pwa-tip { background: rgba(15, 22, 38, 0.9); border: 1px solid #1E3A8A; border-radius: 12px; padding: 10px 14px; margin-bottom: 12px; font-size: 11px; color: #BAE6FD; display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; line-height: 1.4; }
    .pwa-tip-close { color: var(--text-muted); cursor: pointer; font-size: 16px; padding: 0 4px; font-weight: bold; }
    
    /* Migration Banner */
    .migration-banner { background: linear-gradient(90deg, #1e1b4b, #311042); border: 1px solid var(--purple-neon); border-radius: 12px; padding: 12px 14px; margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; gap: 10px; box-shadow: 0 0 15px rgba(168,85,247,0.2); }
    .migration-text { font-size: 11px; color: #E9D5FF; }
    .migration-btn { background: var(--purple-neon); color: #fff; font-size: 11px; font-weight: bold; border: none; border-radius: 6px; padding: 6px 12px; white-space: nowrap; cursor: pointer; }
    
    /* Tool Switcher Horizontal Scroll */
    .tool-scroll-wrapper { margin: 6px 0 12px 0; overflow-x: auto; white-space: nowrap; padding-bottom: 6px; display: flex; gap: 8px; -webkit-overflow-scrolling: touch; }
    .tool-scroll-wrapper::-webkit-scrollbar { height: 4px; }
    .tool-scroll-wrapper::-webkit-scrollbar-thumb { background: var(--card-border); border-radius: 4px; }
    .tool-chip { display: inline-flex; align-items: center; gap: 6px; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 20px; padding: 8px 14px; font-size: 12px; font-weight: 700; color: var(--text-muted); cursor: pointer; transition: all 0.2s ease; flex-shrink: 0; user-select: none; }
    .tool-chip.active { background: var(--cyan-dim); border-color: var(--cyan-neon); color: var(--cyan-neon); box-shadow: 0 0 10px rgba(0,240,255,0.25); }
    .tool-chip-add { background: #131E33; border: 1px dashed var(--text-cyan); color: var(--text-cyan); }
    
    /* Login PIN Card */
    .pin-card { background: var(--card-bg); border: 1px solid var(--cyan-dim); border-radius: 16px; padding: 32px 20px; text-align: center; margin-top: 30px; box-shadow: 0 8px 30px rgba(0,0,0,0.6); }
    .pin-input { width: 100%; max-width: 220px; height: 48px; background: var(--input-bg); border: 2px solid var(--card-border); border-radius: 10px; color: var(--cyan-neon); font-size: 24px; text-align: center; letter-spacing: 8px; font-weight: bold; margin: 18px 0; outline: none; }
    .pin-input:focus { border-color: var(--cyan-neon); box-shadow: 0 0 12px rgba(0,240,255,0.3); }
    
    /* Stats Grid */
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 12px; }
    .stat-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 12px 6px; text-align: center; }
    .stat-num { font-size: 20px; font-weight: 800; color: var(--cyan-neon); }
    .stat-lbl { font-size: 9px; color: var(--text-muted); font-weight: 700; text-transform: uppercase; margin-top: 3px; letter-spacing: 0.5px; }
    
    /* Action Section */
    .section-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 14px; padding: 16px; margin-bottom: 14px; box-shadow: 0 4px 15px rgba(0,0,0,0.3); }
    .section-title { font-size: 13px; font-weight: 800; color: var(--cyan-neon); margin-bottom: 12px; display: flex; align-items: center; justify-content: space-between; }
    
    /* Forms */
    .form-group { margin-bottom: 10px; }
    .form-label { font-size: 10px; font-weight: 800; color: var(--text-muted); display: block; margin-bottom: 4px; letter-spacing: 0.5px; }
    .form-input, .form-select { width: 100%; height: 42px; background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 8px; color: var(--text-white); padding: 0 12px; font-size: 13px; outline: none; }
    .form-input:focus, .form-select:focus { border-color: var(--cyan-neon); }
    .form-row { display: flex; gap: 8px; }
    
    /* Plan Buttons Grid */
    .plan-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; margin-bottom: 10px; }
    .plan-btn { background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 8px; padding: 10px; color: var(--text-white); font-size: 11px; font-weight: 700; text-align: center; cursor: pointer; transition: all 0.15s ease; user-select: none; }
    .plan-btn.active { border-color: var(--cyan-neon); background: var(--cyan-dim); color: var(--cyan-neon); font-weight: bold; }
    
    
    
    /* Cyber-Neon QR Scanner Frame & Laser */
    .scanner-box {
      width: 200px;
      height: 200px;
      position: relative;
      border: 1px solid rgba(0, 240, 255, 0.3);
    }
    .laser-line {
      position: absolute;
      width: 100%;
      height: 2px;
      background: var(--cyan-neon);
      box-shadow: 0 0 12px var(--cyan-neon), 0 0 20px var(--cyan-neon);
      top: 0;
      animation: scanLaser 2s infinite ease-in-out alternate;
    }
    @keyframes scanLaser {
      0% { top: 5%; opacity: 0.3; }
      50% { opacity: 1; }
      100% { top: 95%; opacity: 0.3; }
    }
    .scanner-corner {
      position: absolute;
      width: 18px;
      height: 18px;
      border-color: var(--cyan-neon);
      border-style: solid;
    }
    .scanner-corner.tl { top: -2px; left: -2px; border-width: 3px 0 0 3px; }
    .scanner-corner.tr { top: -2px; right: -2px; border-width: 3px 3px 0 0; }
    .scanner-corner.bl { bottom: -2px; left: -2px; border-width: 0 0 3px 3px; }
    .scanner-corner.br { bottom: -2px; right: -2px; border-width: 0 3px 3px 0; }
    #qr-reader video { border-radius: 12px; object-fit: cover !important; }
    #qr-reader { border: none !important; }

    /* PWA Install Banner & Buttons */
    .install-banner {
      background: linear-gradient(135deg, #0a1428 0%, #11203b 100%);
      border: 1px solid var(--cyan-glow);
      border-radius: 14px;
      padding: 12px 14px;
      margin-bottom: 14px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      box-shadow: 0 0 20px rgba(0, 240, 255, 0.2);
      animation: pulseGlow 3s infinite alternate;
    }
    @keyframes pulseGlow {
      0% { box-shadow: 0 0 10px rgba(0, 240, 255, 0.15); border-color: #1E3A8A; }
      100% { box-shadow: 0 0 22px rgba(0, 240, 255, 0.35); border-color: var(--cyan-neon); }
    }
    .install-banner-left { display: flex; align-items: center; gap: 10px; }
    .install-banner-logo { width: 36px; height: 36px; border-radius: 50%; border: 1.5px solid var(--cyan-neon); flex-shrink: 0; object-fit: cover; }
    .install-banner-title { font-size: 12px; font-weight: 800; color: var(--text-white); letter-spacing: 0.5px; }
    .install-banner-sub { font-size: 10px; color: #BAE6FD; line-height: 1.3; }
    .install-banner-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
    .btn-install-primary {
      background: var(--cyan-neon);
      color: #000;
      font-size: 11px;
      font-weight: 800;
      border: none;
      border-radius: 8px;
      padding: 8px 12px;
      cursor: pointer;
      white-space: nowrap;
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
      transition: transform 0.1s;
    }
    .btn-install-primary:active { transform: scale(0.96); }
    .btn-install-dismiss {
      background: transparent;
      border: none;
      color: var(--text-muted);
      font-size: 14px;
      padding: 4px;
      cursor: pointer;
    }
    .btn-install-glow {
      background: var(--cyan-dim);
      color: var(--cyan-neon);
      border: 1px solid var(--cyan-neon);
      box-shadow: 0 0 8px rgba(0, 240, 255, 0.25);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-weight: 800;
    }
    .brand-logo-img {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      border: 2px solid var(--cyan-neon);
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
      object-fit: cover;
      background: #000;
    }
    .login-logo-img {
      width: 64px;
      height: 64px;
      border-radius: 50%;
      border: 2px solid var(--cyan-neon);
      box-shadow: 0 0 18px rgba(0, 240, 255, 0.5);
      margin: 0 auto 12px auto;
      display: block;
      object-fit: cover;
      background: #000;
    }

    /* Buttons */
    .btn-primary { width: 100%; height: 46px; background: var(--cyan-neon); border: none; border-radius: 8px; color: #000; font-size: 13px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; box-shadow: 0 0 12px rgba(0,240,255,0.35); transition: all 0.15s; }
    .btn-primary:active { background: var(--cyan-glow); transform: scale(0.98); }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-sm { padding: 8px 12px; border-radius: 6px; font-size: 11px; font-weight: 700; border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 4px; min-height: 36px; user-select: none; }
    
    /* License Card Item */
    .lic-card { background: var(--input-bg); border: 1px solid var(--card-border); border-radius: 12px; padding: 12px; margin-bottom: 10px; }
    .lic-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
    .lic-name { font-size: 13px; font-weight: 800; color: var(--text-white); }
    .lic-tool-tag { font-size: 9px; font-weight: 800; padding: 2px 6px; border-radius: 4px; background: #112240; color: var(--text-cyan); border: 1px solid #1D4ED8; margin-top: 2px; display: inline-block; }
    .lic-hwid { font-family: 'Consolas', monospace; font-size: 11px; color: var(--cyan-neon); margin: 4px 0 6px 0; word-break: break-all; font-weight: bold; }
    .lic-meta { display: flex; justify-content: space-between; font-size: 10px; color: var(--text-muted); margin-bottom: 8px; border-bottom: 1px solid var(--card-border); padding-bottom: 6px; }
    .lic-actions { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
    
    /* Badges */
    .badge { padding: 4px 8px; border-radius: 4px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
    .badge-active { background: rgba(16, 185, 129, 0.15); color: var(--success); border: 1px solid var(--success); }
    .badge-banned { background: rgba(244, 63, 94, 0.15); color: var(--danger); border: 1px solid var(--danger); }
    .badge-trial { background: rgba(245, 158, 11, 0.15); color: var(--warning); border: 1px solid var(--warning); }
    .badge-expired { background: rgba(142, 160, 184, 0.15); color: var(--text-muted); border: 1px solid #334155; }
    
    /* Toast Notifications System */
    #toast-container { position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); z-index: 9999; display: flex; flex-direction: column; gap: 8px; width: 90%; max-width: 400px; pointer-events: none; }
    .toast { background: rgba(15, 22, 38, 0.95); border: 1px solid var(--card-border); border-radius: 10px; padding: 12px 16px; font-size: 12px; color: var(--text-white); box-shadow: 0 8px 25px rgba(0,0,0,0.8); display: flex; align-items: center; gap: 10px; opacity: 0; transform: translateY(20px); transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); pointer-events: auto; }
    .toast.toast-show { opacity: 1; transform: translateY(0); }
    .toast-success { border-color: var(--success); }
    .toast-error { border-color: var(--danger); }
    .toast-warning { border-color: var(--warning); }
    .toast-info { border-color: var(--cyan-neon); }
    
    /* Custom Modal Confirmation */
    .modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.75); backdrop-filter: blur(4px); z-index: 2000; display: flex; align-items: center; justify-content: center; padding: 16px; }
    .modal-card { background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 16px; width: 100%; max-width: 360px; padding: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.8); text-align: center; }
    .modal-title { font-size: 15px; font-weight: 800; color: var(--cyan-neon); margin-bottom: 8px; }
    .modal-msg { font-size: 12px; color: var(--text-muted); margin-bottom: 18px; line-height: 1.5; }
    .modal-actions { display: flex; gap: 8px; justify-content: center; }
    .modal-btn { flex: 1; height: 40px; border-radius: 8px; font-size: 12px; font-weight: 700; border: none; cursor: pointer; }
    .modal-btn-cancel { background: var(--input-bg); color: var(--text-muted); border: 1px solid var(--card-border); }
    
    /* Spinner */
    .spinner-sm { width: 14px; height: 14px; border: 2px solid rgba(0,0,0,0.2); border-top-color: currentColor; border-radius: 50%; display: inline-block; animation: spin 0.6s linear infinite; }
    .spinner-cyan { border: 2px solid rgba(0,240,255,0.2); border-top-color: var(--cyan-neon); }
    @keyframes spin { to { transform: rotate(360deg); } }
    
    .hidden { display: none !important; }
  </style>
  <script src="https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js"></script>
</head>
<body>

  <!-- Toast Container -->
  <div id="toast-container"></div>

  <!-- Confirmation Modal -->
  <div id="confirm-modal" class="modal-overlay hidden">
    <div class="modal-card">
      <div class="modal-title" id="modal-title">Konfirmasi</div>
      <div class="modal-msg" id="modal-message">Apakah Anda yakin?</div>
      <div class="modal-actions">
        <button class="modal-btn modal-btn-cancel" onclick="closeConfirmModal()">Batal</button>
        <button class="modal-btn" id="modal-btn-confirm" onclick="executeModalConfirm()">Ya, Lanjutkan</button>
      </div>
    </div>
  </div>

  <!-- Top Bar -->
  <div class="topbar">
    <div class="brand">
      <img src="data:image/png;base64,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" class="brand-logo-img" alt="Logo">
      <div>
        <div class="brand-title">MDC LICENSE ADMIN</div>
        <div class="brand-sub">MULTI-TOOL CONTROL CENTER</div>
      </div>
    </div>
        <div style="display:flex; align-items:center; gap:8px;">
      <button id="btn-topbar-install" class="btn-sm btn-install-glow hidden" onclick="installPWA()" title="Pasang ke Layar Utama HP">📲 Pasang di HP</button>
      <div id="logout-btn" class="hidden">
        <button class="btn-sm" style="background:var(--input-bg); color:var(--danger); border:1px solid var(--danger);" onclick="logout()">Keluar</button>
      </div>
    </div>
  </div>

  <div class="container">
  <!-- PWA Install Banner -->
  <div id="pwa-install-banner" class="install-banner hidden">
    <div class="install-banner-left">
      <img src="data:image/png;base64,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" class="install-banner-logo" alt="Logo">
      <div>
        <div class="install-banner-title">MDC License Admin</div>
        <div class="install-banner-sub">Pasang di layar utama HP untuk akses cepat & bebas eror</div>
      </div>
    </div>
    <div class="install-banner-actions">
      <button type="button" class="btn-install-primary" onclick="installPWA()">📲 Pasang di HP</button>
      <button type="button" class="btn-install-dismiss" onclick="dismissInstallBanner()" title="Tutup">✕</button>
    </div>
  </div>

  
  <!-- Modal Scanner QR Code (Cyber-Neon Camera) -->
  <div id="qr-scanner-modal" class="modal-overlay hidden" style="z-index:9999;">
    <div class="modal-box" style="max-width:420px; padding:16px; border-color:var(--cyan-neon); box-shadow:0 0 30px rgba(0,240,255,0.35);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:8px;">
          <span style="font-size:18px;">📷</span>
          <div>
            <div style="font-size:13px; font-weight:800; color:var(--cyan-neon);">Scan QR AppID Pembeli</div>
            <div style="font-size:9px; color:var(--text-muted);">Arahkan kamera ke layar software pembeli</div>
          </div>
        </div>
        <button type="button" onclick="stopQrScanner()" style="background:transparent; border:none; color:var(--text-muted); font-size:18px; cursor:pointer; padding:4px 8px;">✕</button>
      </div>

      <!-- Viewfinder Video / Scanner Area -->
      <div id="qr-reader-container" style="position:relative; width:100%; border-radius:12px; overflow:hidden; background:#000; min-height:260px; display:flex; align-items:center; justify-content:center; border:1px solid var(--card-border);">
        <div id="qr-reader" style="width:100%;"></div>
        
        <!-- Cyber-Neon Scanner Overlay -->
        <div id="qr-scanner-overlay" style="position:absolute; inset:0; pointer-events:none; display:flex; align-items:center; justify-content:center;">
          <div class="scanner-box">
            <div class="laser-line"></div>
            <div class="scanner-corner tl"></div>
            <div class="scanner-corner tr"></div>
            <div class="scanner-corner bl"></div>
            <div class="scanner-corner br"></div>
          </div>
        </div>
      </div>

      <!-- Controls & Status -->
      <div style="margin-top:10px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
        <button type="button" class="btn-sm" style="background:var(--input-bg); color:var(--text-cyan); border:1px solid var(--card-border); font-size:11px;" onclick="switchCamera()">🔄 Balik Kamera</button>
        <button type="button" class="btn-sm" style="background:var(--input-bg); color:var(--text-cyan); border:1px solid var(--card-border); font-size:11px;" onclick="document.getElementById('qr-file-input').click()">🖼️ Gambar/WA</button>
        <input type="file" id="qr-file-input" accept="image/*" class="hidden" onchange="scanQrFromImage(this)">
      </div>

      <div id="qr-status-msg" style="font-size:10px; color:var(--text-muted); text-align:center; margin-top:8px;">
        Mencari kode QR AppID...
      </div>
    </div>
  </div>

  <!-- Modal Tampilkan QR Code Lisensi -->
  <div id="view-qr-modal" class="modal-overlay hidden" style="z-index:9998;">
    <div class="modal-box" style="max-width:340px; text-align:center; border-color:var(--cyan-neon);">
      <div style="font-size:14px; font-weight:800; color:var(--cyan-neon); margin-bottom:4px;" id="modal-qr-title">QR Code Lisensi</div>
      <div style="font-family:'Consolas', monospace; font-size:12px; color:var(--text-white); font-weight:bold; margin-bottom:12px;" id="modal-qr-hwid"></div>
      
      <div style="background:#fff; padding:12px; border-radius:12px; display:inline-block; margin-bottom:12px; box-shadow:0 0 15px rgba(0,240,255,0.3);">
        <img id="modal-qr-img" src="" style="width:200px; height:200px; display:block;" alt="QR Code">
      </div>
      
      <div style="font-size:10px; color:var(--text-muted); margin-bottom:14px;">Tunjukkan atau scan QR ini untuk aktivasi otomatis</div>
      <button type="button" class="btn-primary" style="height:38px; font-size:12px;" onclick="closeViewQrModal()">Tutup</button>
    </div>
  </div>

  <!-- Modal Panduan Install di HP (iOS & Fallback) -->
  <div id="install-modal" class="modal-overlay hidden">
    <div class="modal-box" style="max-width:380px; text-align:left;">
      <div style="display:flex; align-items:center; gap:10px; margin-bottom:12px;">
        <img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAABbgklEQVR42u29d9xmVXX3/V37nKvddXofmEIZGESKiFjoYMRCRCGxvGqKxqiJJkaf1EdNTI/xyZOijyYxJrYAVqygIEhvUpwZBpjGMH3uXq5yztnr/WPvc86+rnsG0Uhi3vfBz+3cvZy99iq/9Vu/Jfz3+08Aw/veJ3zwgykAWRZ+fBg4Fjie409cR1xZwxlnLiNJlqF2AWc9v4GJ66SdOqqCCGCUuNJCbVvuua2pyKjElf36wD0H6CQ7efzR7cBjwC5grPhJUeT+/f3fj/nABxSwgP53e5j/fQ796qvhNa/JsBZU8/cfB5zOWeecyUkbN7L+hDWsWbeQVcf0s2atUKvDgoEUg8WQMZkqoBhju36CtQYQBmNBibAYRqdj2i3YuUN5YmeTXTtG2LZ1F1u3bObuO+4Fvg88ClhEwBj47GcjrrqK/y7G8NNuAIYrrxS+8IUsuOXDwDmcdsYlnH7W8zn9Ocdx2pmDnHiSMr/eISFh55PK4YOWB75fYXJMZNPDVcbHDCrCtkcralNERAAUZw+iKFEE605MEJR586xuPLXD0DzltDMSFi8V1qw0xFQYa1XZukXk+/dN6wP3bOf+u+/kwQeuB24HRgvvcMUVEddck3uG/2sAP8J/EapKHFt/8A3gAs6/5Gd5wbkv5IyzjuH5LzIs62uxdzaRzQ/BHbdWuO/Omm57vCqHDsTanAWrYDOIK4hEIALVKmpAFPe2dl9SbbX9g1FIElQEiQw0+mDJ0pR16zt65vPanPPChI2nKsv7KuyfbXDb95T7736S2793G9+94cvAjcAUUQRpanAGl/1fA/jhB2+JIsVagJM5aePPc+Glr+RnXrGO889XqjTZvC3jhm9WuPFbDdn8g5qMjRhFUWOQas0fsnEHTM8hq3b91d4NBO+Iuj+oPtxYC0kH7bQhs2AEmb/QcvKz2nrBpU0ufUmHk9dFtOnjppuMfPO6nXrjt67jkc2fAR7EuAiDzaKfJkOQn6qDF6P+NC7lhRe8hctffR5XXDXAukXTbN6d8q//WOc71/ez/dGKdBLnZhsNqFRQiUAV8Yfdda+l+88M39Tu/zvCI1HmWowzKkk70GxCmkKtiq47PuHCS2d4w5tbnLwqZtvhAT7/uRbXff4Wbv3ux4CvFeEh++kwBPkvj/GqYIz1t/TlctVr36lXvu55XHyZ0s8Un766wic+Nsgjm2vMTEGjgdTqaGTy5K34VnMOiW43LyJHNAjtdgFdtiCq/uNSvl58XMvvZRVpttBmExkagg0ntfUNb57i9VclzDDIDV83cs1n7jXXfPrvMrgWEcVa47/e/v/NAIQrrzRBcvdirnzte3njm8/hxed3GEtm5CMf7uNT/zLI/r0RUQyNfojzw1QU6TpIKQxAysPz9zevF4z//B8lNVfxYUPV/QzV4rtqEVqcUQgGxCBZijZn0DSFZSszXvfGKd7+mzPMj/v5xk11+cTH7tUvfO4vga9gInjVFRHXXPNfUjXIf4m7N1GGzQBO5fkveh+//I7L+IWrWjx2oCl/9oFBvvW1fp0YE2n0Q63un7EtDhIpD1/EEJ6q5DFcyktl/dfIUz0ADQ68JwKIzx0U41+33ghLb+BeV0SdkaoxrrpotdHmLMybr3LpS2b0t98/xfFL6nzi3/vl43/3bb3j1vcB9/5XhYXoP/nWR2zZkqG2n1XHvI/3/P7f8bcfP4GTN47xgT+syTt+eREPPlClUhHpHwQTlQ/aCCIGMYIYf9NyQ+h9MQJiXF0uxn0fYxAx7hDDj4lx4SN/vff9SBk+RJyBeO8igRcqX5cys1SQKEL6+pA0FR64vyr/9s+DjM92eMvbxvh/fvEEGv1vYOuWJUxO3IVIkyuvjNi8+f9zHsBgjPXx+hJ59c/9lf72Bzdw5nGH+d8fq8uH/2KeHjpoGBpG4gpY6w5dBCkeurjbFXgACbK64uaqz/6lOxyoHO2P7v6ges8hoT/OcwgV0KzIDbBhwum9gbp/VRSxznjdv95wsxSdnEQWL7b6zveO8843N7n/8cV88Pe288Wr3wtchzFg7X+KN/jP8ACxc/m2zvKVfy5/+uEP6V/9SYP9I9NcecUiPvPJAQSRwUF3MFbdefgbixjE5Lc98jdTin/VuFurOGMR4zyAirgLHIn3Hu5jknuIrheKF2db4n8+gUdxJlF6HYOGthMapZQZCeHPU3+e/X1Iuynyza82+Pq3Grzk5SO861cGWbj69dx/30qmJ2/GRG1U42c6QXxmDaB0+Ru59KVf5J8/97NcfvEh/uCPG7zrVxZx8GDEvPnORauWrtk/cPGHmx+4+vflBlEcthEwkQ8Rkf+6qPxc/3bh4omdMeXv8wdafNyUhgc+9EhukILmnyv4UOR/Hyh/9zxIGP+6BNWHWlcK9vXD3t2RfOZfBmUqSfjtd45y4eUvYttjl7P90XsRefKZDgnyjH1f12ixwGt553v/hr/885hHd83yltcv5sEHKjK8AKIItVkRO8XfKDHubZXwWlKEBOdrjTcK9WFCyjLPP/AiacQEH+vN9PSIT0FVCWsGVcWhFBrgBtZVAnmssA6HUHVu38EF2pU4uvCWg0veYLIMJifgWacnfPzThzhxdYPfeE/E3/3Ve4CP+Wcpz4Q3kGck3keRg3DXHfcn8gd//Fv6pqsO8/FPV3nfexdKq4kODSOZ9Wch/jApk63chRN5o3AHqCb4HH+oeX6Q5wxldSBluV4kdD0p/5zHoD2vu1JfUQdXkMMVWpaDRZ1pUbUuL1B1ULPmBuDbAb6cVLUlOunzCCLjjKDWgD/8yxHe/NqW/PPnlukHf+8f2LH9Xf6Zmp+0EchPPKREUUaWNTjjrH/lL//2lVx49l5+8a0LuObT/TIwz6F2mhYuVNQUB16AbBJ5d+tuiHovIMYfkImKzNsZRZ59+3DQAwbl7njO8YvvCQTwsIgEyLF2eQAJc0J1h+q+PoCLC/uwLlEsXrel5/AJZF46OvvInDdIU5iaQq587Yz+80dH+M6dq3jP27/J9+9/HVE0/pMuFeUZOPwlnH/pNXzyc2czPP+gvOS8ZfrgvRUWLva3iW6Xnt/+4jYHLr9I/vKYq97tm6LscoVB6QnyxEuOCANLVwSY+xEpDyWsA7QHK1T1n+JdvSpqFcEGlYDHCqyWBpJ7hjwU5GGg+Lgt84qRw+hpZyZ8/eb9TI4v5vVXbOaWm15JFD3xkzQC+cmBOybD2mN54flf5dqvr2PvnnHzyp9ZphPjRocGkCzzN9c4R5tnx2GmjKAmAqOepxH5g3YJYJms5SEizL7Lww3jfR4Kip+pJfhb5hPS3SwK39vVJ9DghqvvFdnCKIqbrYohKw3HehDLemxAs+JzHbfB/0bWFqFC4hidmkKGFlj9wjf2s2rlEJdfeoA7vncZxjyKtTGQ/jQYQH7zj+G8i2/g37+ygn17JnnphctpzQr9A2AzH8OjMiYX8brM+hHjyvgcyClq/rjEBPIET6Qs0wrYVwoDKH1AHhb85/tb3mUQRXauzlV7l18kcd4jqFr/fYPYr6EHKHEAdzb5Advi81UtkuWNxsx/f1vmBuReIUOiCKZnodGv+tVv72PlqgFefdk4t9x4CVH06E/CE8hP9PC/esMytj42LZdfvFxbLaHRQKx1tbgvn0xePyOIiXKQ3iF0Rlxhmtf6Jk8AIzRE5AqDoSsMlG9L2RuQoDFA9+tFQufre3eru5PAIvbbIC8oXDZBnC+BoMLErHW1f54YIs5j+APOvYULHYERKIXhiKkgrSZaq6t++Vv72XBCg5dcOMktN/1EjED+Y+heZLHZYl547o1c+8017Nk9xSsuWUarLdQb7uZHBs0BGDFBhu/qbJUc8fOEjaiM8Sq5d6BI8sQnfcXHgrq7DAvGG4AeqcHnMz8fCnqrwDkZYl7xBZ/YdattECFy1M/3LtQRUqTLOEAz68pfn28Ym99+i4scZU4gFsdzaLWg7o1g9bH9XH7pYe645XyM2e3pbPY/0wDyOr/O+Rd/g899+Tns2zvOyy5aTqsl0tfvIM8CzKGs540BibxRRB6BkwJw0cjdXtdM8QldECLy0k9zcKc4rLKU7Eouj9DgUdGgCSQYFcq0z3YRBVRscHjiO4BlUpff7sKl2LBEVNTaMoR4LqOoNwB/0C4k5AZjyTmP+dui6jCT2SbSqKte9519rFw5xBWXPc6tN12A6sSPixPIj3X4V19tuOqqjNPPvJovffsVjBwe4eUXLqfVEup97gGYHLXzB1AgcbGDbo1z7URBrO89aCMF0hY2e9Q3hkpI1n9MSzAp9xqSYw1iygt8pAogBHS0vOFlqWa9ofTGakU1K8pJhwXYrlufv1/yXEEVsba49Zrh8gDrjctmkGlpBJq5MCERNJtIvaH2uu/sY9HiBfKyC2/Sh+5/BVdfrVx11Y/cUv7RDeC882JuuSVl7fo/5mP/9tuc+bw9ctr6VUxNivb3IRlo5LF034VTI0gcg4ndwUeRg0JNbgDB4YpPEo2gxM4riPjcITAS41y5SlAqhjE+LP+klzsgXW1c7YoKQUlWEL0zd6gWNH89z/DzjL44QP92FnoFW1YI3gBKI8srh8yXlBlqLcb6vogHmMR/HzUGMzuLDg2rPvj4bu65axW/9Np/YNf2X+O882Juvjl9Jg3AJX2qP8fHPvVpfuk1e8055y7TLZsqOjSI2MyBOEacy4piJKpApQJxBHEFoorr+MUxGkWlkXS5+xyPDysFd4PVBN1BI124QZ4IqpboYVEa5tm7yNw/O7ip+eGoWtR6V51lSGpBU387/S21ZeIm+dv+wEzuHWzuxikMwFUT5c8RBbWp+/qsxBbEavH91HsNNHOXZ3oaPemUhNtu3sc/fXY1b3n9WxH5GFn2I5WH8mNAvCfxjvfcyt/+RVt+4a1D8rl/69fFi9EsLdy8GIFKjMZ1pFKBWhVTrUGlhtbqSKXqiJuVGI0q5QH2gEFFYhj0+VW6W8J0lZR09efzUlGlpxfcwwYWDdA9te6AswyyFLIUSVPIEofSpZlj/GRZ+Tk29dl9Htcz5zls4AFsftClhylifo4UegNwn58bZOaNxucOueeIIjh8CK56wyz/8tEx3vYb8/jI/zqfKLr3R6kM5EeM+xUu+pmb+cY3TpRPfDqVd/3KQl240P3hPnETYxxfL64g9T5MrU4WR0i9H+kfxA70O2Oo1aBSQUzsYn1RLZgA2i0NSvPav6cELPKAAO4t+gZ5uZnX/6rF6yHwU7C+8CWZVUyaH3CCJCkkHbJOG5IO0knQNEGzBEkSSBNIrTeYxHlCGyaJzpOIDcKB2uBzAgPwnkcy9c2lDM1siUiqdUASikqMjI6gf/2RUd78erjokv1899vnoDqNiD6dfECedlv32mszliz7S75+87uoNQ7IRWevdN3+2P8yFC1YTIRWa0ijD1Nr0L9qNZ2+IWyjn2jeENLow0YRmocGY1wuYKTg1TkPYAKIWDD+8AvsJoCJpWDhOOOwQWIpBHMAhF1CCthXfcZu05Ss00HbHWynA0kCiXP7xiZIpwPtNrbdgk4Labu3NU0gS9AkcR4jz+ZtWnqGzBYGkVcI2NIAxBNhNE8CrcV4sKioLrTMCRSBNMOoxX7nrr0k7cW85IX/wsGDb+HVr4645prsJ2EALu7D+Xzoo9/knb98UM45dxlbNlUYHPa33yV+ee9d4wpUqkhfP1ZiNlx0Eef+1rs4oJaOgo0rtFXp+JhuRBAtqsEcmim4vsWB2SBMqAYH2oXsdIE+BYkoQHyz3pavL/FsfgvTlKzVpjPbZHZykpmxCaZGxpkeHcVOTUO7g6QJptNEmy1Xo7dbaKeFdjpIp4MkKTZNwSbOk9gQ/g3yB28EYm2AL/jcIbOIJkH40O7woerC5NQEsuHk1N75vb38zcdW8O63XQFc93RCgTzNer/B5a++nS9ds5I/+OOYD/3JsCxaDFnmARnvb6MczYuRag2tNZCBQWylxsarXsXZb34Te23GhCpNDLMWMlXHSzGKUYuqFBSr8KaKHoHU2QPhhy2bbua3lPBu0OPzd7/g97n+kxKLEEtExUBVoGJBOh2yyWkm9u7j0M7djO7ZRzI+iSQdok4bWrPY2SY0Z9G2MwrttJEk80aQ+IQQl0xmWVAd4L2D4wpI7i00zzG0KCHzhFWxPtSkEFXh0Ci8+39M8sHfa/PyKyb56hfP8vjAU4YCeVquf9UxH+BLN/wO6GG59AXLtVrzLtq1bl2GLmX5F0VIpYZW65j+AVgwn6zez3Evv4xTXvtqdqcZoxamraFpLalE/jCsOw49yi9qpIuGHXK/dS6Rr/uv0xICNtYZiw07yZqnFQ7KFRUMSiSWmgg1YxiMDUORoZ5akvEJDm9/gj1bH2dq30FoNYk6HZiZQWdmYHYKWk2k00HbLZcn2AxSi+KTyBwvsN4TZGV5WFQVxb9BqRngDVif8NsIkhbccPteVBdz+YUfYc+ed/6wUBA9Zda/aZPy/vefxLt/92P8/Csm5IpXLtaDByJqDed4DQW8KwGVi0gKepeJK0hcRYaHGNmzj3azw5pTTmIamLZCIkKKIVFDhpCpuH8RMilftyKk6j8efk7xuiFT3L8IGZCpKT8efK1VIUWw+UvX9zOkakhxLwkRbSs0FSZSZSzJmFLF9jdYuHo5x5x4HAuXL6FtLTOtNpiYqFLFRh7N9PiEFHmJlh5KpMATuoZWehJVh0AG7y6QxjwuKkQxtFtw9x11fv+3DjDRfgE3f+cGHtn6JKrR0bzA0Q3AuX7luS/4KB/5pxPkIx8XPvPJAeYtcJYXuSzdcd4ij/jlAJBH60yMVCpoZDAimHqd0V1PkLbbrDv5JNooCUoH4x4ONkgApewDdGX+R34pyZrlxE5YQYafqyEhtChBe8pE31Sy6oJoJlIYRhthxirjSUZLDIOLF3LMCeuZv3gBM81Zmq0WUbWGifzzCZuOUgJRebCTgo1QHvicCBZ0PH1t0x3rrEK9Dju3RfQvSvm1d8G3rt/A3ic+hSpev+BpG0DEH/2RxZiL+MM//wAnnTImb/y5JSpGSoauFMzdgpCREzA9oVJN7Fu4zm3ZLKNSqTLy5D6yTsaJG0+kg9K07ubagn/fncjNeRJHfOFpft7RxkNCCpl0GVY4f2CVwju0EWZRJrOUJsL8pYs45oTjqTRqjE1OkSmu5BVf4hYoVdiEkpKzJOVvIgEpIX87/5rScHKPEITGKIJ7767zq+88TF//KXzzuod5//u3HM0LREe9/e9/P1x+5cf5s/cvlvd/oMZ3v12XgaEy+47KMi1n74p4LCDKhzEiT45QD5z45ke1xtjBwwjC8Seso5VldDLFEmHzJouROSTN7gHPMrETkaP8GU8PFs9bwUf6/kc2FncS1oeUDkLLCtOJJY0Ny9esYuXqlUzONGk221Timut+Fo0iW97i4lQlIJ+E423addE1N465zQz3alzBHD4stFN479ub3PPAKWzd/ElU7ZG8gBzx9otkGHMZX7zh82w4eYznn7qMSkVEYo+/51h83rTxPXvje/xR5MpCnyDiw4HGFaSvD124ALNoOdngMCdcdC7HXnoejzcTDltDi4jU2rKF/DQO8+l+3o/cJpvDHZXiWedtZWewglGlIko1UoYVVtRihtOMR++6hyfufRAzNYuMj2InRmF6Em3NQieBTschjDZzl0RTJLMO/Mnh4CIRzAGlrEgINW8gaV5O+pIyzbB3PLSXzQ8v5pWXvhHVz3ovkD21B8hv/6tf8xF++91L5b2/VZcH76/R3+/+8sLF+2GLomdfcvHVRP7w8/Yvc5i2gkHiKod37yFtt1m74QRaqqQKiYhv2UlwC/QpixYJ2MAi3cbjsnqKcJUP9RaZfxgccoq6SkBDkJL33xWTgx6EB+AzIBVhKstIIsOadatpDPZzcP9hRIzrjKsiVtxhFkyknBii3TRWCQimeSgoChrT9XeQ/85RhE5NweiI4b2/Nsv3N5/AI5s+iWrGBz7Qk+nPBX0scD6veu3zGUtmuP7r/QwMOvedpyhSPijNv40EmS0lgaMEZKTIYLXVJpucREcPU51s8sRNd7DjmzdyfC1iUWxpiCUSKevep1Gxqm+d5i9HpH7n8begj3nT8gmfSjlPXBJVnuLnKt2GYkAxNK0wKRH7s4xtzQ7zTzmJ0196EbpoPnbeAmTeQmRwGPoG0GrVNctMVGIqwdALvZesBx0lnEkkIKwMDML1X+/jcNrk519/GvBSTKS9l94c4SnCiy54G5f+jJV/+Os+xsdF49oc9mzxgyWndQXsna62rQkAosh9mU2R5gwyOUY2cZBKs8mum29j57dv4oRqzFKj9JNRMTl5gu4qoOfm95JAQ1DQPRDj5vr8qRl1EKvRjAhLpJZI3dvuxdO8bI7HB7fsSEYXYA0qvmTNhFkbMaoxO2Yz6uuO4YzLLsYsWkA2bx46bz70D7g5gGrF9U6iimuZRxE2P+ji8piCEVX2Q3LORG+zTJ1RjY+K/P2H+rns5S3OeeGvlty1IxuAIY4tqifw8isuZCCalE9/coi+fk9XnsvFKyZ0uyw1wAOCec185ErzvCdL0dkZ7NQYOjFG3Gyz7ZY72XbTraypxcyPlbooRrQoe2VugfQ0Ez93SJEbCqMmSl0sdax/Xamh1FHqAlWgQlm+9R600uNhCvKHDy++7ZwCMwojIuxopdTWrOSMyy5C5g0jQ0PEw8NIvxO8oFpxCGpkCkxFw55I0CMpLhy9PEcpBNVQC3196Kf+ZYh+pnjFq16A6plEsQ29QBQQPSJ27LCc9Kx38kd/cYFc97WUqz/Tz+BgMeZEF0PHx3iJHNu3MISomJ1z1YBLECXKEcO4e/TaZ8ZWlLha4/C+AxgRVq87liSzJJoryLjYZzToB4ReQIXu/4VxXYlFGRAYjKA/NgwZYcDAQCQMijJohEEjNESoqSVGiVEqOGGJomIvpn6EIw4ZB0OigrgOL5AhtDopKxbPZ+HwME/u3kOhcZg66NcxhvP2cP436ZHTnzxvCGyxKxewFqlUkEMHhZXrO1z2igbXfy3l0MFvcuWVhs2bNTQAYedO5QMfaHDV6/6a119RlXf++iCHDsZUq94/BAOTIl2DlKao/8OsX4qPiy8JpWAARYGF2zKi2IwojhnZcwCDsO74Y2lnlkQtmfEZd+625kj3yFG9QdUIA5oxkLSYL8KAzRhUyzCWAbX0WevfVgYrEQsqMQtqhuGKoS4QYzFGMeF00FOUjNLz+6g3gFSgk1pWLl9ILa5x6Mk9xBg0yyuAvGXssf58rEyPXqSIMlcAy79TBQdB798b85u/OsHDW9dy392fZOvWJuosOA7m9zNqtfN4ycvW84PdE2zZVNW+fgdVBhQr9a4YE4gliKN1FwOa4XSPNx4Nk8Moz5j89KyqgzE9xatqI3bcchuqGWvOfxHSyRhxiQCpQlbw+/Sp8rPicIwoQxXD9K797Ns3QqUSI5phksS1fZMEspRIlMhE1Oo1+ocGGFy8gAWLl7B0eJCWgbGOZSLJmDVCCyHTaK7+UG54IeEEl080jTAmsK2ZsPaMUxg/dIh99z1ENJi4tnPWgSQtGEciadAQK9lRjtQqhdcRXxqIkUA/008w9fXBI5uqbHoy46WXr+QTH30xafrv/vKnzgNcfbXhmmtUXnjee/id958q//tDhtturjMwUMCzEoxB411+OX7d7REkMmUJGEWe5u1DQZEL+M+NowKIUZthMsebN3GN0YOHMZGwft0xpBl0rJKKFB3Dsjw7QtEeHEyECwErFs6nMznN1OQ0JBmdiSmS8UnSsXHSsTGSkRHah0aYPXCI8d17Obh9Fwd3PkHz0Ah9Vlg00M9wX7Wge+ONMZ8JkKKr5PSESjWRkpCaqZDgnOCa1StcGdxsucQzSzCpax9LUXWVpXPIYKJoWh3B8vM2Ab5HMD6GVGuWX/wllZu+E/HEzmu5+mrhmmvUpfBf+IJFdYjXvumPuei8Cr/324PMTEfEkW/6mJJVG87UB4ROEePFGLqhYu15mxwnMAYT9egBANZmqChWhDiuM3LgIMYYjlu/ilZmXcPMN35cZq9ho29OIpiPjluEqoF1KxbTmZlhcnScOOlAcxaas5iZGaTVhE6LKOkgSYJJM3S6yfThUfbtfIKDu56kklqWL1zAcKMKaea6uWIo04K55lhmJe7vUiNkacJAvcbS4WF279rpSuWkA16HUApugO3O1nM8ICx1NYwAQUKgwUUYHYl565sneXTbSm6/5dN84QvTqErkXYEC5/Ou//ErZNLkw38+TF+fn1OUYFJHiputYZwvhjQid/vzhDDqhorLw/aHH0XdVUOuwmFL2rWp1hg5sB8V5dh1xzKbZbQNpEVyNDf6h6AQqljfbLI2IxLhmGULac00mRoZo5ql2Oas0/vrtNB22xE6Wm13GElClKaQdkgmpxl5Yg8je/cw3NfH8qULUCyJr55tIScnPTliMI2ELdhKHZuxfPECdLbD2P5DVKxFOx2s5yKanAPoB1i641swmxDA00L3XIKgmEoVPbjfcNmrp6jXF3PtZ+4DNgNxxHnnRezcaXn2mb/K77zvuXzpWsuN1zfoG/Bc9GBi1+SSLFK2gCWv86Pug8xpXoHbzz9HIlNUBXkDyXjPUAyEIhjrMAATVRnZfwBR4Zh1x9DOLB0n7ntUhLCrvepdohXoWOet1q9cTNpsMzo+gVHHAnJ07gySzNGz0g6SdNBmC5ptTKdD1SrtmVn2P7kPbSesWbWcWhSTWPWt7e55xQJClm48S/2drgisXLSIg7v3kM7MIKnjG0ZZ4mTmckZwcOMlZDIXyWAuX6Ol1G3+fhPBzBSsXpPwiisM3/raLAf3X8eVV0rks3/DZZe/j9e/cp75ow/2sffJWGo1Z3mFIpcpp3hMWeLlHkCDTmDRE5DYQ8Ia5AiuV1CUcrmHiSIXryT2PENXbxtPkoykwsj+fRiJOHbtatqZu9mpGKzVYNy8OwxI/vC9J8jEkNoUY4R1q5Yz25xlcmKSuFZzs4t+uEbBGaAnhUrivIBNEkCJEMbGJpkYGWf1yqXU+6vMZhnWTz8rbuKoSzWs+B1dSHI0NGX+YI0+q+zf+QSRVSdHmyRomrOJsy7tcQ2QcekSrCBQS+0aeHfJZZoKb33DLHfeO8xD3/9ntm5NDHGswFpOP/N49s4mbH64SqNRxg6kbI8iPpnrQZBNN+1auti7Ob3blPz+4v0SlJbOW5g4RozHFlA0aaGzk9jxUaqzKTtuu4s9d97HulrMYknp15TI+P669vwOwVxATgVPUSaJ2Jtk7E4TTjz7NJafdBzJ0DDxooXIggXIvHkwOAB1R2HXKHYhJE2wrVmYmkTHRomnphjftoP7vv5tKiPjrKrFDKglzh+8aMFOnlvGuWRwSi0HOsqSDScwsGwJtlpH+gegVkOqVYgq/hJ2U94lQP8KqPjIyrjOIBoN2Pxwlf2thDOeswbYgOY4QLVxMe/5vdfI/r0t/uVjA/QPuLajEAxomFKcwSd8+U3v1t3Lw0NUzAHm3UAkKjxHQcrIp389TiBRhInKRpLg6NaSWayCqVUZOTRCpRqz9pgVdLKMjjpaeG74XSohXa7XVRvWs5A6aiEyrFm5gjRJmJptOVQuz2HyplVATpF8IthmaJoSWSFptjl44CArVq+k3t+gndmC31B4oZDhIzkBDp+bWOb1V6llysFdTzosoN1EkwRSxwssRsc0rAxswWss3H1RMViPTPpcIY5hdFS44NIZVh0zyGc/+QBZer8zgDPOfCO/9ltn86VrLbd+tyF9fZ5xKoX82hzlrl7lrbBhEYUfC8gjRQkYJJLiQgUmdiVlnh/EsZf8yzt4XpIFIa7VOXxwFBMLxx6zgnbm46+4h8pR+P959BWrWDGkEtG2SmRgzcrFtDoJk7Mtojj2lOwSxpYoKiTpiho7s5AmGGPIEsv42Dhr1x1LVIloqSWRYGxcjtaId4YVISwbHmT/9p1kzTbSbiO+GtHUGYAEnMDuCkDDQeiiDizptbhnOzuDHLsm5SUvi7j+a4fYt/er7q856ZSNzG905N47aznPXwrqgZSiCuK7ZEbL0kZKXm0p5WqCZhFFS1hNOQFEgAtIodXn+QWRo5mbOIJK5CaJooojTrab2KlJ4tk2j9/5ALvue4jVdcNCY+kXSyzlQ5A5WH3ZmVRVEhVaGnEgVfZllg3PPomV61bRqdWgfwjt74O+htMprjUw9QZSqyLV2D2HpIM2p8kmx4hmZpjZtYcdd93HklgYMlAzeATgKKcvJUo4mWQw2M/y49eicQXTN4BWqmgcOWqdzy1KKhsF8NZl66F6ikqgqey9wL131VhQb3PiSSfhRnUZZv0Ja0npsH3bsFRrBV8+l1fJ++Qa5gNSTt5K2AqW0BCCtnEBE0cYnwi6F0GjyIWK2KBR5CaLfEdMckKUeq6hCtrqINEkkTFsu+37qGasfs7paLNDhtCUyM926tyA2M15J1FhHEOaJUTACc/aQNay7Nu2k2ig32ETOuMqBRP8PbkKSJairRbp5ARxNWbvI48xf/lSVm9YR2s2caFGnqKdrYpVaBuYsLD8+ON44qHNMDsDFTc9pXEEqfeeOYdAjGdRl9Cz+jxnrt6BuGqiWkN2bKuQMs36E48BlsbAsRy7diG79lgO7o+oVFwzwoMbczf39Eza9vaipdToywkjWhBFDMQRavxEUBS5IZIogqgSGIUvCb1aiIajX2pdVZG00elJ4sEhtt/1EGKqrDl9I7Q7jCg0xbhhXZ2zFKTn+Vs0Ezqmwn7NSFVZf+YGbNrkwPYniRv9jqFjbaEQLsVDjjAYR+/vtLEzU5hKhR0P/ICzVi1jXq3OTAqdo1Dd8+dlVWkD45ll0ZLFDC1exMTIuJPFj+Oy4gp7JyEGclQOZTkGqapQraAH90fs3KusXT8MrI+JouNZfWwfB/a3mJ2VnPWbb9zI5+wK2ZUc8vLkhyIUmZxUEUDGhaqm08GTyFHE3bRw7Oji1Roax6409IefG4tE/nt5OFnVz9HnsTBLyTotpFZh2/2bMFXD2lNOQpopo0TMikMOJdwcIkfCVZVEYVaFw5ohFcNJZ5+OWGXfozuoNmrYrOOaNmnq/q4oct5BwKTWlaKtFtKaZfbwCLu2PMaSs57NSJrSxBmjqATTTBqIWCkJ0Ewzkr4K81csYfzRnZhaDa1UkCgmx+xE0vy+F/OSaOSI8JKTuUtD0XD+0RhoNoWD++HYtVWMOTFm3bp1HLtO5KtfjMNxK36ojv5c/vrczDuAicVAHGOqlWJqiFodqjWkVnUewVcXNnJhQqNA6dtEpSafzVyXK/MusNNG6lUee+gxTFxj1YZ1MJsSqaXjW8lz+FyUmXgmuE6fgpWI6dQyEAunnH06WbvDwce3U6vWSdtJlyax5N87T8BSi51tIpU6T27eyuIT1zPU189UJyMh6sGrewewoAVMKyxYuZxd9QrMVtzziWM0isE3h7qg5p71J+VfJwGNPCS/WnjwgZiXvBzWrFkXE8draNRhclzcaFKZWOQz+3kHsGuAIdTpC0SSy/GbkmZt8onhKHJImVpHgGg0oN6ARs29nStm+iqAqFKKSOQEiBy1SxJIUq8+43gFkimP3b+JNE1YecqJ9CUZHWuwedM86NMXcdx7M/xMvwjUIuNKrErEiy58AffHsPPhLRhjXP4imfMcxiJxjJWS10Cng2m3SUYnGd2+iwWnbWSkrX7wxBacxHCCyYGVhrZRxlJlxeJFVIb66UyOQ6XuRujjqBC2zvk5XdNRYfjVo4zGieMJMD4aaaPPEsVrYs44eynzB1J+8GCVSiVgxz8VYVbKsaofRq3N63mJsQgLli8nnr+ApNGHDDjAg0YDGztWcY4oShx7uDgqystCc8/60apOyszElOuXZBnYNtiIbfc8jOmkLF3rSCVEIVjVk7MEM4WegOWEmxQ6KO3IcOopJzO5dx+j03tLtFO80IzJO39azP7bThupVTi4YxdLTt7AQBTRyjwdV+fWhOq5uJnCbKaY/gH65w/T3rsfiav+9gd6CPTuRQq0EkXL7mRPV0pUnUjHpocqLOhvy2nPWRaTJMsxWMYnDD7OEogqmDy+U4o5aYBuFlYnlIre5Dq/pnyfuHUrtf5BLn7rL5EumEc77dAxhqYaWj1xsUy0pIAzs0Kkyf2S1Ug4vOtJtj74CHQSbHMW7XQwCo/ddR/b7n8IU4kDI+ruD3Rp/uRDl9Z6RZDMjXNhMd7j5NtAit0BnkHvOLFlSJEsJVaYOjxKc2SU4SWLmbCW1OI5g55rmGcDvp+vVklUySoxg/PnMRpFmDhC46igybucKvNNp1wzIJDKFa8llBtCoJ9U/O1jYxERGUm6NEbtQgwZevThW+mRWqMLAwjm14pAZHpaoq7XH8U19m3bzlc/+Wku/JVfoN1fZSRNmdaYKXUdPg3+IM3XvRQZe1bMJMYIjURYtu4YnlWJ2fzAVmxmkXQW2m1MJ8XONEvDDGXaxCD5yH0uBJRLtlr3u+ZsHJVAzznvznlMw0UOj5iEs+14pLCdMntolOHli6mK0jaCzRSNArPO50R8OE3UkhjoWzDf9UZiXwZ6dLQIxXQTcrpuOr3phhxp8jNTdH7MWc+vM5kqjz9aoVor9WqfOgWcM8TyVP9Z39Qhy6j29zO24wlu/dyXOfv1V2BqFZqtjBkimqpYNb6hYrBiu0o4UTeYQgYxSk2EtJlyzOoVnGBh0/c3YRRsmqG2jaRp0V0jyzC2uzurQUctlHIx/lTyios4crpGwQobNYrN+QjBUirx1VDmvcrU2BhLVKmJMqNCVs57BeidA86sulyhBdSGBp2CSuyqIJvzLo86tfI0Zr5V0WoVefzRClNWOeucWoxEdfdXpB6p0259vZ4lTcXCTdGAlh529qSboOAnVSwuc9dWi7je4MDWrdz2uS/ynJ+7nOlajcmWw64TdR07V6mZoozpZftmYkiMDwvNhNWrV7DBGh59cHOBnet0hnYSL+vSgczzCv2VFquBThiFQmeuIJrfdioxplpF4yoSRxhjsJ6VZMSNfAlKXhWL10TGKDPT05BYKuKwvPywi3BnTKBfIFgxJEB/fz+mWilb5Mb45+F9QHA22rXJxIcTYwoBKrClqIYxYFNnQZGpGJKkjjFWJUTPtchO+aGsu6cxZeWZKmozaLeRyUkqrRYjm7Zw7zVfZkEzYXElps9AzSdrao5kzNrF+skstFQYU9jVTpm3ZhnHnX48MtSPmTeMGRpC6k6lTCoVjyvkk0KKCYYui4tZTHTnvLvI3YSszI3y8YmucJgLW4S8fSN0Wm2yTkJs5obNIz1CK9C2ILUKphJ1zQR0zwMevfs3h7Y+pz1YKqrEwcREid+rFqNfGlKsQmIDclR3M8dwbG61GVbbHv7MiOcNM/KDLTxkKpx2xcuJazGH2ilWIlqYp54H9Nl6qsKMMagKcbPJitUr2GAjtm551PHsjYVqDLNtZ3xpx1OutJB6FdHSqWrZMConhT2ZxWsWa1CNh3W565eENDkhTVLSTodKo+6gYylHa1TmDrcqkKpiKrFL/nxoKTapFEmdLTkPc4gwuZy9zKGGMWeh09NWETrySMaPgB15WdRcYi3F2ozKAsPopi38oFbjtFe8mLhisKlzw20vhHREyjclB96q0BLLIamQtTPWH7sCImHrpsdd4lRtQHXW4eudxCF61nrRRhu0U8PmkX8pGLimu4qQMpQESwtLQ/KMKWstWY5X9GRqufSszsHvlcgYYhGnoyRP3+fqU0DOckQDKCo831rQnHoccqsNT1khHGHxQt73VqzvBQRPOLNox+lzWBMTVWsc3LSV70cRz77sYloVQ5Jk2MjQyY4k/xKQnryFp7hx7XEM21sZq1cv5wRRHn1ku9MnjMRNsbUdgISnglu/rEqt7aJaFYOaeaWQq0xZ7RZxyO3EaLkNN08GfTiwOYNXTHfiqN2zRkXhLr3jLabnDLTwHBowjYIK1zsJnTPA1OuiY+JKC2tzfys/ER157QaNlLk6jRawaYppttCxcSKJOfSDzTwQwSk/czG2EkFimRWlhfmhc/2iETazNMU1zrJ2wjErVrAe2LZ5G6JDTslEWlhplqhmrumXbyTBeGXOsM/uDNnkWsRWj+wJydfbBCQaj2JmlCti5EgbSnujprXYXESKQJq291arR2oD4YneGym9syWBIcRY2wbqRHFQZUjxALrj09yYo4HeXjg9d1QdDmOwfp7CKJB2kJkZQIiMcvjhTTyUZmx86aVIJeKQdUpkiaWLYaM9lUE+j5f5Ee3JzLBXM1asWAGp8vij2/ztcLq8heGkDmJS7fa1eePG5gmjdbfadqEblBm5z+LJKXORA6CiuIKpxGQFe0c4wlH6ZFSL3kmWpWR+WijXEi73C5S7jXIPUEjQqIZ6ETBnwFqRKHb2mtnUcM/tTYZi0fUnJLTbrtzQXpWtsAV65N5Pt0vzyJPSRVXKMQ889Uvjikts0g7amiUbGyWenGH0B1vZ9LVvs7CTsbAS0Y+TbpN8QFRD+FsKCfhwk8cswkGr7G4nLD52JcdvOA5br8NgP9Ko+wZU7MScQqFqa8u/VctxMAlo1uXSiJ78SoKWuReJiutVTLVCx2q59OIIAT0cOovFeTBNEsentW5QRHxOgnZjGNLb++foN552B9YfnzBk4J472gZkDEuEQYudNvSqVJWyJgRurCv/IdjA1fs5wS+nKogajMT+lngKZZJgZmdhYpy4NcvoI1vZcv1NrFBlZcUwhKUa07X/R3owhyLztUJmhbZGjCvsbLeZf8wK1p64Dq3VMEN9mEYDqVadinkUe6i6HEG3ogRKAm5YRXNBaC1KybzFXBhgQSFzrr820I9Uq3Q0bz7ZIIMInrSvsCKUmkA200TbCZKWWoHdlhaU2PpUSqjMHZZ10ECEyFhMpboPywYdnudAzcKV+0BtipZ5t85+yEs/UingH6BTxjY9ULJ65MyPQXvypckUbc2ikzGRMYw8+igPN6o868IXQQU0dUrZ7czh5mJMqeffw713SbowQ4SqIZ7tsGL1cmJreeyxbT4JyQ+xDZpgstLB58vHfQpWaBd1bRZU7UlK3YsxrvVNHDE4PIxGhk5iy6KhB0LVYFY/8iPqnelptNNGfdVkNXO4Rc+Aali6dknK2u5StfxhFubNy8iIiSsHDPfffYDR6ZiNp3bwZAd6J071qWoMnVuj5AsVcq/RU4d2xSQTOXdcc3UvGMcAbraIOymHH93Opu/eyRJVVkQRA6pUTUiK6dV4o1T48L9721oOS8zuxLJozSrWnXActl5DBvvQvgZar0Eldm6bktpmNIjNOlcYYm5bP+A5xk4ib97C+XQUJ5GLBN5K57CoRITY6xPMjow6/aCkFJUs8oAuT90LuB0hgQ9wHJIENp6aMDoT8/17D8Sk6U5aTZGheTle576J1YJerT47FhU/KyrY3B+oeiDF9Zpt3i7NZf/ELUVUPwUskmvdGj957Cjk+eFrME9oOx3ipiNkPGzgxBecTacSYVNlOlIy9Xi8kW48K2D/KE7fb8bf9ridsGzNSrAZO7ZuR9TPPPrE0O30SbvHwDXI3jWXbS3Hs3NY3OkkR2i1io1j6gN15i2Yz+5M/e2XuUh+jh2oxYilLoY4g+mRMa8dkGKy1FUE+f4AyXcX2nKHQIAnSLECJ5wTNP53NTBvfkZzNiZLd8Xs2LadXTutnnp6KsYE4MaRCvwjuJTAoYXbVEXpHtrUANMPWLqFBGzs5FHq84ZJRMgy19a07TZxtcrBrdtIOh02XHguWomwaUrLQsc+jZrKs2NbKCOq2HbK6rWrQQ3bH93pZOysItbJ1KlarM2KrLo0ACmFnHv2Cea8RyoRUq2gIixeuhip15hpp2SYHj1jmTNbE6P0RRF2tsnEyGFnAJ22o6Hl+wW1t+I6QsNHtZvroD2o3bNPT9mxrc6uJ7YZsuxxntjZZOkyaPSpqJ3j6fUoM+9F8kFvs6anRNOQmh2gbJRrX6hUySoVhtav4bw3/DxmyWK0XsNUKtjZJpVmh7HHd7L1pltZahNWxIYhUWoRP5zE4gGoRIVpK0xkhn2tlBVrV7HuhGNJG1VkaAgadaRWc0su4mguoyIczlDFqAsTxSBsJUarFbJaBalWWLx8OeNAUyEN5T57CCl5OR2LMD8SksOHaI+NuenkTtsvrOhht2r3I/3hXUEvS9/XpyxZDru2J9hkqwF2smv7KGtXCkuWZtppF12tYkNmd7bhJUxKtxhCqMVCpbAso8ycewfZ8zpW4grS30+zGrNow3qed+XLqCxeiNbrmCjCdjpU0pTRbdvZ8r07WYKyuCo0IiU2mavtu4Tmew3AFjdnSpQDEvFkp8PSNStZd/w6lwcM9SGNGqZWdxO1xusa5Pw61SJxFIIum4mQyJFco3oDrVYYXrKQvkULGUsy2rbMyY4IyKrjJFZQhiOYfHIvzDihadLEKYLnu4m6JkDKFbVl3sURlodpOX6+eJllzXJh545xYJsBxtj26E4iqrJmXSKdlo+dXk87RydV52zNzidVJBAlMH63jRRGYotMXa0GHsMWH5PIuGGLWo243mAyS1hwzErOuuwSZP4Q2teAeo0sTTAZHN6+h0duu4fFalllDPMUapGHWJSgk5n/YqZcRo2DY1sWRmzE3tSyat0a1h23Fup9yOAQ0uhHql64KS7lbgtZeS1FGogEogqmWkUadbTRj6nXOfa49cwYw3SqfpQ0XFGl5SXxv1YNp09kMmVk15OQZGin6TaTpNat3rWpq040B516xe+7X0r2lJ8Uaqew9rgOFSo8vvVJYJ/DWLds3sRos2afe06LNAuaHvRs0SyV5DTYuhUCEl0Zc8961QLJ0jBj9XsE4xiqMVKrk5mYg+0O9RWLOeWC58PQAFp37GG1KbHtcGDHE2y54x4W25RFUUw/UMsNrUdHdQ6aqYZMDdMIhyzsabdYftwq1m04Dtvog6EB6Ksh9QpaiT0ZI3bUdOPn+XKl9CjGxBVsrYYO9JPVYhatXsngsmUcbjkN4fTo6palQKPCYBzTPDTK2JP7iNLUTQmnqReO0qBxFCyVmrP48iiNLcHtPXru81qMtOps3bLFC+gJ/OCB+9j6iPD8FyaOMNBbzvWMIPfEXA0kBnu7aXn8z38h6fmWea/AGgOeB99RYRJhV6tNZeVKNp7/AmTeIDowhGn0kWWWOOlwcNsTPHz73SwwCQtj6De24BN0jYbPqVrVy7UosyocosKuNGXputWsPXEdWaMKQwNInwNxqFQ8aOV1+fx2FCoVtFJBG1VksB/t66Nv0QLWbtzAqLVMYOholIt8HJU9HxuoiWVeDAce30Y2MYl02q5p1UmKtTOC9XQSKZ9nIBMjqnO7mcXPse73P+dFHbZsitn88L2IYDAGWq37eOCeaTaeqrJggZW07eHffKNWqYEjhTSLLXbala7Gu3ux5QCHWrChGLMtetmaDzf4hRNEbnLI6esZJm2FJ9op0erlbDz3bCoLhtG+fkyths1SoiTl0PYn2HLr3SzSjCVxzIAoFZKiNyBGA9IqZXjzyW5mYVqEUTXs7SQsX38Ma48/jqxRRwYHob8PqbstZ8SVUgu5Erlksa+B9vdD/xDSqHHyKRvQvgYHM8usGqxqOSesYcFuinAVi6U/FuLZFnse2ox02tj2rJeLcW1zpwOc90BsuepMQx1DLUmmhC1tccut5i+0nHKqct/dbdrte8ila4FtPHDf4yzvq+jJz+rQbHWxRrpoxT07a/BrF8q8oFuutdyRF2y6CDZz5jWkoZwiTqwDTpoWptWwt5XQWL6cjc87k3jeANrX7/jy7YQoyRjZvpvHbruHBaQsqUC/ESKTR1yZM0RRzNd7nC+z0FTDITU8maSsPPEY1m5YR1ZvwOAQ0t+PabgpJqm5F+p16OtDBvowQ4NoxXD8qRtoLF/Mk+2Ead+iVu81tKt0K1u3FVEaVllUiZh4dAfNPXvdsuhW0x1avmuo65l69nLRmir7E6WaSIi6CrRa6MmndFjWiHng3l3AZvfcX/jCGMi4/7472DfTx0U/M+sQwR4Kg99To13bs9VTpcP4r8WSRHo2apdbNoO+e/75plS/tF40ug00VZgiZnc7o7p0Mc8663SqA31u0LFSdTP6acbI9ifYeufdLBbLsophQNXnBEeIu3lFZsqVcomFWSJGbcTBdsKK9WtYd+J6bF8N5s1DB9zKOx0YQgcH3cvQMAwNktUqHHfKBhavPZY9zYwpG9HBBDeyOw8x3igjVRooQzEMdFJ23n8/MjONmZ1B2k4lRNLMJYDBpRHKixYm2V19gSAcKDitgYsubbK/2cf3770HaHHFFZHh5ptdyvzgfTdw2y3oJS/pUK34bWB6hLpeexI/LTy7aIgABwuOioWHQTUQLkkOf5J/2+ZLolHaKBPAznZCtGwRJ571bMxg3U0UxRFZ1sFoyuEd+9hyx30sEsvyijDgJdyPmLPkL6KIcRM7qVWmrbBfY57sJKw8YQ3rTjyOrN5AhucTDQ9j5g1h5s0jmjcfHRyE/n6Of/azWHTi8exqJxxSZVYEq6a7YujN+0QxBqpqWVqNGX9sG5PbdhC12+jsjFs8lfp2cKAW1vVsCR64dotDdd1eq24A55LLWnzvxgo/eOh6ROCaa8StHXc37zbuu2sPJ6+LdP3xCc22S3i8Po3kzaGiVVruzBW6dxYXz1yty/q058Xr2qvm6p8lQhjyUnL3bVVoW8OURuxuJlSWLObEM0+D/jqmUUeqVWyaEnU6HNq2k0duu4dFWBZWhQaWilB4KqR3wYSgxZZJJVOYVmVchT0dy9IT1rFmw1rorxHNn48sWIBdMJ9saJDGkkU867nPYdH6NexupYxmhhkEK9YzoLqnkULJmooKNSzzY0Nfu8POu+7DzLZg2m8dSzpY23H4hs0cRV17EaDuXk03hyXHLCJotZG161M2rjPcfcch4CZ/5pmbM/rsZyNgnNtv/h4d+rjwxbO0Zl1jI0/4wk2XQXavXTdei/6PhAda7MvTgm6Vu68wryghV+3S7xdxY1NNK0yoYXcrpb56BSc+7wxkqN9tKK3UHPcuSTn06E6XGErK0jiiHxdr3QMzP3QjSJYJMzbikLXs63RYuX4dx25YRzo4gA4NEQ/2s3r9MZx6zmnI0oU80UoZsfikL/I14twyOuwbxpLRZzNW1GL2fv9hJnbswLSb2OYMtt12YlTWL6G26nYadmX3dm6pF1RrBbXdTQSjF714hjb93HnrncA+0tSUT+Oqq5y13nn7F7jxOxFvfMss/YOqiQ0GntyhmPBn2bkHrMEyROfqu6lVFOEg8w2YXByZ4PDz2EbXAKoiNFWYkIjdzYzGyuVsPOcM4uF+aNQxcYxttZ0n2Po4j958J8s1Y2UsDGGdYkdYT4d6ghJm6G4+oakVRq2wL+2wZO2xrD52JfMWDHHiqSdz7EknMB7HPNFKGbORl47NF1Pkz0F7KOR+A6o4lfIljSr2wAiP334H0ewsdmYCbc9C0nZbQbLMh0rtxlyCBRK9lwvbA7VnKQwMwJveMsu3v13jrtu/5JnFJhSgdGGg07mRb1y3k42rYtlwUiKz016VAi/eGEC6QVkYooMmmAaS4qD91xarUj0yZaX0AEEWa1E3ZSPdsGa+PbNjhRmE/c2E/uVLOfWsZ2P6626WXgy20yZKUw5ve4Itd9zFUslYEvtwYHKvU8qtlqRe6VrclKplGsN+hCc6GQOrlrHypOPIhgbZ0e6wN1Wm1NDWQAcBLXd6Bf2OvEUdYelTZYERFltl8w03ku47gJmcRCanod32K2Lc36r5XuGgqsoT8iKc5mV6TwqQ6wKx4eQOJ68yfP1L+0iSr+fuPzQA5YorImCGm7/9ZbYfGtI3vWWStOMfkClULgvSgZXy1ucLkjUrlDTyX6iwYHXrU8WLLxWGUOzCSYvetwQPULr0kLQYoWpbmCJi92xCY/lSTj3rDEy9ilQiIlFsu4NJUw4+voNNt93DYmNZUjP0qXE5gQS21YteFjJHirWGVhYxYoVdqeWJDJ5sWw7ZiBkbkap49lDprYr9BsX6mlKbv09gSGB1PeKJ2+9m5MHNmJkZsskxbLPpdQ/yMBtsJA9Wy5bQeuY0BPNLlIWdwNwDJMib3jLJtsPDfPc73wBG/Flr98KIa65Rogi2bPoU136uxRt+rsOylZZWq5Bc7dKmJysbLP4XlF7Mvzc8FA0j17wp/rDMYhI392/SjNj/YobeVm8pDp0hzKgwLhE7WhnVFUvZ8LwzoB5jIwfYaKtNNNviwKPb2XTzrQ42joUBlFqxa2nujqGS7ZMTQ506+LRGTGaG6czQsYY0Kxa6zemUdg1qeLdSFegTy6q+ClNbt7Ptpu9SmZmC0RFkehpJ2u4CBOvkJSxZbKkT7PCV4Dxs0IizXuyy1YLlK62+4ao2V39KefSRT2IiuOaaI24MsaSpQeQHfOXzNzNth3jdL0zKzGw3KNT1Umb2BcBDVuy5VVvWqmXmH36Nb3DkA5ydBMkyYhGicEtspu4l70Pk8q8qtKwyZQ27mxkDa1az8QUvQPsaSDVGVLEzTeKpaQ4//BiPXP89FmmHJRVhwCiVmBJRQ3sg5Fyc0RbrZN2ZWNSUjZzyMR5ZKUU9Zt8PDGvGMY0K8b5DPPyVbyCj42Tjo+i0i/2addxeYZsVkvFl8m3LPosN/w1//2AtnQgyOwuve9MkMwzylc/fieqdZKmEm8PMERbwwG03f4RvfT3WX3v3DPPmK0ni3Vv5Q2xBjHDry7tve1bGLUux+ky8wlVOjhTrNmRomrjGR6sFaUpFoA7U1WXvxriHHeGbb7lGtSfupap0xHC4nTL/uGN49gXPx9ZrqESYJMNOTFBpzjCy9RG2fucWloplaQUGNaNqAs8m1kPHNmgrB+ulC4EGA3TvLOhSapFSgsYADZQBzVjdV2FgdIL7vvAVsgOHYWoKnRzHNJtuornYHezDpYahIF8x3839yw2McNmkGidvO2+e6q/91jRf+0ofd976fzBGe2VeeycuMrLMADdw9afuZX7cb1982YxOT7pyorf2DJk9SncW2sMidjlevg/PZ7eZ1/rpdNzhN5vQamJQ+tUw3ygLTcYSY1kqloWRZUGUscBkLDSWBSZj2GT0RykNMqpAq9Vi1bpjee4FL0CNhXYL02ySTUwQzcww+shjbL3pNpYDKyoR/aLEJqexe2awZ/Bq8e8cJ3FEXmRBV/dJrrFKvygDYlnRH9M3OsHd13yJ1s4nMGOj6OgIMtvEJmm5SdzvDOw+5JKLkCeBORIoegRgzkQwPQmXXDbLgqjB5z71A+BLWCu9ewOfanHkFXzx+s9y0imHOedZK6RSRTHu1hmn+ycYxG//cLJu4mjegay8mLhYK5tLnZkowuYK49UqNPqJBuaR9DVY+pzTuOBXfpHDWVbUHJkYx1rvEqoQrPXilSixQuw9R81a5lUq7HjwEW6/9vNkEzMYa7HVmGjePJKBPpZtPJmTL3wRexAOdSwzxHR6ysPeFERUnmJCWoOxfyUS6AMGyVjRV6V6YIT7r/0SzR07iSYmsYcOorMTMNtyt1tyrmFWhEv8/iCb+W3iedlcbBXXchtplpWbztS61u/tD+1l00NLuOLFb0H1E6jGfr3hUw6HZlhrEPky//SRe/jSNSfzy2+f5G8/NCTzFxa8+BISDhk3UdH9K12ndWTJgEThEkAfH1OBpINttTCRMP7I49z01x8hq0RorQ61KlqtYioVTOxn60XdhcnyJNKNd+WKtiaz2DShkqRE1r2eJR1IILUpUbaA/Q9uwnYSjr/4PLQao6mTpu/kzZMfeQGpFnVKTQx9mjE/gmPqVWZ37ubeL36NzhO7MRPj6MhhZHoSTVouDBYiU1lQHbm8wwYwsAYiFtJF/w6YWnEEY+PoO949yXFLarzrHzZj7We8flz2dLUkIozJEHkpH/vUF7ny5w/Is45fSXNWtBL5QQk/Oy84vd+4lI2HXFM4LnR2yVfM+l1DTjVMMFHFHXS1QVRxmoGZGIh9x61Rdzh2XAnUwqSkQWX+puQuVCirizTBYJE0RTuJk36PY+gbwgwPk9brzN94IhtfcgkjUcyh1DIFdDRyOsGiczC8I6qleKGxCq73MKDKolrM8hj23/cQm67/LvbAAczoYZfxz0yQ+XIvHwJVmyI29flxGffVl4Gi1lUIWVaWzz6sFnw/UScz32goD29/ks99diVve+PrybLPYu2ctbFPPQOq6vz9Wc//Kjfedi7/+LFEfu/dC1i4yMmjBtvD81Wymm8CCzeMRU4hTCKDNW4GNYojh5YacUSLSg2iqhsOEVATe6m4iiOJVKuYKC6WJGrua60tmLpFPVxk9V5xNL/RNkMTtxRCK1Wk3ocMD5EN9LPolI2c8rJLOGgiDiSWCRU3L/vDhrJ9eWzEUhVDQy39kWVVvUJ9eoatN9/O3ru/j0xMwOghdGQEMz2FdlpdOYMVLVbEaFbe8jkYQNfbdJXgWCdZx8gh9IMfGuMtv2J44dkP8/27z/dxzf4oajLeC0QZNjuN//ln3+MD/2NCzjl3CVs2VRgYcuVKvjzKU6WK7WC5EXihx0JiPo7K8sqIH9n242ESYYAsS9BMS7n5as0TMQxqPMqWb9UMVcGL5lM+ouVEpk2l7mYA/coYMjc+aqQK/QPIooVk/X0sPeNUTr30Qg5KxO4ko6lOSVyPqO4ohQJeTS0NlIZRFtcqzDcwtmkrW265ndbOfUSzk+joQWR0jGx2GkmaDrCRoB8R3Og8pBUG4cE1yUqQTbI8QcxLw8w9k+kZOHljorfdvF/+4E+X6gd/9yKMufVot//o6+Pzv/bVr47YsmUfjz+2gPNfehGXXX5IPvWJwXz1iwbz3to1pu5HwfKWaMHECdWZpJQ6E99dTL00un8xNnPJTNoGv1BJkgTSBGknmCT1s/6pf38KiT9kzbxker7DIC9O1H1eJ3EuNsuIo5ipySlmp2Y4bv2xaCS0swwrppjmcYPfFiNKxbjtow2UYWNZXI9YWY2J9+/nketv4vHvfI90737M2AgcPgATo8jMNNJxCR/B/gANZgyLNnlR+nncP/9XpYj9bpuKj/tI2aj73JcPsG90Ce99+78yPf33vPrVEZs3Z0e/5U/13+bN7hTf/Rt3sm/Pq3n3rw7KZCeV795Qo3+o+GPmKMYEK06LPTYi3QIS0ls8u1guoVEZynX1wfatQl5FZI46abGEyq+sK/Yb5Hc3U5dR+3XtxQM3EVPj48xMTbNu/RowEUmWERERIURYamKoG2FAlOFYWF6PWFGJqBwaYeetd7Pp+puZ3vo48dg4MnIAHTmMmRxHW01slvjHIBRErHzdu5Y3Oo/3BViWu/egFtUuZpb1yyBG4B3vnuR1P5vx5l+a4v57fg7VJldd9ZRx7OnoQLhQILyEv/qHL/Out+yX571wOY88EjM05DJwH89zhq/k4aBYCiHlggm/YSQXow4XTUV+VMxCgPbkW0qCtbXGiydF+To76ZanLxZc+S0kpswfxKpXGu04vCeKkXoD7R/ELJxP2uhj0ckbOO1lL+FQHDHeycj80uZaZBioRgwBcSdhYs9+9j78CAe3biM7PEbUnEUnR9CxUWhOoM2WW/igWqiGmXy6SIMSzvqDtH48zcf7rsP3kHk+Z6F+l5CaGKamYMNJKXfcupcPf3Q1v/X214D8OzY7quv/0YRArrwy4tprMxYv+Xu+eeubqdQOySXnrCDfVV+0ASO/JMqnxVIujC5iep4T5G+j7iAJNpIacVWFl1vLD98Wm0nybWPlSjuRcndBqayV6xhHWM8WNiqeoeQ3clkwkaOj2/4+oqH5pLU6izeezJmvehnaVytG37LZWaYPjXDo8e0cenwHk3sPw8wUptPBTE+jk5PozCTMzEDSdJcjH9v2OUxJl/OoXlY2eQrpl+Lwcw9F2TQLvIWIoqk3ou/cuZdOZxEvfsG1HD74Os49N+bmm9OnLQH1Qz/P1ZF9XHDJ7dxw/Sr5p09bfuOtC3XBArdiLS8HTbkISvOBSQT1wI/6PUKSVw7kDydYO5/P14c3PheWCLaUlfKvpmuLRijC1LvUKl9zK4qDodVJN2oUYaIK1BvE8xbQqVZYfvqpHHfWaRw+PMLkoVHG9h9g9tAITE5Bu0OUJE54anoabc2graZj8qaJc+OFIIZ0LQ4rkz71RpJ1NXTU5p1T7U4Q1XZ7jzhyWf+HPjLKm1+vXHDBBLd897mojs3ppf8HDcBd7yjKyLLTedtv3szff2hS3vTW+fz7v/axeIkrUTxOrsHWMMl3DYpXDA8ONccLVKRcRFm8nk8J+9uOKd5fLLAypXqXIMVKmlDYUnpUOYtVK8FOXy02dXpV0HofMjRI2tcHlWpJaEkzoiRxrN1mE5qz2GbTydUnHRda8i6dGC8ha7o5fFpi+eJHvsUrlhE0y/IqQDwnIISGxVpXIh8+iP7c62b5xEdH+NV3LuWj//tiTPS9p+P6f1wtqJgoSlHzS/yfT36cX37Nbnn+ucvZsqnC4KCLUcXBlHSufPOYRuHtL1fFaXjzPYxc3BwjwbraEnfIe++FsmPXarWe9q6hCBPFahXKyVn1Y9hivaC7DwnUa0gUuXF4VVdxtNtop4X4qV1NEj+ypcWiLTERmaFLXyAnsxSbQG2+EzFDsrJ7mndT84Za0QPw2oWaWYeRTE/DyRsTbvvuXv7ps8fylje8G9G/JsvmwL0/SQOA886LueWWlGPW/Q3/9Kl38Jzn7TGnHbfKTk6I9A+4Zkaw2CiUjM8P0A2CRIWWXmgA4aaxolYW06W4Ve4s8l9LVErWmnyfTlSOrZseAZMeYUb3YFNXHmb+4vhwkzOGLOpQuDRzn2szD0R5Q8pBMLzXK8q0QpXaJ3oeQs+7fbab7OEoFgGwZUtGtdNsiGB2GhkaVn3w8d3cd/dK3nTVp3hi15s477ynFff/YwYAwtVXG666Ck49/St89aYLOXxoVF5+4XJttYVGn3uIUbgTmAI2Dm9ssfAwT/y8wka5p1Dn7C0kknJbViGfbopJoHLVvfFavuIWOkggBxt2RItupi8Ls9Qbgy3pWAVBJJi0CXcU5/MM4aLKYniWoMQruRE5fKv+oCXL28BSGIAWJFvrvEwUO4JntaZ89cZ9LF46j5e86F5+8OCLUe34hYT6TBuAV0NURWSIF150I1/42gns2T0pL7t4ubZaIo2GS2SKdbO+VDOmOCDxoUBzI8gNJhTs9YlhLpScG5MtcoFgM2kgmKiBWqJIIelUooYyV2Qp1wLUzCJJ5oCnLC2SRKFMMKU3tPVu6Sz2O7tehQSTPMVEVEDvEs0XXmRFlVA0gXJOgInQ2VmkXlO97jv7OWZNH5dfcoDbbj4XYw5grXk6Sd9PygCcERhjsXYV55z3Xb78rcWye9cMr7h0mbaaIo0+lxPkipm5+y/OOCo3gkkZ+/N170i4jNqUIlC5YLOUm0fLbRkUny8e4/KiYcHi5dxVhwbgRQtzfCVLnaawDcUJQ0kXKTS0utm6wViWP+T8QFXzmJ67+azo8rnRCc+TyChJtB7mVRMjs22o11S/fP1+1qxt8LILZrnztvMx5rGngnqfSQMIK4MTeNGFN/DN7wyx5dEml1+8jHZbaPT76kCKUkyCRVLuED2sHOwSLnKF3M1HAeKXr6YtNmRIyeIsqo8AdkaCRZYE7WuOotkn/rY6qFgyDTSvvUaS32iiHijWXF0phHTDVq0S6PhkXVQuyfmTvvYvjCmvSoyB5ixSr6t+5Yb9nHxCjUsuSLn1uy8mih4gy37sw/9JGEC3EZx7wQ1c+4157HlympdfuFyaLaGv38XUwmUGt8gYtw4tUMLO19NJviDBl4WYcgumqyKCQ87LwHCTmYS4gHapnPcuv+6SfrOewxBwFkrMPqjlQyaOpVuUwQYagj4XcIfbDesW+xTUBuNz5fIKiWJ0ZgoaDcW5/QY/++IOt96UH/6PlPE/UwbgykNjUqw9gXPO/QZf/tYS9uyZlFe+eBkT44aBIdfkySHakHQZlm+hNj5RgCPkHiTqSSylEAXs0iIM3LTS3YtA6X7dJ20587l7BXu3AqrQM/MYDGVqMLypKCaQdXWE1rKvTzC6lYM6xexkXpVEEUxPIcPDVr/wzf2sPmaAV1w8xR3fexnGPIC1/+HDPxIn8Mf9L8XaiCh6lDtuuYBXvfQxFixaoA88vocNGxM5dNAjexLMtNuA4ZIjXpRv+zao9Rw5x5XLCRFZ0TZ1DFot5N9L91n20DXzI1aZz8izknWbk1XxpZ3aNMDmHWlVbInF65yyrcTsC+zeOpUx9/tnoCmiWZAf2K7yT8MKQX0r+/BBZMPGRB98/EkWLZnHKy/dxx3fu4Ao+okd/g/vBv6onCjViCgaZ+f2q7np22dy6mmn8cHf38u2J2LuvatKpeoIIPniuyIhzzXlgu1W6ByVL7E2IGBqj05lMCUbLmRSiiUtZVZd3mQJVUuULtdNz5h7MXtfuPByclfQbppWMP4WjnKHrV+6kkfr+JVJikxOoFe9bpbrrj3Abfes5I2vupt77nopxjzxH0n4nmkDyI3AEEVN9u35HLfcuJihpRfxgd8+zJJjE7nphj5mZ5FGnz9Mgm57IMYsGghQUgo056Wc9g5EeuVxpdj25aZptUvdqwuK1VKwqktNozgg2zO2pt1ra/1hip9/7Ba+KHUPSvauDdq+ATZgXZ+fKEInJxzE+2cfHuWPfneSf/7can7jVz7No1uvIoomftKH/5PMAY6GEyjwq7zj3X/B//qrjjyyu8WbX79YH3ygIvPmOWjYpiWU6xkmxbqaPM7nnUWfF6iU81s5GmjCzZl5g0i6FygXzaAjbkXQufr/PUamwWLJwk4zG0xDBt7F9gy6FvV/SaYVzVyjK7UwMQannp7wj58+xEmra/z6b/bz9x/+A+CvnG7Tj1fn/2flAMzZFCfi2sgiH+HvPnQxL37JPu10FuntN++X33zvhHZayNQ0Yip+KZPtmjiyWkKlknm6s88FxMsOSIGkeZ1ATX2ZlRXCSi5GuzismmJtLrqUlp+T5eTSPD8oc4LcleekTckxepthbeqHNINcwn/f/HfXIjcgmJj2Y3Smgk7NuK1mv/Hbk9xxyz6SZCEXXzrG33/4MkT+iiuvjDyf3z4TB/VMeYCeCiFKsdkQy1b+Nb/zgTfw6780zv2PpfzaLy/ige9X8Ctk87CQgzw5cqfBVE7IpdMchpVSq6RYrBTq1Io5ynarcohTexTQNJRbyzur2r21rKgW8hAQ6CSVK2m1qx8gOf+h3YKpGfTZZyb83ccOc8bxhr/52CL+9H1Xc2D/r2PMYeyLYrg5fSYPJ/pPMACLaoQxLaYmv8I3v7JJHtjyQs67aDm//+6DDCxM5b67azJySKhV3cLoYKw63MjRtbSia3lDOTTZFePp1SfWoJQrY3M+wl7s2SsO03+cbnUTLWYdfb8gENjuTk5tmfXnSW6WwcQ4Mm/Y8nt/OMbH/3aMfeOL5a1vmeBv/uLXmZl+H8bMuni/K3umD+c/wwDy5FC48sqILVs288imT3Pdl4aZSZ7H237d8Ku/fphOqtx7V52pKafLFwfbIY6AtUOgOhrE3mLvsAYwL1pO3BbVQhYkl0Htn4edfLQ9xORtuZi5C/otDr4HIyjKDANpBpMTrgp66zsn+cznD3PmmXX+5M8Gefc7PsN9d74Wkdu58sqITZt4plz+f0UIOBrdHOAcnvvCP+St7ziPX/i5KR470OZPPzDIDd/ol/Ex0UY/Uqt77f+0bP8aN3apwTK7ssk0d0sK2hMCTPcinSKkKF1iF+W2sHI/r6qdI4KttlujuNj9g5dna87AvHnKJZfN8LsfcBM7//y5YT76N3dwz53/E/guJuJHIXL8dzYA93OvvNLwhc9nuCz6Si6/8j380ttO5eXnz3A4bfIPf90vn/rkIPv3RJgY7e/zGIIGy6xK+pf20sB6hKBCMrIWua+EezdQVTeY0rPSrWv/SteyhyDm5z/TRG7gdWbaJZLLVmb6ujdN8fbfnGFRXOe6mwb5+Ec2c901Hwb+FRPBq66IuOYay48xkPbf1QC6y0VjFNUK8PO88jVv5+df92x+5qUd+piWf7u6yr98fFAf2VyT6SloNKDecFM/IWQrvQsSJbAD6V2i00N3VHo3JWko76JzNZOL9br5984s2m4jrSYMDMKGDW1941umeMNVbWYY5BvX1fj3T23mi1f/A/ApRFquVWn/02/9T5MBHCksRMDlvOC8t/CyK57Pla+rsH7hJJuezOST/9jHjd/qY9tjFZIEjR2lm0olmB3QUpMqnL6RILOXHhUQnRs6cpde7uvzUjl+vA1VV761vKxLtQbrT0j0gktmeeObZ9m4yrBtZJirP53x1c/fZW6/5R8tfB7o/Fe5+59mAyj3MxmTkZMp4GxOOPm1XHDJS7ns8lVcdEFClVnZtM3qt79Z48YbGmx+uCajIw5yity4uXqt/5Icqk+x61a7PX1BOvDj3lqydwvx5jR1Ta0Fi1RO3tjWCy9pcslL2mxcL3To49vfqfG1r+zlpm9/k8c2fxq4tRhOcTf+v8Td/7QbQLchqFriWD1HbwFwqZx/0Sv07Bc8n+ecvZwXXZCytNFkfzPhBw+J3PG9GvfeXWP7YxU9eCCWZrNstlTikllUrZWrb7RXL1Ad6TMvF5OO70QaF3qWLEtl7fqE55zd1nPObXPKqcqyRsyBZh+33FTh7rsOcNf37uR7N30F+CZwiCiCNM170D81B//TbADdOcKVVwpf+EJWkDVhOXAupz77Yk476yzOOGsNpz2nj5M3piyotUlI2LlXObgfHvx+hYkxkU0PVRkfN6CGbY/Fmlpx56HdS6aiSFl/fAoo8+dnuvFZHYaGldPOSFiyDNaugJgqo50amzfF3H9PUx64Z5c+cO+9PPTAd4CbgSfzgRmuuCLygkzZT+sD/mk3gF6voMSxLYYq3Ia1k4DncMbZz+GEk07muOOPYe36YdasqXLsemg0LPP7U2IyhIwp+1TESWHIgBKREDM2E9OcNezcDjt3JOzcPsHjj+6Wx7Zu0fvuvhfsPcBmoF0QXpzQlvw03vb/zgYw1xiuvhpe8xp3s7KuC7YcWAecyLoT1hNX1shppy/VJFkm6Hx9zvNqRHEFLTejiKdeaZqm3HdnG5Ux4soBHrzvAGlnJ9u3bQe2AtuAPWXq6nG0z3424qqr8kO3/50e5v8LJQ5erxt5zwkAAAAASUVORK5CYII=" style="width:40px; height:40px; border-radius:50%; border:2px solid var(--cyan-neon);" alt="Logo">
        <div>
          <div style="font-size:14px; font-weight:800; color:var(--cyan-neon);">Pasang di Layar Utama HP</div>
          <div style="font-size:10px; color:var(--text-muted);">Akses seperti aplikasi native tanpa lewat browser</div>
        </div>
      </div>
      
      <div style="background:var(--input-bg); border:1px solid var(--card-border); border-radius:10px; padding:12px; margin-bottom:12px; font-size:11px; line-height:1.5;">
        <div style="font-weight:bold; color:var(--text-white); margin-bottom:6px;">📱 Untuk Pengguna Android (Chrome):</div>
        1. Ketuk ikon <b>titik tiga (⋮)</b> di kanan atas Chrome.<br>
        2. Pilih <b>"Instal aplikasi"</b> atau <b>"Tambahkan ke Layar Utama"</b>.<br>
        3. Ketuk <b>Instal</b> untuk konfirmasi.
      </div>

      <div style="background:var(--input-bg); border:1px solid var(--card-border); border-radius:10px; padding:12px; margin-bottom:14px; font-size:11px; line-height:1.5;">
        <div style="font-weight:bold; color:var(--text-white); margin-bottom:6px;">🍎 Untuk Pengguna iPhone / iPad (Safari):</div>
        1. Ketuk tombol <b>Share</b> (ikon kotak panah ke atas) di bilah bawah Safari.<br>
        2. Gulir ke bawah lalu pilih <b>"Tambahkan ke Layar Utama" (Add to Home Screen)</b>.<br>
        3. Ketuk <b>"Tambah" (Add)</b> di pojok kanan atas.
      </div>

      <button type="button" class="btn-primary" style="height:40px; font-size:12px;" onclick="closeInstallModal()">Mengerti, Tutup</button>
    </div>
  </div>
    
    <!-- LOGIN SCREEN -->
    <div id="login-view" class="pin-card">
      <img src="data:image/png;base64,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" class="login-logo-img" alt="Logo">
      <h2 style="font-size:18px; font-weight:800;">Admin Multi-Tool Portal</h2>
      <p style="font-size:11px; color:var(--text-muted); margin-top:4px;">Masukkan PIN Admin untuk mengelola sheet lisensi</p>
      
      <input type="password" id="pin-input" class="pin-input" maxlength="6" placeholder="••••" autofocus inputmode="numeric" onkeydown="if(event.key==='Enter')login()">
      <br>
      <button class="btn-primary" id="btn-login" onclick="login()">MASUK PORTAL</button>
      <p id="pin-error" style="color:var(--danger); font-size:11px; margin-top:12px; font-weight:bold;" class="hidden"></p>
    </div>

    <!-- MAIN DASHBOARD -->
    <div id="dashboard-view" class="hidden">

      <!-- PWA Tip Banner -->
      <div class="pwa-tip" id="pwa-tip-box">
        <span>📱 <strong>Buka Seperti Aplikasi di HP:</strong> Ketuk Menu/Titik Tiga di Chrome (atau Ikon Bagikan di Safari) &gt; pilih <strong>Tambahkan ke Layar Utama</strong> (Add to Home Screen) agar lancar &amp; bebas expired selamanya!</span>
        <span class="pwa-tip-close" onclick="dismissPwaTip()">✕</span>
      </div>

      <!-- Migration Alert (Jika masih ada data di Sheet1) -->
      <div id="migration-box" class="migration-banner hidden">
        <div>
          <div style="font-weight:bold; font-size:12px; color:#fff;">📦 Ditemukan Data di Sheet1</div>
          <div class="migration-text">Klik tombol ini untuk memindahkan lisensi lama ke tab masing-masing tool otomatis.</div>
        </div>
        <button class="migration-btn" onclick="migrateSheet1()">Pisahkan Tab</button>
      </div>

      <!-- Tool Switcher Scrollable Chips -->
      <div class="tool-scroll-wrapper" id="tool-chips-container">
        <!-- Generated dynamically via JS -->
      </div>
      
      <!-- Stats -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-num" id="stat-total">0</div>
          <div class="stat-lbl">Total Pembeli</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" id="stat-active" style="color:var(--success);">0</div>
          <div class="stat-lbl">Aktif</div>
        </div>
        <div class="stat-card">
          <div class="stat-num" id="stat-trial" style="color:var(--warning);">0</div>
          <div class="stat-lbl">Trial</div>
        </div>
      </div>

      <!-- Quick Activate Form -->
      <div class="section-card">
        <div class="section-title">
          <span>⚡ AKTIVASI LISENSI BARU</span>
          <span style="font-size:10px; color:var(--cyan-neon);" id="active-tool-label">Auto-Detect</span>
        </div>

        <div class="form-group">
          <label class="form-label">PILIH TOOLS (LETAK TAB SHEET SPREADSHEET)</label>
          <div class="form-row" style="gap:6px;">
            <input type="text" id="add-hwid" class="form-input" placeholder="MDC-XXXX... / SND-XXXX..." oninput="onHwidInput(this.value)" style="flex:1; min-width:0;">
            <button type="button" class="btn-sm" style="background:var(--cyan-neon); color:#000; border-radius:8px; font-weight:800; white-space:nowrap; padding:0 12px; box-shadow:0 0 10px rgba(0,240,255,0.3);" onclick="startQrScanner()">📷 Scan</button>
            <button type="button" class="btn-sm" style="background:var(--cyan-dim); color:var(--cyan-neon); border:1px solid var(--cyan-neon); border-radius:8px; font-weight:bold; white-space:nowrap; padding:0 10px;" onclick="pasteHwid()">📋</button>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">NAMA PEMBELI</label>
          <input type="text" id="add-name" class="form-input" placeholder="Contoh: Budi Santoso">
        </div>

        <div class="form-group">
          <label class="form-label">PILIH PAKET LISENSI</label>
          <div class="plan-grid">
            <div class="plan-btn active" onclick="selectPlan(this, '1 Bulan')">💎 1 Bulan</div>
            <div class="plan-btn" onclick="selectPlan(this, '1 Tahun')">🌟 1 Tahun</div>
            <div class="plan-btn" onclick="selectPlan(this, 'Lifetime')">👑 Lifetime</div>
            <div class="plan-btn" onclick="selectPlan(this, 'Trial 24 Jam')">⚡ Trial 24 Jam</div>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">CATATAN / NOMOR WA (OPSIONAL)</label>
          <input type="text" id="add-notes" class="form-input" placeholder="Contoh: WA: 08123456789 (BCA Lunas)">
        </div>

        <button class="btn-primary" id="btn-save-license" onclick="activateLicense()">
          <span>⚡ AKTIFKAN SEKARANG</span>
        </button>
      </div>

      <!-- Search & License List -->
      <div class="section-card">
        <div class="section-title">
          <span>📋 DAFTAR LISENSI TERDAFTAR</span>
          <button class="btn-sm" id="btn-refresh" style="background:var(--cyan-dim); color:var(--cyan-neon); font-size:14px; padding:6px 12px; border-radius:8px;" onclick="loadLicenses(true)" title="Refresh Data">🔄</button>
        </div>

        <input type="text" id="search-input" class="form-input" placeholder="🔍 Cari nama pembeli, AppID, tool..." oninput="filterLicenses()" style="margin-bottom:12px;">

        <div id="license-list-container">
          <div style="text-align:center; color:var(--text-muted); padding:20px; font-size:12px;">Memuat data lisensi...</div>
        </div>
      </div>

    </div>

  </div>

  <script>
    // -------------------------------------------------------------
    // SAFE STORAGE ENGINE (100% Crash-Proof iOS Safari & Sandboxed iFrame)
    // -------------------------------------------------------------
    var SafeStorage = (function() {
      var mem = {};
      function testStorage() {
        try {
          var t = '__test_stg__';
          window.localStorage.setItem(t, t);
          window.localStorage.removeItem(t);
          return true;
        } catch(e) {
          return false;
        }
      }
      var isAvail = testStorage();
      return {
        get: function(key) {
          try {
            if (isAvail) return window.localStorage.getItem(key) || '';
          } catch(e) {}
          return mem[key] || '';
        },
        set: function(key, val) {
          try {
            if (isAvail) window.localStorage.setItem(key, val);
          } catch(e) {}
          mem[key] = val;
        },
        remove: function(key) {
          try {
            if (isAvail) window.localStorage.removeItem(key);
          } catch(e) {}
          delete mem[key];
        }
      };
    })();

    var currentPin = SafeStorage.get('mdc_admin_pin') || '';
    var activePlan = '1 Bulan';
    var selectedToolFilter = 'Semua Tools';
    var availableTools = ['RE-Merger Pro', 'Suno Downloader'];
    var allLicenses = [];
    var BACKEND_URL = '${serviceUrl}';

    // -------------------------------------------------------------
    // HYBRID DUAL-TRANSPORT API (google.script.run + Direct Fetch)
    // -------------------------------------------------------------
    function fetchApi(action, data, cb) {
      data = data || {};
      data.action = action;

      var handled = false;
      function onDone(res) {
        if (handled) return;
        handled = true;
        cb(res);
      }

      var hasGoogleRun = false;
      try {
        hasGoogleRun = (typeof google !== 'undefined' && google.script && typeof google.script.run !== 'undefined');
      } catch(e) {
        hasGoogleRun = false;
      }

      if (hasGoogleRun) {
        // Berikan waktu timeout yang cukup (20 detik) untuk cold start Google Apps Script
        var rpcTimer = setTimeout(function() {
          if (!handled) {
            console.warn('google.script.run timeout, fallback to fetch...');
            doFallbackFetch(0);
          }
        }, 20000);

        try {
          google.script.run
            .withSuccessHandler(function(res) {
              clearTimeout(rpcTimer);
              onDone(res || { success: false, error: 'Respons kosong dari server.' });
            })
            .withFailureHandler(function(err) {
              clearTimeout(rpcTimer);
              console.warn('google.script.run failure handler:', err);
              doFallbackFetch(0);
            })
            .callApiFromMobile(action, data);
        } catch(e) {
          clearTimeout(rpcTimer);
          doFallbackFetch(0);
        }
      } else {
        doFallbackFetch(0);
      }

      function doFallbackFetch(retryCount) {
        retryCount = retryCount || 0;
        var qs = Object.keys(data).map(function(k) {
          return encodeURIComponent(k) + '=' + encodeURIComponent(data[k]);
        }).join('&');

        var targetUrl = BACKEND_URL;
        if (!targetUrl || targetUrl.indexOf('http') !== 0) {
          targetUrl = '${serviceUrl}';
        }

        var controller = null;
        var timeoutId = null;
        try {
          if (window.AbortController) {
            controller = new AbortController();
            timeoutId = setTimeout(function() { controller.abort(); }, 18000);
          }
        } catch(e) {}

        var fetchOptions = {
          method: 'GET',
          mode: 'cors',
          cache: 'no-cache'
        };
        if (controller) {
          fetchOptions.signal = controller.signal;
        }

        fetch(targetUrl + '?' + qs, fetchOptions)
          .then(function(res) {
            if (timeoutId) clearTimeout(timeoutId);
            return res.json();
          })
          .then(function(json) {
            onDone(json);
          })
          .catch(function(err) {
            if (timeoutId) clearTimeout(timeoutId);
            if (retryCount < 1) {
              setTimeout(function() {
                doFallbackFetch(retryCount + 1);
              }, 1000);
            } else {
              onDone({
                success: false,
                isNetworkError: true,
                error: 'Gagal terhubung ke server Google (' + (err.message || 'Koneksi lambat/terputus') + '). Periksa koneksi internet HP Anda.'
              });
            }
          });
      }
    }

    
    // -------------------------------------------------------------
    // PWA INSTALLATION ENGINE (beforeinstallprompt + Guide Modal)
    // -------------------------------------------------------------
    var deferredPrompt = null;
    var isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone || document.referrer.includes('android-app://');

    window.addEventListener('beforeinstallprompt', function(e) {
      e.preventDefault();
      deferredPrompt = e;
      if (!isStandalone) {
        var banner = document.getElementById('pwa-install-banner');
        if (banner && SafeStorage.get('pwa_banner_dismissed') !== '1') {
          banner.classList.remove('hidden');
        }
        var topBtn = document.getElementById('btn-topbar-install');
        if (topBtn) topBtn.classList.remove('hidden');
      }
    });

    window.addEventListener('appinstalled', function() {
      showToast('MDC License Admin berhasil dipasang di HP! 🎉', 'success');
      dismissInstallBanner();
      var topBtn = document.getElementById('btn-topbar-install');
      if (topBtn) topBtn.classList.add('hidden');
      deferredPrompt = null;
    });

    function installPWA() {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then(function(choiceResult) {
          if (choiceResult.outcome === 'accepted') {
            showToast('Aplikasi berhasil dipasang di layar utama!', 'success');
            dismissInstallBanner();
          }
          deferredPrompt = null;
        });
      } else {
        openInstallModal();
      }
    }

    function openInstallModal() {
      document.getElementById('install-modal').classList.remove('hidden');
    }

    function closeInstallModal() {
      document.getElementById('install-modal').classList.add('hidden');
    }

    function dismissInstallBanner() {
      var banner = document.getElementById('pwa-install-banner');
      if (banner) banner.classList.add('hidden');
      SafeStorage.set('pwa_banner_dismissed', '1');
    }

    // Tampilkan tombol pasang di Topbar jika belum standalone
    if (!isStandalone) {
      setTimeout(function() {
        var topBtn = document.getElementById('btn-topbar-install');
        if (topBtn) topBtn.classList.remove('hidden');
        var banner = document.getElementById('pwa-install-banner');
        if (banner && SafeStorage.get('pwa_banner_dismissed') !== '1') {
          banner.classList.remove('hidden');
        }
      }, 1000);
    }

    
    // -------------------------------------------------------------
    // QR CODE SCANNER & GENERATOR ENGINE
    // -------------------------------------------------------------
    var html5QrCodeScanner = null;
    var currentCameraFacingMode = "environment";

    function playBeep() {
      try {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.12);
        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.12);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.12);
      } catch(e) {}
    }

    function startQrScanner() {
      document.getElementById('qr-scanner-modal').classList.remove('hidden');
      document.getElementById('qr-status-msg').innerText = 'Mengaktifkan kamera...';

      if (typeof Html5Qrcode === 'undefined') {
        document.getElementById('qr-status-msg').innerHTML = '<span style="color:var(--warning);">Memuat modul scanner...</span>';
        var script = document.createElement('script');
        script.src = 'https://unpkg.com/html5-qrcode@2.3.8/html5-qrcode.min.js';
        script.onload = function() {
          initCamera();
        };
        script.onerror = function() {
          document.getElementById('qr-status-msg').innerHTML = '<span style="color:var(--danger);">Gagal memuat modul scanner. Pastikan ada koneksi internet.</span>';
        };
        document.head.appendChild(script);
      } else {
        initCamera();
      }

      function initCamera() {
        try {
          if (html5QrCodeScanner) {
            try { html5QrCodeScanner.stop(); } catch(e) {}
          }
          html5QrCodeScanner = new Html5Qrcode("qr-reader");

          var config = {
            fps: 15,
            qrbox: { width: 220, height: 220 },
            aspectRatio: 1.0
          };

          html5QrCodeScanner.start(
            { facingMode: currentCameraFacingMode },
            config,
            function(decodedText) {
              onQrScanned(decodedText);
            },
            function(errorMessage) {}
          ).then(function() {
            document.getElementById('qr-status-msg').innerText = 'Arahkan kotak ke QR Code AppID pembeli';
          }).catch(function(err) {
            console.warn('Camera start error:', err);
            document.getElementById('qr-status-msg').innerHTML = '<span style="color:var(--warning);">Izin kamera diperlukan atau kamera sedang dipakai. Anda juga bisa memilih gambar screenshot.</span>';
          });
        } catch(err) {
          console.error('Init camera error:', err);
          document.getElementById('qr-status-msg').innerText = 'Gagal mengakses kamera: ' + err.message;
        }
      }
    }

    function stopQrScanner() {
      if (html5QrCodeScanner) {
        try {
          html5QrCodeScanner.stop().then(function() {
            html5QrCodeScanner.clear();
          }).catch(function() {});
        } catch(e) {}
      }
      document.getElementById('qr-scanner-modal').classList.add('hidden');
    }

    function switchCamera() {
      currentCameraFacingMode = (currentCameraFacingMode === "environment") ? "user" : "environment";
      startQrScanner();
    }

    function scanQrFromImage(inputEl) {
      if (!inputEl.files || inputEl.files.length === 0) return;
      var file = inputEl.files[0];
      document.getElementById('qr-status-msg').innerText = 'Memindai gambar/screenshot...';

      if (!html5QrCodeScanner) {
        if (typeof Html5Qrcode === 'undefined') {
          showToast('Modul scanner sedang dimuat...', 'info');
          return;
        }
        html5QrCodeScanner = new Html5Qrcode("qr-reader");
      }

      html5QrCodeScanner.scanFile(file, true)
        .then(function(decodedText) {
          onQrScanned(decodedText);
        })
        .catch(function(err) {
          document.getElementById('qr-status-msg').innerHTML = '<span style="color:var(--danger);">QR Code tidak terdeteksi pada gambar. Pastikan gambar jelas.</span>';
        });
    }

    function onQrScanned(decodedText) {
      playBeep();
      if (navigator.vibrate) {
        try { navigator.vibrate([100]); } catch(e) {}
      }

      var code = String(decodedText || '').trim();
      if (code.indexOf('hwid=') !== -1) {
        var match = code.match(/hwid=([A-Z0-9\-]+)/i);
        if (match) code = match[1];
      } else if (code.indexOf('/') !== -1 && code.indexOf('-') !== -1) {
        var parts = code.split('/');
        code = parts[parts.length - 1];
      }
      code = code.toUpperCase();

      var hwidInput = document.getElementById('add-hwid');
      if (hwidInput) {
        hwidInput.value = code;
        onHwidInput(code);
      }

      stopQrScanner();
      showToast('✅ Berhasil scan AppID: ' + code, 'success');

      var nameInput = document.getElementById('add-name');
      if (nameInput) {
        setTimeout(function() {
          nameInput.focus();
        }, 300);
      }
    }

    function showQrModal(hwid, name, tool) {
      document.getElementById('modal-qr-hwid').innerText = hwid;
      document.getElementById('modal-qr-title').innerText = name + ' (' + tool + ')';
      var qrImg = document.getElementById('modal-qr-img');
      qrImg.src = 'https://api.qrserver.com/v1/create-qr-code/?size=250x250&margin=10&data=' + encodeURIComponent(hwid);
      document.getElementById('view-qr-modal').classList.remove('hidden');
    }

    function closeViewQrModal() {
      document.getElementById('view-qr-modal').classList.add('hidden');
    }

    // -------------------------------------------------------------
    // TOAST & MODAL NOTIFICATION ENGINE
    // -------------------------------------------------------------
    function showToast(msg, type) {
      type = type || 'info';
      var container = document.getElementById('toast-container');
      if (!container) return;
      var toast = document.createElement('div');
      toast.className = 'toast toast-' + type;
      var icon = 'ℹ️';
      if (type === 'success') icon = '✅';
      else if (type === 'error') icon = '❌';
      else if (type === 'warning') icon = '⚠️';
      toast.innerHTML = '<span>' + icon + '</span><span>' + escapeHtml(msg) + '</span>';
      container.appendChild(toast);
      setTimeout(function() { toast.classList.add('toast-show'); }, 10);
      setTimeout(function() {
        toast.classList.remove('toast-show');
        setTimeout(function() {
          if (toast.parentNode) toast.parentNode.removeChild(toast);
        }, 300);
      }, 3500);
    }

    var confirmCallback = null;
    function showConfirm(title, message, onConfirm, btnText, btnColor) {
      confirmCallback = onConfirm;
      document.getElementById('modal-title').innerText = title || 'Konfirmasi Tindakan';
      document.getElementById('modal-message').innerText = message || 'Apakah Anda yakin ingin melanjutkan?';
      var actionBtn = document.getElementById('modal-btn-confirm');
      actionBtn.innerText = btnText || 'Ya, Lanjutkan';
      actionBtn.style.background = btnColor || 'var(--cyan-neon)';
      actionBtn.style.color = (btnColor === 'var(--danger)' || btnColor === '#F43F5E') ? '#fff' : '#000';
      document.getElementById('confirm-modal').classList.remove('hidden');
    }

    function closeConfirmModal() {
      confirmCallback = null;
      document.getElementById('confirm-modal').classList.add('hidden');
    }

    function executeModalConfirm() {
      var cb = confirmCallback;
      closeConfirmModal();
      if (typeof cb === 'function') {
        cb();
      }
    }

    function dismissPwaTip() {
      document.getElementById('pwa-tip-box').classList.add('hidden');
      SafeStorage.set('pwa_tip_dismissed', '1');
    }

    // -------------------------------------------------------------
    // INISIALISASI & AUTENTIKASI PIN
    // -------------------------------------------------------------
    window.onload = function() {
      if (SafeStorage.get('pwa_tip_dismissed') === '1') {
        var box = document.getElementById('pwa-tip-box');
        if (box) box.classList.add('hidden');
      }
      if (currentPin) {
        verifyPinAndLoad(currentPin);
      }
    };

    function login() {
      var pinInput = document.getElementById('pin-input');
      var pin = (pinInput.value || '').trim();
      if (!pin) {
        showToast('Harap masukkan PIN Admin.', 'warning');
        pinInput.focus();
        return;
      }

      var loginBtn = document.getElementById('btn-login');
      var errorEl = document.getElementById('pin-error');
      errorEl.classList.add('hidden');

      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span class="spinner-sm"></span> Menghubungkan...';

      fetchApi('admin_list', { pin: pin }, function(res) {
        loginBtn.disabled = false;
        loginBtn.innerHTML = 'MASUK PORTAL';

        if (res && res.success) {
          currentPin = pin;
          SafeStorage.set('mdc_admin_pin', pin);
          document.getElementById('login-view').classList.add('hidden');
          document.getElementById('dashboard-view').classList.remove('hidden');
          document.getElementById('logout-btn').classList.remove('hidden');

          if (res.tools && res.tools.length > 0) availableTools = res.tools;
          if (res.prefixMap) prefixMap = res.prefixMap;
          if (res.hasSheet1Data) document.getElementById('migration-box').classList.remove('hidden');
          else document.getElementById('migration-box').classList.add('hidden');

          updateToolDropdownAndChips();
          renderData(res.licenses || []);
          showToast('Selamat datang, Admin MDC!', 'success');
        } else {
          errorEl.classList.remove('hidden');
          if (res && res.isNetworkError) {
            errorEl.innerText = res.error || 'Kendala koneksi ke server Google. Silakan coba lagi.';
            errorEl.style.color = 'var(--warning)';
          } else {
            errorEl.innerText = (res && res.error) ? res.error : 'PIN Admin Salah!';
            errorEl.style.color = 'var(--danger)';
          }
        }
      });
    }

    function logout() {
      SafeStorage.remove('mdc_admin_pin');
      currentPin = '';
      document.getElementById('login-view').classList.remove('hidden');
      document.getElementById('dashboard-view').classList.add('hidden');
      document.getElementById('logout-btn').classList.add('hidden');
      document.getElementById('pin-input').value = '';
      showToast('Berhasil keluar dari portal.', 'info');
    }

    function verifyPinAndLoad(pin) {
      var errorEl = document.getElementById('pin-error');
      errorEl.classList.add('hidden');

      var loginBtn = document.getElementById('btn-login');
      if (loginBtn) {
        loginBtn.disabled = true;
        loginBtn.innerHTML = '<span class="spinner-sm"></span> Menghubungkan ke Server...';
      }

      fetchApi('admin_list', { pin: pin }, function(res) {
        if (loginBtn) {
          loginBtn.disabled = false;
          loginBtn.innerHTML = 'MASUK PORTAL';
        }

        if (res && res.success) {
          currentPin = pin;
          SafeStorage.set('mdc_admin_pin', pin);
          document.getElementById('login-view').classList.add('hidden');
          document.getElementById('dashboard-view').classList.remove('hidden');
          document.getElementById('logout-btn').classList.remove('hidden');

          if (res.tools && res.tools.length > 0) availableTools = res.tools;
          if (res.prefixMap) prefixMap = res.prefixMap;
          if (res.hasSheet1Data) document.getElementById('migration-box').classList.remove('hidden');
          else document.getElementById('migration-box').classList.add('hidden');

          updateToolDropdownAndChips();
          renderData(res.licenses || []);
        } else {
          errorEl.classList.remove('hidden');
          if (res && res.isNetworkError) {
            errorEl.innerHTML = '⚠️ Koneksi lambat atau terputus.<br><button type="button" onclick="verifyPinAndLoad(\'' + escapeQuote(pin) + '\')" style="margin-top:6px; background:var(--cyan-dim); border:1px solid var(--cyan-neon); color:var(--cyan-neon); padding:6px 14px; border-radius:6px; font-size:12px; cursor:pointer; font-weight:bold;">🔄 Coba Lagi</button>';
            errorEl.style.color = 'var(--warning)';
          } else {
            errorEl.innerText = (res && res.error) ? res.error : 'PIN Admin Salah!';
            errorEl.style.color = 'var(--danger)';
          }
        }
      });
    }

    // -------------------------------------------------------------
    // TOOL SWITCHER & DROPDOWN MANAGEMENT
    // -------------------------------------------------------------
    function updateToolDropdownAndChips() {
      // 1. Render Chips Filter
      var container = document.getElementById('tool-chips-container');
      var html = '<div class="tool-chip ' + (selectedToolFilter === 'Semua Tools' ? 'active' : '') + '" onclick="filterByTool(\'Semua Tools\')">🌐 Semua Tools</div>';
      
      availableTools.forEach(function(t) {
        html += '<div class="tool-chip ' + (selectedToolFilter === t ? 'active' : '') + '" onclick="filterByTool(\'' + escapeQuote(t) + '\')">📁 ' + escapeHtml(t) + '</div>';
      });

      html += '<div class="tool-chip tool-chip-add" onclick="promptNewTool()">➕ Buat Sheet Tool Baru</div>';
      container.innerHTML = html;

      // 2. Render Form Tool Dropdown
      var select = document.getElementById('form-tool-select');
      var selHtml = '';
      availableTools.forEach(function(t) {
        selHtml += '<option value="' + escapeHtml(t) + '">' + escapeHtml(t) + '</option>';
      });
      selHtml += '<option value="__NEW__">➕ Tambah Tool Baru...</option>';
      select.innerHTML = selHtml;

      if (selectedToolFilter !== 'Semua Tools') {
        select.value = selectedToolFilter;
      }
    }

    function filterByTool(toolName) {
      selectedToolFilter = toolName;
      updateToolDropdownAndChips();
      filterLicenses();
    }

    function onFormToolChange() {
      var select = document.getElementById('form-tool-select');
      var customGrp = document.getElementById('custom-tool-group');
      if (select.value === '__NEW__') {
        customGrp.classList.remove('hidden');
        document.getElementById('add-custom-tool').focus();
      } else {
        customGrp.classList.add('hidden');
      }
    }

    var prefixMap = {
      'SND': 'Suno Downloader',
      'REM': 'RE-Merger Pro',
      'MDC': 'Paket Bundle',
      'AMV': 'Auto Massal Video',
      'AVM': 'Auto Massal Video',
      'ORB': 'Orbit Analyzer',
      'OBA': 'Orbit Analyzer',
      'ADC': 'Adcut Analyzer',
      'BDL': 'Paket Bundle'
    };

    function promptNewTool() {
      var name = prompt('1/2. Masukkan Nama Tool Baru:\n(Contoh: Auto Massal Video, TikTok Bot, dll)');
      if (!name || !name.trim()) return;
      name = name.trim();

      var defaultPref = name.replace(/[^A-Za-z]/g, '').substring(0, 3).toUpperCase();
      var pref = prompt('2/2. Masukkan Kode Awalan 3 Huruf:\n(Contoh: AVM, AMV, SND, ORB, dsb)', defaultPref);
      pref = (pref || '').trim().toUpperCase();

      showToast('Membuat sheet baru...', 'info');
      fetchApi('admin_create_tool', { pin: currentPin, tool_name: name, prefix: pref }, function(res) {
        if (res && res.success) {
          showToast(res.message || 'Sheet tool berhasil dibuat!', 'success');
          if (res.tools) availableTools = res.tools;
          else if (availableTools.indexOf(name) === -1) availableTools.push(name);
          if (res.prefixMap) prefixMap = res.prefixMap;
          else if (pref) prefixMap[pref] = name;
          selectedToolFilter = name;
          updateToolDropdownAndChips();
          document.getElementById('form-tool-select').value = name;
          onFormToolChange();
        } else {
          showToast('Gagal: ' + ((res && res.error) || 'Terjadi kesalahan.'), 'error');
        }
      });
    }

    function onHwidInput(val) {
      val = String(val || '').toUpperCase().trim();
      var parts = val.split('-');
      var pref = parts.length > 1 ? parts[0].trim() : '';
      var select = document.getElementById('form-tool-select');
      var label = document.getElementById('active-tool-label');

      if (pref && prefixMap[pref]) {
        var matchedTool = prefixMap[pref];
        if (availableTools.indexOf(matchedTool) !== -1) {
          select.value = matchedTool;
          label.innerText = matchedTool;
          onFormToolChange();
        }
      } else {
        label.innerText = 'Auto-Detect';
      }
    }

    function pasteHwid() {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function(text) {
          text = (text || '').trim();
          if (text) {
            document.getElementById('add-hwid').value = text;
            onHwidInput(text);
            showToast('AppID berhasil ditempel!', 'success');
          } else {
            showToast('Clipboard kosong.', 'warning');
          }
        }).catch(function() {
          var input = document.getElementById('add-hwid');
          input.focus();
          showToast('Tahan kotak input lalu pilih Tempel / Paste', 'info');
        });
      } else {
        var input = document.getElementById('add-hwid');
        input.focus();
        showToast('Tahan kotak input lalu pilih Tempel / Paste', 'info');
      }
    }

    function selectPlan(el, plan) {
      document.querySelectorAll('.plan-btn').forEach(function(b) { b.classList.remove('active'); });
      el.classList.add('active');
      activePlan = plan;
    }

    // -------------------------------------------------------------
    // OPERASI LISENSI
    // -------------------------------------------------------------
    function activateLicense() {
      var hwid = String(document.getElementById('add-hwid').value || '').trim();
      var name = String(document.getElementById('add-name').value || '').trim();
      var notes = String(document.getElementById('add-notes').value || '').trim();
      var select = document.getElementById('form-tool-select');
      var tool = select.value;

      if (tool === '__NEW__') {
        tool = String(document.getElementById('add-custom-tool').value || '').trim();
        if (!tool) {
          showToast('Harap isi nama Tool Baru.', 'warning');
          document.getElementById('add-custom-tool').focus();
          return;
        }
      }

      if (!hwid) {
        showToast('Harap isi AppID pembeli.', 'warning');
        document.getElementById('add-hwid').focus();
        return;
      }

      var btn = document.getElementById('btn-save-license');
      btn.innerHTML = '<span class="spinner-sm"></span> Menyimpan...';
      btn.disabled = true;

      fetchApi('admin_add', {
        pin: currentPin,
        hwid: hwid,
        name: name || 'Pembeli',
        plan: activePlan,
        tool: tool,
        notes: notes || 'Ditambahkan via Mobile Admin'
      }, function(res) {
        btn.innerHTML = '<span>⚡ AKTIFKAN SEKARANG</span>';
        btn.disabled = false;
        if (res && res.success) {
          showToast(res.message || 'Lisensi berhasil diaktifkan!', 'success');
          document.getElementById('add-hwid').value = '';
          document.getElementById('add-name').value = '';
          document.getElementById('add-notes').value = '';
          loadLicenses(false);
        } else {
          showToast('Gagal: ' + ((res && res.error) || 'Terjadi kesalahan.'), 'error');
        }
      });
    }

    function migrateSheet1() {
      showConfirm(
        'Pisahkan Data Sheet1',
        'Pindahkan semua data lisensi dari Sheet1 ke Sheet tool masing-masing secara otomatis?',
        function() {
          var box = document.getElementById('migration-box');
          box.innerHTML = '<div style="color:#E9D5FF; font-size:12px; font-weight:bold;"><span class="spinner-sm spinner-cyan"></span> Sedang memproses migrasi data... Harap tunggu sebentar.</div>';

          fetchApi('admin_migrate_sheet1', { pin: currentPin }, function(res) {
            if (res && res.success) {
              showToast(res.message || 'Migrasi berhasil!', 'success');
              box.classList.add('hidden');
              loadLicenses(true);
            } else {
              showToast('Gagal migrasi: ' + ((res && res.error) || 'Terjadi kesalahan.'), 'error');
              box.classList.remove('hidden');
            }
          });
        },
        'Pisahkan Sekarang',
        'var(--purple-neon)'
      );
    }

    function loadLicenses(showFeedback) {
      var btnRefresh = document.getElementById('btn-refresh');
      if (btnRefresh) {
        btnRefresh.innerHTML = '<span class="spinner-sm spinner-cyan"></span>';
      }

      fetchApi('admin_list', { pin: currentPin }, function(res) {
        if (btnRefresh) {
          btnRefresh.innerText = '🔄';
        }

        if (res && res.success) {
          if (res.tools && res.tools.length > 0) {
            availableTools = res.tools;
            updateToolDropdownAndChips();
          }
          if (res.prefixMap) {
            prefixMap = res.prefixMap;
          }
          if (res.hasSheet1Data) {
            document.getElementById('migration-box').classList.remove('hidden');
          } else {
            document.getElementById('migration-box').classList.add('hidden');
          }
          renderData(res.licenses || []);
          if (showFeedback) {
            showToast('Data lisensi diperbarui (' + (res.licenses ? res.licenses.length : 0) + ' data).', 'success');
          }
        } else {
          if (showFeedback) {
            showToast('Gagal memuat: ' + ((res && res.error) || 'Koneksi terputus.'), 'error');
          }
        }
      });
    }

    function extendLicense(hwid, tool, days) {
      showConfirm(
        'Perpanjang Lisensi',
        'Perpanjang lisensi ' + hwid + ' (' + tool + ') selama ' + days + ' hari?',
        function() {
          showToast('Memperpanjang lisensi...', 'info');
          fetchApi('admin_extend', { pin: currentPin, hwid: hwid, tool: tool, days: days }, function(res) {
            if (res && res.success) {
              showToast(res.message || 'Masa aktif berhasil diperpanjang.', 'success');
              loadLicenses(false);
            } else {
              showToast('Gagal: ' + ((res && res.error) || 'Terjadi kesalahan.'), 'error');
            }
          });
        },
        '+' + days + ' Hari',
        'var(--cyan-neon)'
      );
    }

    function toggleBlock(hwid, tool, currentStatus) {
      var isUnblocking = (currentStatus === 'Blokir');
      var newStatus = isUnblocking ? 'Aktif' : 'Blokir';
      showConfirm(
        isUnblocking ? 'Buka Blokir Lisensi' : 'Blokir Akses Lisensi',
        'Ubah status lisensi ' + hwid + ' (' + tool + ') menjadi ' + newStatus + '?',
        function() {
          showToast('Memperbarui status...', 'info');
          fetchApi('admin_set_status', { pin: currentPin, hwid: hwid, tool: tool, status: newStatus }, function(res) {
            if (res && res.success) {
              showToast(res.message || 'Status berhasil diubah.', 'success');
              loadLicenses(false);
            } else {
              showToast('Gagal: ' + ((res && res.error) || 'Terjadi kesalahan.'), 'error');
            }
          });
        },
        isUnblocking ? 'Buka Blokir' : 'Blokir Sekarang',
        isUnblocking ? 'var(--success)' : 'var(--danger)'
      );
    }

    function deleteLicense(hwid, tool) {
      showConfirm(
        'Hapus Lisensi Permanen',
        'PERINGATAN: Lisensi ' + hwid + ' di tab ' + tool + ' akan dihapus secara permanen dari spreadsheet!',
        function() {
          showToast('Menghapus data...', 'info');
          fetchApi('admin_delete', { pin: currentPin, hwid: hwid, tool: tool }, function(res) {
            if (res && res.success) {
              showToast(res.message || 'Data berhasil dihapus.', 'success');
              loadLicenses(false);
            } else {
              showToast('Gagal: ' + ((res && res.error) || 'Terjadi kesalahan.'), 'error');
            }
          });
        },
        'Hapus Permanen',
        'var(--danger)'
      );
    }

    // -------------------------------------------------------------
    // RENDERING & FILTERING DAFTAR LISENSI
    // -------------------------------------------------------------
    function renderData(list) {
      allLicenses = Array.isArray(list) ? list : [];
      filterLicenses();
    }

    function filterLicenses() {
      try {
        var q = String(document.getElementById('search-input').value || '').toLowerCase().trim();
        var container = document.getElementById('license-list-container');

        var filtered = allLicenses.filter(function(item) {
          if (!item) return false;
          var itemTool = String(item.tool || '');
          var itemHwid = String(item.hwid || '');
          var itemName = String(item.name || '');
          var itemNotes = String(item.notes || '');

          var matchTool = (selectedToolFilter === 'Semua Tools') || (itemTool === selectedToolFilter);
          var matchQuery = !q || (
            itemHwid.toLowerCase().indexOf(q) !== -1 ||
            itemName.toLowerCase().indexOf(q) !== -1 ||
            itemTool.toLowerCase().indexOf(q) !== -1 ||
            itemNotes.toLowerCase().indexOf(q) !== -1
          );
          return matchTool && matchQuery;
        });

        // Update Statistik Berdasarkan Data Terfilter
        var activeCount = 0;
        var trialCount = 0;
        filtered.forEach(function(item) {
          var planStr = String(item.plan || '').toLowerCase();
          if (item.status === 'Aktif' && !item.isExpired) activeCount++;
          if (planStr.indexOf('trial') !== -1) trialCount++;
        });

        document.getElementById('stat-total').innerText = filtered.length;
        document.getElementById('stat-active').innerText = activeCount;
        document.getElementById('stat-trial').innerText = trialCount;

        if (filtered.length === 0) {
          container.innerHTML = '<div style="text-align:center; color:var(--text-muted); padding:28px 10px; font-size:12px;">Tidak ada lisensi ditemukan untuk filter ini.</div>';
          return;
        }

        var html = '';
        filtered.forEach(function(lic) {
          var badgeClass = 'badge-active';
          var badgeText = String(lic.status || 'Aktif');
          var planStr = String(lic.plan || '');

          if (lic.isBanned) {
            badgeClass = 'badge-banned';
            badgeText = 'DIBLOKIR';
          } else if (lic.isExpired) {
            badgeClass = 'badge-expired';
            badgeText = 'EXPIRED';
          } else if (planStr.toLowerCase().indexOf('trial') !== -1) {
            badgeClass = 'badge-trial';
            badgeText = 'TRIAL (' + (lic.daysLeft || 0) + 'h)';
          } else if (planStr.toLowerCase().indexOf('lifetime') !== -1) {
            badgeClass = 'badge-active';
            badgeText = 'LIFETIME';
          } else {
            badgeText = planStr + ' (' + (lic.daysLeft || 0) + 'h)';
          }

          var startDisplay = String(lic.startDate || '-');
          if (startDisplay.indexOf(' ') !== -1) startDisplay = startDisplay.split(' ')[0];

          var expDisplay = String(lic.expiryDate || '-');
          if (expDisplay.indexOf(' ') !== -1) expDisplay = expDisplay.split(' ')[0];

          var notesHtml = '';
          if (lic.notes && String(lic.notes).trim() !== '-' && String(lic.notes).trim() !== '') {
            notesHtml = '<div style="font-size:10px; color:var(--text-muted); margin-bottom:8px; word-break:break-all;">📝 ' + escapeHtml(lic.notes) + '</div>';
          }

          html += '<div class="lic-card">' +
            '<div class="lic-header">' +
              '<div>' +
                '<span class="lic-name">' + escapeHtml(lic.name) + '</span><br>' +
                '<span class="lic-tool-tag">📁 ' + escapeHtml(lic.tool || 'Umum') + '</span>' +
                '<div class="lic-hwid">' + escapeHtml(lic.hwid) + '</div>' +
              '</div>' +
              '<span class="badge ' + badgeClass + '">' + escapeHtml(badgeText) + '</span>' +
            '</div>' +
            '<div class="lic-meta">' +
              '<span>Mulai: ' + escapeHtml(startDisplay) + '</span>' +
              '<span>Berakhir: ' + escapeHtml(expDisplay) + '</span>' +
            '</div>' +
            notesHtml +
            '<div class="lic-actions">' +
              '<button class="btn-sm" style="background:var(--input-bg); color:var(--cyan-neon); border:1px solid var(--cyan-neon);" onclick="showQrModal(\'' + escapeQuote(lic.hwid) + '\', \'' + escapeQuote(lic.name) + '\', \'' + escapeQuote(lic.tool) + '\')">🔳 QR</button>' +
              '<button class="btn-sm" style="background:var(--cyan-dim); color:var(--cyan-neon);" onclick="extendLicense(\'' + escapeQuote(lic.hwid) + '\', \'' + escapeQuote(lic.tool) + '\', 30)">+1 Bulan</button>' +
              '<button class="btn-sm" style="background:var(--input-bg); color:var(--text-white); border:1px solid var(--card-border);" onclick="extendLicense(\'' + escapeQuote(lic.hwid) + '\', \'' + escapeQuote(lic.tool) + '\', 365)">+1 Tahun</button>' +
              '<button class="btn-sm" style="background:' + (lic.isBanned ? 'var(--success)' : 'var(--danger)') + '; color:#fff;" onclick="toggleBlock(\'' + escapeQuote(lic.hwid) + '\', \'' + escapeQuote(lic.tool) + '\', \'' + escapeQuote(lic.status) + '\')">' + (lic.isBanned ? 'Buka Blokir' : 'Blokir') + '</button>' +
              '<button class="btn-sm" style="background:transparent; color:var(--text-muted);" onclick="deleteLicense(\'' + escapeQuote(lic.hwid) + '\', \'' + escapeQuote(lic.tool) + '\')">Hapus</button>' +
            '</div>' +
          '</div>';
        });

        container.innerHTML = html;
      } catch(err) {
        console.error('Filter error:', err);
      }
    }

    function escapeHtml(str) {
      return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }

    function escapeQuote(str) {
      return String(str || '').replace(/'/g, "\\'");
    }

    // Tangani error JavaScript global agar halaman tidak membeku
    
    // -------------------------------------------------------------
    // SERVER CONFIGURATION MANAGER
    // -------------------------------------------------------------
    function toggleServerSettings() {
      var box = document.getElementById('server-settings-box');
      if (box.classList.contains('hidden')) {
        box.classList.remove('hidden');
        document.getElementById('custom-api-url').value = BACKEND_URL;
      } else {
        box.classList.add('hidden');
      }
    }

    function saveServerUrl() {
      var val = (document.getElementById('custom-api-url').value || '').trim();
      if (!val || val.indexOf('http') !== 0) {
        showToast('URL tidak valid. Harus diawali https://', 'warning');
        return;
      }
      BACKEND_URL = val;
      SafeStorage.set('mdc_custom_api_url', val);
      showToast('URL Server berhasil disimpan!', 'success');
      document.getElementById('server-settings-box').classList.add('hidden');
    }

    // Inisialisasi custom API URL jika pernah disimpan
    var savedApi = SafeStorage.get('mdc_custom_api_url');
    if (savedApi && savedApi.indexOf('http') === 0) {
      BACKEND_URL = savedApi;
    }

    // -------------------------------------------------------------
    // PWA SERVICE WORKER REGISTRATION
    // -------------------------------------------------------------
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function() {
        navigator.serviceWorker.register('./sw.js').catch(function(err) {
          console.log('PWA ServiceWorker notice:', err);
        });
      });
    }

    window.onerror = function(msg, url, line) {
      console.warn('UI Error caught:', msg, 'Line:', line);
      return false;
    };
  </script>
</body>
</html>`;
}

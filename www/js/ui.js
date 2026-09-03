/* طبقة الواجهة المشتركة لكل الصفحات:
   الترويسة والشريط السفلي (مصدر واحد بدل تكرارها في تسعة ملفات)، السمة الفاتحة/الداكنة،
   التنبيهات المتراكمة، مربعات التأكيد، تهريب النصوص، والتصدير (نسخ / CSV). */

const UI = (() => {
  /* ---------------- تهريب النصوص ---------------- */
  const ENT = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  function esc(v) {
    if (v === null || v === undefined) return "";
    return String(v).replace(/[&<>"']/g, (c) => ENT[c]);
  }

  /* ---------------- الأدوات والتنقّل (تعريف واحد) ---------------- */
  const TOOLS = [
    { id: "coords", href: "coords.html", icon: "🧭", name: "تحويل الإحداثيات", desc: "UTM ⇄ خط الطول والعرض" },
    { id: "area", href: "area.html", icon: "📐", name: "المساحات والمسافات", desc: "مساحة، محيط، أزيموث بين نقاط" },
    { id: "leveling", href: "leveling.html", icon: "📏", name: "حسابات الميزانية", desc: "تفريغ مناسيب BS / IS / FS" },
    { id: "traverse", href: "traverse.html", icon: "🔺", name: "تسوية المضلعات", desc: "Bowditch و Transit — توزيع الخطأ" },
    { id: "levelcheck", href: "levelcheck.html", icon: "🎯", name: "التحقق من المناسيب", desc: "تحقق ميداني خطوة بخطوة" },
    { id: "fieldnotes", href: "fieldnotes.html", icon: "📒", name: "الدفتر الميداني", desc: "ملاحظات مع موقع GPS" },
    { id: "settings", href: "settings.html", icon: "⚙️", name: "الإعدادات", desc: "التحديثات والمظهر والمستودع" },
  ];

  const NAV = [
    { id: "home", icon: "🏠", label: "الرئيسية", href: "index.html", root: true },
    { id: "tools", icon: "🧰", label: "الأدوات", action: "tools" },
    { id: "fieldnotes", icon: "📒", label: "الدفتر", href: "fieldnotes.html" },
    { id: "notifications", icon: "🔔", label: "الإشعارات", href: "notifications.html", badge: true },
    { id: "settings", icon: "⚙️", label: "الإعدادات", href: "settings.html" },
  ];

  /* جذر الصفحة: الصفحات داخل pages/ تحتاج ../ للوصول للجذر */
  function base() {
    return document.body.dataset.root === "true" ? "" : "../";
  }
  function pagePath(href) {
    if (!href) return null;
    if (href === "index.html") return base() + "index.html";
    return document.body.dataset.root === "true" ? "pages/" + href : href;
  }

  /* ---------------- السمة (فاتح / داكن / تلقائي) ---------------- */
  const THEME_KEY = "masaha_theme";
  const THEMES = [
    { id: "auto", label: "تلقائي", icon: "🌗" },
    { id: "light", label: "فاتح", icon: "☀️" },
    { id: "dark", label: "داكن", icon: "🌙" },
  ];

  function readTheme() {
    try { return localStorage.getItem(THEME_KEY) || "auto"; } catch (e) { return "auto"; }
  }
  function applyTheme(mode) {
    const m = THEMES.some((t) => t.id === mode) ? mode : "auto";
    if (m === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", m);
    try { localStorage.setItem(THEME_KEY, m); } catch (e) { /* وضع التصفح الخاص */ }
    document.querySelectorAll("[data-theme-btn]").forEach((b) => {
      b.setAttribute("aria-pressed", String(b.dataset.themeBtn === m));
    });
    return m;
  }
  function cycleTheme() {
    const cur = readTheme();
    const next = THEMES[(THEMES.findIndex((t) => t.id === cur) + 1) % THEMES.length].id;
    applyTheme(next);
    const t = THEMES.find((x) => x.id === next);
    toast(`المظهر: ${t.label}`, "info");
    return next;
  }
  function readFontScale() {
    try { return parseFloat(localStorage.getItem("masaha_font_scale")) || 1; } catch (e) { return 1; }
  }
  function applyFontScale(scale) {
    const s = Math.min(1.4, Math.max(0.9, Number(scale) || 1));
    document.documentElement.style.setProperty("--font-scale", String(s));
    try { localStorage.setItem("masaha_font_scale", String(s)); } catch (e) { /* تجاهل */ }
    return s;
  }

  /* ---------------- التنبيهات (طابور متراكم لا يطبع بعضه فوق بعض) ---------------- */
  function toastHost() {
    let host = document.getElementById("toastHost");
    if (!host) {
      host = document.createElement("div");
      host.id = "toastHost";
      host.className = "toast-host";
      host.setAttribute("role", "status");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    return host;
  }

  function toast(text, type = "info", ms = 3400) {
    const host = toastHost();
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    const icon = { info: "ℹ️", success: "✅", error: "⚠️", warn: "⚠️" }[type] || "ℹ️";
    el.innerHTML = `<span class="ti" aria-hidden="true">${icon}</span><span class="tt"></span>`;
    el.querySelector(".tt").textContent = text;
    host.appendChild(el);
    const kill = () => { el.classList.add("out"); setTimeout(() => el.remove(), 220); };
    const timer = setTimeout(kill, ms);
    el.addEventListener("click", () => { clearTimeout(timer); kill(); });
    while (host.children.length > 4) host.firstElementChild.remove();
    return el;
  }

  /* ---------------- مربع حوار (تأكيد / رسالة) ---------------- */
  let openDialogs = 0;
  function dialog({ icon = "❔", title, message = "", html = "", confirmLabel = "تأكيد", cancelLabel = "إلغاء", danger = false, showCancel = true, onConfirm = null }) {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.setAttribute("role", "dialog");
      overlay.setAttribute("aria-modal", "true");
      const titleId = "dlg" + Date.now();
      overlay.setAttribute("aria-labelledby", titleId);
      overlay.innerHTML = `
        <div class="modal-box">
          <div class="modal-icon" aria-hidden="true">${esc(icon)}</div>
          <h3 id="${titleId}"></h3>
          <div class="modal-msg"></div>
          <div class="modal-actions">
            ${showCancel ? `<button type="button" class="btn secondary" data-cancel></button>` : ""}
            <button type="button" class="btn ${danger ? "danger" : ""}" data-confirm></button>
          </div>
        </div>`;
      overlay.querySelector("h3").textContent = title;
      const msgEl = overlay.querySelector(".modal-msg");
      if (html) msgEl.innerHTML = html;
      else msgEl.textContent = message;
      const okBtn = overlay.querySelector("[data-confirm]");
      okBtn.textContent = confirmLabel;
      const cancelBtn = overlay.querySelector("[data-cancel]");
      if (cancelBtn) cancelBtn.textContent = cancelLabel;

      const prevFocus = document.activeElement;
      openDialogs++;
      document.body.classList.add("modal-open");

      const close = (val) => {
        overlay.remove();
        openDialogs = Math.max(0, openDialogs - 1);
        if (!openDialogs) document.body.classList.remove("modal-open");
        document.removeEventListener("keydown", onKey, true);
        if (prevFocus && prevFocus.focus) prevFocus.focus();
        resolve(val);
      };
      const onKey = (e) => {
        if (e.key === "Escape") { e.preventDefault(); close(false); }
        if (e.key === "Tab") {
          const f = overlay.querySelectorAll("button");
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
          else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
        }
      };

      if (cancelBtn) cancelBtn.onclick = () => close(false);
      overlay.onclick = (e) => { if (e.target === overlay) close(false); };
      okBtn.onclick = async () => {
        if (!onConfirm) return close(true);
        okBtn.disabled = true;
        const label = okBtn.textContent;
        okBtn.textContent = "جارٍ التنفيذ...";
        try {
          await onConfirm();
          close(true);
        } catch (err) {
          okBtn.disabled = false;
          okBtn.textContent = label;
          toast("تعذّر التنفيذ: " + (err && err.message ? err.message : err), "error");
        }
      };

      document.body.appendChild(overlay);
      document.addEventListener("keydown", onKey, true);
      (showCancel ? cancelBtn : okBtn).focus();
    });
  }

  const confirm = (opts) => dialog({ icon: "⚠️", confirmLabel: "حذف", danger: true, ...opts });
  const alert = (opts) => dialog({ showCancel: false, confirmLabel: "حسنًا", ...opts });

  /* ---------------- الترويسة والشريط السفلي ---------------- */
  function renderChrome() {
    const body = document.body;
    const isRoot = body.dataset.root === "true";
    const title = body.dataset.title || document.title;
    const current = body.dataset.page || "";

    const header = document.getElementById("appHeader");
    if (header) {
      const backHref = isRoot ? null : base() + "index.html";
      header.className = "app-header";
      header.innerHTML = `
        <div class="title-row">
          ${backHref ? `<a class="icon-btn back-btn" href="${esc(backHref)}" aria-label="رجوع إلى الرئيسية"><span aria-hidden="true">→</span></a>` : ""}
          <h1></h1>
        </div>
        <div class="header-actions">
          <button type="button" class="icon-btn" data-theme-toggle aria-label="تبديل المظهر بين التلقائي والفاتح والداكن"><span aria-hidden="true">🌗</span></button>
          <a class="icon-btn" href="${esc(pagePath("notifications.html"))}" aria-label="مركز الإشعارات">
            <span aria-hidden="true">🔔</span>
            <span class="badge hidden" data-notif-badge aria-hidden="true">0</span>
          </a>
        </div>`;
      header.querySelector("h1").textContent = title;
      header.querySelector("[data-theme-toggle]").addEventListener("click", cycleTheme);
    }

    const nav = document.getElementById("appNav");
    if (nav) {
      nav.className = "bottom-nav";
      nav.setAttribute("aria-label", "التنقّل الرئيسي");
      nav.innerHTML = NAV.map((item) => {
        const active = item.id === current;
        const aria = active ? ' aria-current="page"' : "";
        const badge = item.badge ? `<span class="badge hidden" data-notif-badge aria-hidden="true">0</span>` : "";
        if (item.action === "tools") {
          return `<button type="button" class="nav-item${active ? " active" : ""}" data-nav-tools>
            <span class="ic" aria-hidden="true">${item.icon}</span><span class="lb">${esc(item.label)}</span></button>`;
        }
        return `<a class="nav-item${active ? " active" : ""}" href="${esc(pagePath(item.href))}"${aria}>
          <span class="ic" aria-hidden="true">${item.icon}</span><span class="lb">${esc(item.label)}</span>${badge}</a>`;
      }).join("");
      const tb = nav.querySelector("[data-nav-tools]");
      if (tb) tb.addEventListener("click", openToolSheet);
    }
  }

  function openToolSheet() {
    const html = `<div class="tool-sheet">${TOOLS.map((t) => `
      <a class="tool-sheet-item" href="${esc(pagePath(t.href))}">
        <span class="ic" aria-hidden="true">${t.icon}</span>
        <span class="tx"><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span>
      </a>`).join("")}</div>`;
    return dialog({ icon: "🧰", title: "كل الأدوات", html, showCancel: false, confirmLabel: "إغلاق" });
  }

  /* ---------------- تصدير النتائج ---------------- */
  function toCSV(rows) {
    const cell = (v) => {
      const s = v === null || v === undefined ? "" : String(v);
      return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    return rows.map((r) => r.map(cell).join(",")).join("\r\n");
  }

  async function copyText(text) {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
        toast("تم النسخ إلى الحافظة", "success");
        return true;
      }
    } catch (e) { /* المسار البديل أدناه */ }
    try {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
      document.body.appendChild(ta);
      ta.select();
      const ok = document.execCommand("copy");
      ta.remove();
      toast(ok ? "تم النسخ إلى الحافظة" : "تعذّر النسخ", ok ? "success" : "error");
      return ok;
    } catch (e) {
      toast("تعذّر النسخ: " + (e.message || e), "error");
      return false;
    }
  }

  /* يحفظ ملفًا نصيًا: داخل التطبيق إلى مجلد المستندات، وفي المتصفح كتنزيل */
  async function saveTextFile(filename, content, mime = "text/csv;charset=utf-8") {
    const name = filename.replace(/[^\w؀-ۿ.\- ]+/g, "_");
    if (window.Native && window.Native.Filesystem) {
      try {
        const res = await window.Native.Filesystem.writeFile({
          path: `masaha/${name}`,
          data: "﻿" + content,
          directory: "DOCUMENTS",
          encoding: "utf8",
          recursive: true,
        });
        await alert({
          icon: "💾", title: "تم حفظ الملف",
          message: `حُفظ باسم ${name} داخل مجلد المستندات.\n\n${res && res.uri ? res.uri : ""}`,
          confirmLabel: "حسنًا",
        });
        return true;
      } catch (e) {
        toast("تعذّر الحفظ: " + (e.message || e) + " — استخدم النسخ بدلًا منه", "error");
        return false;
      }
    }
    try {
      const blob = new Blob(["﻿" + content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = name;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast("تم تنزيل الملف", "success");
      return true;
    } catch (e) {
      toast("تعذّر التصدير: " + (e.message || e), "error");
      return false;
    }
  }

  /* شريط أزرار تصدير موحّد لكل أداة */
  function exportBar(container, { filename, rows, text }) {
    const host = typeof container === "string" ? document.getElementById(container) : container;
    if (!host) return;
    host.innerHTML = `
      <button type="button" class="btn secondary sm" data-x-copy>📋 نسخ النتيجة</button>
      <button type="button" class="btn secondary sm" data-x-csv>⬇️ تصدير CSV</button>`;
    host.querySelector("[data-x-copy]").onclick = () => copyText(typeof text === "function" ? text() : text);
    host.querySelector("[data-x-csv]").onclick = () => {
      const r = typeof rows === "function" ? rows() : rows;
      if (!r || !r.length) return toast("لا توجد نتائج للتصدير", "warn");
      const fn = typeof filename === "function" ? filename() : filename;
      return saveTextFile(fn, toCSV(r));
    };
  }

  function stamp() {
    const d = new Date();
    const p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  }

  /* ---------------- عرض الأخطاء والتحذيرات بشكل موحّد ---------------- */
  function messageList(items, kind) {
    if (!items || !items.length) return "";
    return `<div class="msg-list msg-${kind}" role="${kind === "error" ? "alert" : "status"}">
      <b>${kind === "error" ? "لا يمكن الحساب:" : "تنبيهات:"}</b>
      <ul>${items.map((m) => `<li>${esc(m)}</li>`).join("")}</ul></div>`;
  }

  /* ---------------- التهيئة ---------------- */
  function init() {
    applyTheme(readTheme());
    applyFontScale(readFontScale());
    renderChrome();
  }

  // نطبّق السمة فورًا قبل الرسم لتفادي وميض المظهر الخاطئ
  applyTheme(readTheme());
  applyFontScale(readFontScale());

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return {
    esc, toast, dialog, confirm, alert, messageList,
    applyTheme, readTheme, cycleTheme, THEMES, applyFontScale, readFontScale,
    TOOLS, NAV, renderChrome, openToolSheet, pagePath, base,
    toCSV, copyText, saveTextFile, exportBar, stamp,
  };
})();

/* توافق مع النداءات القديمة داخل الصفحات */
function showToast(text) { UI.toast(text); }

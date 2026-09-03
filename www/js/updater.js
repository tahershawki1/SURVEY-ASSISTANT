/* نظام التحديث التلقائي (OTA)
   يقرأ updates/manifest.json من المستودع المثبّت في الكود (Store.UPDATE_SOURCE)،
   ويقارن رقم الإصدار، فإن وجد أحدث نزّله عبر @capgo/capacitor-updater.
   ملاحظتان أمنيتان مقصودتان:
   1) المصدر غير قابل للتعديل من الواجهة.
   2) بصمة SHA-256 إلزامية — أي manifest بلا checksum يُرفض. */

const Updater = (() => {
  const PENDING_KEY = "masaha_pending_bundle";
  const VERSION_RE = /^\d+(\.\d+){0,3}$/;

  function cmpVersions(a, b) {
    const pa = String(a).split(".").map((n) => parseInt(n, 10) || 0);
    const pb = String(b).split(".").map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const x = pa[i] || 0, y = pb[i] || 0;
      if (x > y) return 1;
      if (x < y) return -1;
    }
    return 0;
  }

  /* التحديث المنزَّل يُحفَظ في التخزين حتى لا يضيع عند الانتقال بين الصفحات */
  function readPending() {
    try {
      const raw = localStorage.getItem(PENDING_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }
  function writePending(v) {
    try {
      if (v) localStorage.setItem(PENDING_KEY, JSON.stringify(v));
      else localStorage.removeItem(PENDING_KEY);
    } catch (e) { /* تجاهل */ }
  }

  /* يتحقق أن الرابط يشير فعلًا إلى المستودع المثبّت — لا إلى أي مضيف آخر */
  function isTrustedBundleUrl(url) {
    try {
      const u = new URL(url);
      const { githubOwner, githubRepo } = Store.UPDATE_SOURCE;
      if (u.protocol !== "https:") return false;
      const okHost =
        (u.hostname === "raw.githubusercontent.com" &&
          u.pathname.startsWith(`/${githubOwner}/${githubRepo}/`)) ||
        (u.hostname === "github.com" &&
          u.pathname.startsWith(`/${githubOwner}/${githubRepo}/`));
      return okHost;
    } catch (e) { return false; }
  }

  function validateManifest(m) {
    const errors = [];
    if (!m || typeof m !== "object") { errors.push("ملف التحديث غير صالح."); return errors; }
    if (typeof m.version !== "string" || !VERSION_RE.test(m.version)) errors.push("رقم الإصدار في ملف التحديث غير صالح.");
    if (typeof m.url !== "string" || !isTrustedBundleUrl(m.url)) errors.push("رابط حزمة التحديث لا يشير إلى مستودع التطبيق الرسمي — رُفض التحديث.");
    if (typeof m.checksum !== "string" || !/^[a-f0-9]{64}$/i.test(m.checksum)) errors.push("بصمة التحقق (SHA-256) مفقودة أو غير صالحة — رُفض التحديث.");
    return errors;
  }

  async function notifyLocal(title, body) {
    try {
      if (!(window.Native && window.Native.LocalNotifications)) return;
      const perm = await window.Native.LocalNotifications.checkPermissions();
      if (perm.display !== "granted") {
        const asked = await window.Native.LocalNotifications.requestPermissions();
        if (asked.display !== "granted") return;
      }
      await window.Native.LocalNotifications.schedule({
        notifications: [{
          id: Math.floor(Date.now() / 1000) % 2147483647,
          title, body,
          schedule: { at: new Date(Date.now() + 300) },
          smallIcon: "ic_stat_update",
        }],
      });
    } catch (e) {
      console.warn("local notification failed", e);
    }
  }

  async function checkForUpdate({ silent = false } = {}) {
    const settings = await Store.getSettings();
    const url = Store.manifestUrl();

    let manifest;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch (e) {
      const offline = typeof navigator !== "undefined" && navigator.onLine === false;
      const msg = offline ? "لا يوجد اتصال بالإنترنت" : (e.name === "AbortError" ? "انتهت مهلة الاتصال" : e.message);
      console.warn("update check failed:", msg);
      await Store.saveSettings({ lastCheck: new Date().toISOString() });
      return { status: "error", error: msg, offline };
    }

    await Store.saveSettings({ lastCheck: new Date().toISOString() });

    const invalid = validateManifest(manifest);
    if (invalid.length) {
      console.warn("manifest rejected:", invalid);
      return { status: "error", error: invalid[0] };
    }

    if (cmpVersions(manifest.version, settings.currentVersion) <= 0) {
      return { status: "up-to-date", version: settings.currentVersion };
    }

    const pending = readPending();
    if (pending && pending.version === manifest.version) {
      return { status: "downloaded", version: manifest.version, alreadyPending: true };
    }

    // إشعار واحد لكل إصدار — لا يتكرر مع كل فحص دوري
    await Store.addNotification({
      icon: "⬆️",
      title: `تحديث جديد متاح — الإصدار ${manifest.version}`,
      message: manifest.notes || "جارٍ تنزيل التحديث في الخلفية...",
      dedupeKey: `ota:${manifest.version}`,
    });
    if (!silent && settings.lastNotifiedOtaVersion !== manifest.version) {
      await notifyLocal("تحديث جديد متاح", `الإصدار ${manifest.version}`);
      await Store.saveSettings({ lastNotifiedOtaVersion: manifest.version });
    }
    refreshBadge();

    if (!(window.Native && window.Native.CapacitorUpdater)) {
      await Store.addNotification({
        icon: "⚠️",
        title: "التنزيل التلقائي غير متاح",
        message: `الإصدار ${manifest.version} متاح، لكن نظام التحديث غير مفعّل في هذه النسخة المثبّتة. ثبّت أحدث نسخة من التطبيق يدويًا.`,
        dedupeKey: `ota-nonative:${manifest.version}`,
      });
      refreshBadge();
      return { status: "available-no-native", version: manifest.version };
    }

    try {
      const bundle = await window.Native.CapacitorUpdater.download({
        version: manifest.version,
        url: manifest.url,
        checksum: manifest.checksum, // إلزامية
      });

      // نُفعّل الحزمة عند بدء التشغيل التالي بدل إعادة التحميل فوق عمل جارٍ
      let armed = false;
      try {
        if (typeof window.Native.CapacitorUpdater.next === "function") {
          await window.Native.CapacitorUpdater.next({ id: bundle.id });
          armed = true;
        }
      } catch (e) {
        console.warn("could not arm next bundle", e);
      }

      writePending({ id: bundle.id, version: manifest.version, notes: manifest.notes || "", armed });

      await Store.addNotification({
        icon: "✅",
        title: "اكتمل تنزيل التحديث",
        message: armed
          ? `سيُفعَّل الإصدار ${manifest.version} تلقائيًا عند فتح التطبيق في المرة القادمة. يمكنك تثبيته الآن من صفحة الإعدادات.`
          : `الإصدار ${manifest.version} جاهز للتثبيت من صفحة الإعدادات.`,
        dedupeKey: `ota-ready:${manifest.version}`,
      });
      await notifyLocal("التحديث جاهز", `الإصدار ${manifest.version} سيُفعَّل عند التشغيل التالي.`);
      refreshBadge();
      return { status: "downloaded", version: manifest.version };
    } catch (e) {
      console.warn("download failed", e);
      await Store.addNotification({
        icon: "⚠️",
        title: "تعذّر تنزيل التحديث",
        message: String(e && e.message ? e.message : e),
        dedupeKey: `ota-fail:${manifest.version}`,
      });
      refreshBadge();
      return { status: "download-error", error: e.message };
    }
  }

  /* التثبيت الفوري — لا يُستدعى إلا بطلب صريح من المستخدم، لأنه يعيد تحميل التطبيق */
  async function applyNow() {
    const pending = readPending();
    if (!pending) return false;
    if (!(window.Native && window.Native.CapacitorUpdater)) return false;
    await window.Native.CapacitorUpdater.set({ id: pending.id });
    await Store.saveSettings({ currentVersion: pending.version });
    writePending(null);
    return true;
  }

  async function refreshBadge() {
    const count = await Store.unreadCount();
    document.querySelectorAll("[data-notif-badge]").forEach((el) => {
      if (count > 0) {
        el.textContent = count > 99 ? "99+" : String(count);
        el.classList.remove("hidden");
        el.setAttribute("aria-hidden", "false");
        el.setAttribute("aria-label", `${count} إشعار غير مقروء`);
      } else {
        el.classList.add("hidden");
        el.setAttribute("aria-hidden", "true");
      }
    });
  }

  /* عند بدء التشغيل: إن كانت الحزمة المفعّلة هي المنتظرة، نثبّت رقم الإصدار ونؤكد نجاحها */
  async function initLifecycleHooks() {
    if (!(window.Native && window.Native.CapacitorUpdater)) return;
    try {
      await window.Native.CapacitorUpdater.notifyAppReady();
    } catch (e) { /* تجاهل */ }
    try {
      const pending = readPending();
      if (!pending) return;
      const cur = await window.Native.CapacitorUpdater.current();
      const v = cur && cur.bundle ? cur.bundle.version : null;
      if (v && cmpVersions(v, pending.version) >= 0) {
        await Store.saveSettings({ currentVersion: pending.version });
        writePending(null);
        await Store.addNotification({
          icon: "🎉",
          title: `تم تفعيل الإصدار ${pending.version}`,
          message: pending.notes || "تحسينات وإصلاحات.",
          dedupeKey: `ota-active:${pending.version}`,
        });
        refreshBadge();
      }
    } catch (e) {
      console.warn("bundle state check failed", e);
    }
  }

  return {
    checkForUpdate, applyNow, initLifecycleHooks, refreshBadge, cmpVersions,
    validateManifest, isTrustedBundleUrl,
    getPending: readPending,
  };
})();

/* نظام التحديث التلقائي (OTA)
   الفكرة: بعد كل Push على GitHub، يقوم GitHub Actions ببناء الملفات ونشر
   updates/manifest.json + حزمة zip داخل نفس المستودع (راجع .github/workflows/publish-update.yml).
   التطبيق يتحقق من هذا الملف دوريًا عبر GET (raw.githubusercontent.com) ويقارن
   رقم الإصدار، فإن وجد أحدث: ينزّل الحزمة عبر @capgo/capacitor-updater
   ويطبّقها تلقائيًا، مع تنبيه المستخدم عبر مركز الإشعارات + إشعار محلي. */

const Updater = (() => {
  let pendingApply = null; // بيانات التحديث الذي تم تنزيله بانتظار التطبيق

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

  async function notifyLocal(title, body) {
    try {
      if (window.Native && window.Native.LocalNotifications) {
        const perm = await window.Native.LocalNotifications.checkPermissions();
        if (perm.display !== "granted") {
          await window.Native.LocalNotifications.requestPermissions();
        }
        await window.Native.LocalNotifications.schedule({
          notifications: [
            {
              id: Math.floor(Date.now() / 1000) % 2147483647,
              title,
              body,
              schedule: { at: new Date(Date.now() + 300) },
              smallIcon: "ic_stat_update",
            },
          ],
        });
      }
    } catch (e) {
      console.warn("local notification failed", e);
    }
  }

  async function checkForUpdate({ silent = false } = {}) {
    const settings = await Store.getSettings();
    const url = await Store.manifestUrl();

    let manifest;
    try {
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch (e) {
      console.warn("update check failed:", e.message);
      await Store.saveSettings({ lastCheck: new Date().toISOString() });
      return { status: "error", error: e.message };
    }

    await Store.saveSettings({ lastCheck: new Date().toISOString() });

    if (!manifest || !manifest.version) {
      return { status: "error", error: "manifest غير صالح" };
    }

    if (cmpVersions(manifest.version, settings.currentVersion) <= 0) {
      return { status: "up-to-date", version: settings.currentVersion };
    }

    // يوجد إصدار أحدث
    await Store.addNotification({
      icon: "⬆️",
      title: `تحديث جديد متاح — الإصدار ${manifest.version}`,
      message: manifest.notes || "جاري تنزيل التحديث تلقائيًا في الخلفية...",
    });
    if (!silent) await notifyLocal("تحديث جديد متاح", `الإصدار ${manifest.version} — ${manifest.notes || "تحسينات وإصلاحات"}`);
    refreshBadge();

    if (window.Native && window.Native.CapacitorUpdater && manifest.url) {
      try {
        const downloadOpts = { version: manifest.version, url: manifest.url };
        if (manifest.checksum) downloadOpts.checksum = manifest.checksum;
        const bundle = await window.Native.CapacitorUpdater.download(downloadOpts);
        pendingApply = { bundle, manifest };
        await Store.saveSettings({ pendingUpdate: pendingApply });

        await Store.addNotification({
          icon: "✅",
          title: "اكتمل تنزيل التحديث",
          message: `سيتم تفعيل الإصدار ${manifest.version} تلقائيًا عند إغلاق التطبيق أو إعادة فتحه.`,
        });
        await notifyLocal("التحديث جاهز", `سيتم تفعيل الإصدار ${manifest.version} تلقائيًا.`);
        refreshBadge();
        return { status: "downloaded", version: manifest.version };
      } catch (e) {
        console.warn("download failed", e);
        await Store.addNotification({
          icon: "⚠️",
          title: "تعذّر تنزيل التحديث",
          message: String(e.message || e),
        });
        refreshBadge();
        return { status: "download-error", error: e.message };
      }
    }

    await Store.addNotification({
      icon: "⚠️",
      title: "تعذّر التنزيل التلقائي",
      message: `الإصدار ${manifest.version} متاح لكن لم يتمكن التطبيق من تنزيله تلقائيًا (نظام التحديث غير متاح في هذه النسخة المثبتة). ثبّت أحدث نسخة APK يدويًا لتفعيل الإصدار الجديد.`,
    });
    refreshBadge();
    return { status: "available-no-native", version: manifest.version };
  }

  /* تثبيت التحديث المنزّل. يرمي خطأ عند الفشل حتى لا يُغلق الموديل بصمت
     دون تثبيت أي شيء (كان هذا سبب اختفاء رسالة التحديث بلا نتيجة). */
  async function applyPendingIfAny({ silentFail = true } = {}) {
    const CU = window.Native && window.Native.CapacitorUpdater;
    if (!CU) {
      if (silentFail) return false;
      throw new Error("نظام التحديث غير متاح في هذه النسخة المثبتة من التطبيق");
    }
    const pending = pendingApply || (await loadPendingFromStore());
    if (!pending) {
      if (silentFail) return false;
      throw new Error("لا يوجد تحديث منزّل جاهز للتثبيت");
    }
    try {
      const id = pending.bundle && (pending.bundle.id || pending.bundle.version);
      if (!id) throw new Error("معرّف الحزمة المنزّلة غير صالح");
      await CU.set({ id });
      await Store.saveSettings({
        currentVersion: pending.manifest.version,
        pendingUpdate: null,
      });
      pendingApply = null;
      // set() يعيد تحميل التطبيق تلقائيًا؛ نضع احتياطًا في حال لم يحدث ذلك.
      setTimeout(() => {
        try { CU.reload(); } catch (e) { location.reload(); }
      }, 1500);
      return true;
    } catch (e) {
      console.warn("apply update failed", e);
      await Store.addNotification({
        icon: "⚠️",
        title: "تعذّر تثبيت التحديث",
        message: String(e.message || e),
      });
      refreshBadge();
      if (silentFail) return false;
      throw e;
    }
  }

  /* التحديث المنزّل محفوظ أيضًا في الإعدادات حتى لا يضيع عند إعادة تحميل الصفحة. */
  async function loadPendingFromStore() {
    try {
      const s = await Store.getSettings();
      if (s.pendingUpdate && s.pendingUpdate.bundle && s.pendingUpdate.manifest) {
        if (cmpVersions(s.pendingUpdate.manifest.version, s.currentVersion) > 0) {
          pendingApply = s.pendingUpdate;
          return pendingApply;
        }
        await Store.saveSettings({ pendingUpdate: null });
      }
    } catch (e) {
      console.warn("load pending failed", e);
    }
    return null;
  }

  async function refreshBadge() {
    const count = await Store.unreadCount();
    document.querySelectorAll("[data-notif-badge]").forEach((el) => {
      if (count > 0) {
        el.textContent = count > 99 ? "99+" : String(count);
        el.classList.remove("hidden");
      } else {
        el.classList.add("hidden");
      }
    });
  }

  function initLifecycleHooks() {
    // نطبّق التحديث عند مغادرة المستخدم للتطبيق حتى لا نقاطع جلسة عمل ميدانية جارية
    if (window.Native && window.Native.CapApp) {
      window.Native.CapApp.addListener("appStateChange", ({ isActive }) => {
        if (!isActive) applyPendingIfAny();
      });
    }
    // تأكيد أن التحديث الحالي يعمل بنجاح (يمنع الرجوع التلقائي للإصدار السابق)
    if (window.Native && window.Native.CapacitorUpdater) {
      window.Native.CapacitorUpdater.notifyAppReady().catch(() => {});
    }
  }

  return {
    checkForUpdate,
    applyPendingIfAny,
    loadPendingFromStore,
    initLifecycleHooks,
    refreshBadge,
    cmpVersions,
    getPendingApply: () => pendingApply,
    hasNativeUpdater: () => !!(window.Native && window.Native.CapacitorUpdater),
  };
})();

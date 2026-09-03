/* فحص تحديثات نسخة التطبيق الأصلية (APK) بشكل منفصل عن تحديثات الواجهة (OTA).
   يقارن versionCode المثبّت فعليًا (عبر @capacitor/app) مع updates/native-manifest.json. */

const NativeUpdater = (() => {
  async function getLocalInfo() {
    if (!(window.Native && window.Native.CapApp)) return null;
    try {
      const info = await window.Native.CapApp.getInfo();
      const versionCode = parseInt(info.build, 10);
      if (!Number.isFinite(versionCode)) return null;
      return { versionCode, versionName: info.version };
    } catch (e) { return null; }
  }

  function validate(m) {
    const errors = [];
    if (!m || typeof m !== "object") { errors.push("ملف النسخة الأصلية غير صالح."); return errors; }
    if (!Number.isInteger(m.versionCode)) errors.push("رقم البناء غير صالح.");
    if (typeof m.apkUrl !== "string") { errors.push("رابط التنزيل مفقود."); return errors; }
    try {
      const u = new URL(m.apkUrl);
      const { githubOwner, githubRepo } = Store.UPDATE_SOURCE;
      if (u.protocol !== "https:" || u.hostname !== "github.com" || !u.pathname.startsWith(`/${githubOwner}/${githubRepo}/releases/`)) {
        errors.push("رابط التنزيل لا يشير إلى إصدارات المستودع الرسمي — رُفض.");
      }
    } catch (e) { errors.push("رابط التنزيل غير صالح."); }
    return errors;
  }

  async function checkForNativeUpdate() {
    const local = await getLocalInfo();
    if (!local) return { status: "unavailable" };

    let manifest;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(`${Store.nativeManifestUrl()}?t=${Date.now()}`, { cache: "no-store", signal: ctrl.signal });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch (e) {
      return { status: "error", error: e.name === "AbortError" ? "انتهت مهلة الاتصال" : e.message };
    }

    const errors = validate(manifest);
    if (errors.length) return { status: "error", error: errors[0] };

    if (manifest.versionCode <= local.versionCode) return { status: "up-to-date", local, manifest };

    return { status: "available", local, manifest, signed: manifest.signed === true };
  }

  return { checkForNativeUpdate, getLocalInfo, validate };
})();

/* فحص تحديثات نسخة التطبيق الأصلية (APK) بشكل منفصل عن تحديثات الواجهة (OTA).
   يقارن versionCode المثبت فعليًا على الجهاز (عبر @capacitor/app) مع
   updates/native-manifest.json الذي ينشره workflow بناء الأندرويد بعد كل بناء ناجح. */

const NativeUpdater = (() => {
  async function manifestUrl() {
    const s = await Store.getSettings();
    return `https://raw.githubusercontent.com/${s.githubOwner}/${s.githubRepo}/${s.branch}/updates/native-manifest.json`;
  }

  async function getLocalInfo() {
    if (!window.Native || !window.Native.CapApp) return null;
    const info = await window.Native.CapApp.getInfo();
    const versionCode = parseInt(info.build, 10);
    if (isNaN(versionCode)) return null;
    return { versionCode, versionName: info.version };
  }

  async function checkForNativeUpdate() {
    const local = await getLocalInfo();
    if (!local) return { status: "unavailable" };

    let manifest;
    try {
      const url = await manifestUrl();
      const res = await fetch(`${url}?t=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      manifest = await res.json();
    } catch (e) {
      return { status: "error", error: e.message };
    }

    if (!manifest || typeof manifest.versionCode !== "number") {
      return { status: "error", error: "native-manifest.json غير صالح" };
    }

    if (manifest.versionCode <= local.versionCode) {
      return { status: "up-to-date", local, manifest };
    }

    return { status: "available", local, manifest };
  }

  return { checkForNativeUpdate, getLocalInfo };
})();

/* تهيئة عامة لكل صفحة: زر الرجوع الأصلي، فحص التحديثات، وحالة الاتصال */

/* موديل التحديث — يعتمد على UI.dialog، وكل النصوص القادمة من الشبكة تُهرَّب */
function showUpdateModal({ icon = "⬆️", title, message, primaryLabel, onPrimary, secondaryLabel = "لاحقًا" }) {
  return UI.dialog({ icon, title, message, confirmLabel: primaryLabel, cancelLabel: secondaryLabel, onConfirm: onPrimary });
}

/* يفحص تحديث الواجهة (OTA) وتحديث النسخة الأصلية (APK) ويعرض ما هو متاح */
async function promptAvailableUpdates({ manual = false } = {}) {
  const otaResult = await Updater.checkForUpdate({ silent: !manual });

  const pending = Updater.getPending();
  if (pending) {
    await showUpdateModal({
      icon: "⬆️",
      title: `تحديث الواجهة جاهز — الإصدار ${pending.version}`,
      message:
        (pending.notes ? pending.notes + "\n\n" : "") +
        (pending.armed
          ? "سيُفعَّل تلقائيًا عند فتح التطبيق في المرة القادمة. التثبيت الآن يعيد تحميل التطبيق فورًا — احفظ أي عمل جارٍ أولًا."
          : "التثبيت الآن يعيد تحميل التطبيق فورًا — احفظ أي عمل جارٍ أولًا."),
      primaryLabel: "تثبيت الآن",
      secondaryLabel: pending.armed ? "لاحقًا (تلقائيًا)" : "لاحقًا",
      onPrimary: async () => {
        const ok = await Updater.applyNow();
        if (ok) location.reload();
        else UI.toast("تعذّر التثبيت — أعد المحاولة لاحقًا", "error");
      },
    });
  }

  let nativeResult = { status: "unavailable" };
  if (typeof NativeUpdater !== "undefined") {
    nativeResult = await NativeUpdater.checkForNativeUpdate();
    if (nativeResult.status === "available") {
      const m = nativeResult.manifest;
      const settings = await Store.getSettings();
      const alreadyTold = settings.lastNotifiedNativeCode === m.versionCode;

      if (manual || !alreadyTold) {
        await Store.saveSettings({ lastNotifiedNativeCode: m.versionCode });
        await showUpdateModal({
          icon: nativeResult.signed ? "📦" : "⚠️",
          title: `تتوفر نسخة تطبيق جديدة — ${m.versionName}`,
          message:
            (m.notes || "يحتوي هذا التحديث على تغييرات في مكونات التطبيق الأساسية، لذا يجب تثبيت نسخة جديدة يدويًا.") +
            (nativeResult.signed
              ? "\n\nهذه نسخة موقّعة رسميًا."
              : "\n\n⚠️ تنبيه: هذه نسخة تجريبية (Debug) غير موقّعة — لا يمكن التحقق من مصدرها، وتُنصح بعدم تثبيتها إلا للتجربة."),
          primaryLabel: nativeResult.signed ? "تنزيل وتثبيت" : "تنزيل رغم التحذير",
          onPrimary: async () => {
            if (window.Native && window.Native.CapApp) window.open(m.apkUrl, "_system");
            else window.open(m.apkUrl, "_blank", "noopener");
          },
        });
      }
    }
  }

  return { otaResult, nativeResult };
}

async function maybeAutoPromptUpdates() {
  const s = await Store.getSettings();
  if (!s.autoCheck) return;
  const last = s.lastCheck ? new Date(s.lastCheck).getTime() : 0;
  const intervalMs = s.checkIntervalHours * 3600 * 1000;
  if (Date.now() - last < intervalMs) return;
  await promptAvailableUpdates({ manual: false });
}

/* زر الرجوع الأصلي في أندرويد: يعود للصفحة السابقة بدل الخروج من التطبيق */
function initBackButton() {
  if (!(window.Native && window.Native.CapApp)) return;
  window.Native.CapApp.addListener("backButton", async ({ canGoBack }) => {
    // إن كان هناك حوار مفتوح، أغلقه أولًا
    const overlay = document.querySelector(".modal-overlay");
    if (overlay) {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
      return;
    }
    const isRoot = document.body.dataset.root === "true";
    if (!isRoot) {
      if (canGoBack && history.length > 1) history.back();
      else location.href = "../index.html";
      return;
    }
    const leave = await UI.dialog({
      icon: "🚪", title: "إغلاق التطبيق؟",
      message: "هل تريد الخروج من مساعد المساحة؟",
      confirmLabel: "خروج", cancelLabel: "بقاء",
    });
    if (leave) window.Native.CapApp.exitApp();
  });
}

/* مؤشر حالة الاتصال — انقطاع الشبكة هو الحالة الطبيعية في الموقع */
function initNetworkBanner() {
  const render = () => {
    let bar = document.getElementById("offlineBar");
    if (navigator.onLine === false) {
      if (!bar) {
        bar = document.createElement("div");
        bar.id = "offlineBar";
        bar.className = "offline-bar";
        bar.setAttribute("role", "status");
        bar.textContent = "لا يوجد اتصال — كل الأدوات الحسابية تعمل دون إنترنت، وفحص التحديثات معطّل مؤقتًا.";
        document.body.appendChild(bar);
      }
    } else if (bar) {
      bar.remove();
    }
  };
  window.addEventListener("online", render);
  window.addEventListener("offline", render);
  render();
}

/* تسجيل عامل الخدمة: يجعل التطبيق يعمل دون اتصال (وهي الحالة الطبيعية في الموقع) */
function initServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "localhost" && location.hostname !== "127.0.0.1") return;
  const root = document.body.dataset.root === "true" ? "./" : "../";
  navigator.serviceWorker.register(root + "sw.js", { scope: root }).catch((e) => console.warn("sw register failed", e));
}

async function bootApp() {
  initServiceWorker();
  initNetworkBanner();
  await Updater.refreshBadge();

  const start = async () => {
    initBackButton();
    await Updater.initLifecycleHooks();
    await Updater.refreshBadge();
    if (navigator.onLine !== false) maybeAutoPromptUpdates();
  };

  if (window.Native) start();
  else window.addEventListener("native-ready", start, { once: true });
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootApp);
else bootApp();

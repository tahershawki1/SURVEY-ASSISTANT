/* تهيئة عامة لكل صفحة: الشريط السفلي، مركز الإشعارات، فحص التحديثات */

function highlightActiveNav() {
  const file = location.pathname.split("/").pop() || "index.html";
  document.querySelectorAll(".bottom-nav a").forEach((a) => {
    const href = a.getAttribute("href").split("/").pop();
    a.classList.toggle("active", href === file);
  });
}

function showToast(text) {
  const el = document.createElement("div");
  el.className = "toast";
  el.innerHTML = `<span>ℹ️</span><span>${text}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

/* يعرض موديل ويُرجع Promise يُحل عند إغلاقه (سواء بالإجراء الرئيسي أو "لاحقًا")،
   حتى يمكن عرض عدة موديلات (واجهة ثم APK) بالتتابع دون أن يمحو أحدها الآخر. */
function showUpdateModal({ icon = "⬆️", title, message, primaryLabel, onPrimary, secondaryLabel = "لاحقًا" }) {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "modal-overlay";
    overlay.innerHTML = `
      <div class="modal-box">
        <div class="modal-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${message}</p>
        <div class="modal-actions">
          <button class="btn secondary" data-secondary>${secondaryLabel}</button>
          <button class="btn" data-primary>${primaryLabel}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector("[data-secondary]").onclick = () => {
      overlay.remove();
      resolve();
    };
    overlay.querySelector("[data-primary]").onclick = async () => {
      const btn = overlay.querySelector("[data-primary]");
      btn.disabled = true;
      btn.textContent = "جارٍ التنفيذ...";
      try {
        await onPrimary();
        overlay.remove();
        resolve();
      } catch (e) {
        btn.disabled = false;
        btn.textContent = primaryLabel;
        showToast("تعذّر التنفيذ: " + (e.message || e));
      }
    };
  });
}

/* يفحص تحديث الواجهة (OTA) وتحديث نسخة التطبيق الأصلية (APK) معًا،
   ويعرض موديل تنزيل/تثبيت فعّال لكل واحد منهما إن وُجد. */
async function promptAvailableUpdates({ manual = false } = {}) {
  const otaResult = await Updater.checkForUpdate({ silent: !manual });

  const pending = Updater.getPendingApply();
  if (pending) {
    await showUpdateModal({
      icon: "⬆️",
      title: `تحديث الواجهة جاهز — الإصدار ${pending.manifest.version}`,
      message: "تم تنزيل التحديث في الخلفية. يمكنك تثبيته الآن (سيُعاد تحميل التطبيق فورًا) أو تركه ليُفعَّل تلقائيًا عند إغلاق التطبيق لاحقًا.",
      primaryLabel: "تثبيت الآن",
      onPrimary: async () => {
        await Updater.applyPendingIfAny();
        location.reload();
      },
    });
  }

  let nativeResult = { status: "unavailable" };
  if (typeof NativeUpdater !== "undefined") {
    nativeResult = await NativeUpdater.checkForNativeUpdate();
    if (nativeResult.status === "available") {
      const apkUrl = nativeResult.manifest.apkUrl;
      await showUpdateModal({
        icon: "📦",
        title: `تتوفر نسخة تطبيق جديدة — ${nativeResult.manifest.versionName}`,
        message:
          nativeResult.manifest.notes ||
          "يحتوي هذا التحديث على تغييرات في مكونات التطبيق الأساسية، لذا يجب تثبيت نسخة APK جديدة يدويًا.",
        primaryLabel: "تنزيل وتثبيت",
        onPrimary: async () => {
          window.open(apkUrl, "_system");
        },
      });
    }
  }

  return { otaResult, nativeResult };
}

async function maybeAutoPromptUpdates() {
  const s = await Store.getSettings();
  if (!s.autoCheck) return;
  const last = s.lastCheck ? new Date(s.lastCheck).getTime() : 0;
  const intervalMs = (s.checkIntervalHours || 6) * 3600 * 1000;
  if (Date.now() - last < intervalMs) return;
  await promptAvailableUpdates({ manual: false });
}

async function bootApp() {
  highlightActiveNav();
  await Updater.refreshBadge();

  const start = () => {
    Updater.initLifecycleHooks();
    maybeAutoPromptUpdates();
  };

  if (window.Native) start();
  else window.addEventListener("native-ready", start, { once: true });
}

document.addEventListener("DOMContentLoaded", bootApp);

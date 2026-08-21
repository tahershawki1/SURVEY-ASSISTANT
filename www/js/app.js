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

async function bootApp() {
  highlightActiveNav();
  await Updater.refreshBadge();

  const start = () => {
    Updater.initLifecycleHooks();
    Updater.maybeAutoCheck();
  };

  if (window.Native) start();
  else window.addEventListener("native-ready", start, { once: true });
}

document.addEventListener("DOMContentLoaded", bootApp);

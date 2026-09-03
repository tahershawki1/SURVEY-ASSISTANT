/* مركز الإشعارات — كل محتوى قادم من الشبكة يُهرَّب قبل العرض */
(() => {
  const $ = (id) => document.getElementById(id);

  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return iso; }
  }

  async function render() {
    const notifs = await Store.getNotifications();
    const wrap = $("list");
    if (!notifs.length) {
      wrap.innerHTML = '<div class="empty-state"><div class="big" aria-hidden="true">🔔</div>لا توجد إشعارات حتى الآن<br/>ستظهر هنا تنبيهات التحديثات الجديدة</div>';
    } else {
      wrap.innerHTML = notifs.map((n) => `
        <div class="notif-item ${n.read ? "" : "unread"}">
          <span class="ic" aria-hidden="true">${UI.esc(n.icon)}</span>
          <div class="body">
            <div class="t">${UI.esc(n.title)}</div>
            <div class="m">${UI.esc(n.message)}</div>
            <div class="time">${UI.esc(fmtTime(n.time))}</div>
          </div>
        </div>`).join("");
    }
    await Store.markAllRead();
    await Updater.refreshBadge();
  }

  $("btnClear").onclick = async () => {
    const notifs = await Store.getNotifications();
    if (!notifs.length) return UI.toast("لا توجد إشعارات", "warn");
    const ok = await UI.confirm({ title: "مسح كل الإشعارات؟", message: `سيتم حذف ${notifs.length} إشعارًا نهائيًا.`, confirmLabel: "مسح الكل" });
    if (!ok) return;
    await Store.clearNotifications();
    await render();
    UI.toast("تم مسح الإشعارات", "success");
  };

  $("btnCheck").onclick = async () => {
    if (navigator.onLine === false) return UI.toast("لا يوجد اتصال بالإنترنت", "error");
    const btn = $("btnCheck");
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ الفحص...";
    try {
      const r = await Updater.checkForUpdate({ silent: false });
      if (r.status === "up-to-date") UI.toast("أنت تستخدم أحدث إصدار", "success");
      else if (r.status === "error") UI.toast("تعذّر الفحص: " + r.error, "error");
      else if (r.status === "downloaded") UI.toast(`تم تنزيل الإصدار ${r.version}`, "success");
      await render();
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  };

  render();
})();

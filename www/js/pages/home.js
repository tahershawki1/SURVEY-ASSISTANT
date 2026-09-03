/* الصفحة الرئيسية: شبكة الأدوات من مصدر واحد + استئناف آخر جلسة عمل */
(() => {
  const grid = document.getElementById("toolGrid");
  grid.innerHTML = UI.TOOLS.map((t) => `
    <a class="tool-card" href="pages/${UI.esc(t.href)}">
      <span class="emoji" aria-hidden="true">${t.icon}</span>
      <span class="name">${UI.esc(t.name)}</span>
      <span class="desc">${UI.esc(t.desc)}</span>
    </a>`).join("");

  const RESUMABLE = [
    { id: "area", label: "المساحات والمسافات", href: "pages/area.html", count: (s) => (s.points || []).length, unit: "نقطة" },
    { id: "leveling", label: "حسابات الميزانية", href: "pages/leveling.html", count: (s) => (s.rows || []).filter((r) => r.bs || r.is || r.fs).length, unit: "قراءة" },
    { id: "traverse", label: "تسوية المضلعات", href: "pages/traverse.html", count: (s) => (s.legs || []).filter((l) => l.distance > 0).length, unit: "ضلع" },
    { id: "levelcheck", label: "التحقق من المناسيب", href: "pages/levelcheck.html", count: (s) => (s.readings || []).length, unit: "قراءة" },
  ];

  function ago(iso) {
    if (!iso) return "";
    const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return "الآن";
    if (mins < 60) return `منذ ${mins} دقيقة`;
    const h = Math.round(mins / 60);
    if (h < 24) return `منذ ${h} ساعة`;
    return `منذ ${Math.round(h / 24)} يوم`;
  }

  (async () => {
    const wrap = document.getElementById("resume");
    const found = [];
    for (const r of RESUMABLE) {
      const s = await Store.getToolState(r.id);
      if (!s) continue;
      const n = r.count(s);
      if (n > 0) found.push({ ...r, n, savedAt: s.savedAt });
    }
    if (!found.length) {
      wrap.innerHTML = '<div class="empty-state" style="padding:26px"><div class="big" aria-hidden="true">🗂️</div>لا توجد جلسة محفوظة — يُحفظ عملك في كل أداة تلقائيًا.</div>';
      return;
    }
    wrap.innerHTML = found.map((f) => `
      <a class="notif-item" href="${UI.esc(f.href)}">
        <span class="ic" aria-hidden="true">↩️</span>
        <span class="body">
          <span class="t">${UI.esc(f.label)}</span>
          <span class="m">${f.n} ${UI.esc(f.unit)} محفوظة</span>
          <span class="time">${UI.esc(ago(f.savedAt))}</span>
        </span>
      </a>`).join("");
  })();
})();

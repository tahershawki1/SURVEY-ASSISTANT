/* المساحات والمسافات: نقاط قابلة للتعديل وإعادة الترتيب، معاينة رسم، حفظ تلقائي */
(() => {
  const $ = (id) => document.getElementById(id);
  const TOOL = "area";
  let points = [];
  let editIndex = -1;
  const saver = Store.autosaver(TOOL, () => ({ points }));

  /* ---------- المعاينة الرسومية: ترتيب النقاط الخاطئ يُرى بدل أن يظهر كمساحة صفر ---------- */
  function drawPreview(analysis) {
    const svg = $("preview");
    if (points.length < 2) {
      svg.innerHTML = `<text x="150" y="105" text-anchor="middle" class="vtx-label">أضف نقطتين على الأقل لعرض الشكل</text>`;
      return;
    }
    const W = 300, H = 210, pad = 22;
    const xs = points.map((p) => p.x), ys = points.map((p) => p.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const spanX = maxX - minX || 1, spanY = maxY - minY || 1;
    const s = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const ox = (W - spanX * s) / 2, oy = (H - spanY * s) / 2;
    // ننعكس على المحور Y لأن Northing يزيد لأعلى بينما y في SVG يزيد لأسفل
    const px = (p) => ox + (p.x - minX) * s;
    const py = (p) => H - (oy + (p.y - minY) * s);

    const pts = points.map((p) => `${px(p).toFixed(1)},${py(p).toFixed(1)}`).join(" ");
    const bad = analysis && analysis.selfIntersections && analysis.selfIntersections.length > 0;
    const closed = points.length >= 3;

    svg.innerHTML =
      (closed && !bad ? `<polygon class="poly-fill" points="${pts}" />` : "") +
      (closed ? `<polygon class="poly-line${bad ? " bad" : ""}" points="${pts}" />`
              : `<polyline class="poly-line" points="${pts}" />`) +
      points.map((p, i) =>
        `<circle class="vtx" cx="${px(p).toFixed(1)}" cy="${py(p).toFixed(1)}" r="3.5" />` +
        `<text class="vtx-label" x="${(px(p) + 6).toFixed(1)}" y="${(py(p) - 5).toFixed(1)}">${i + 1}</text>`
      ).join("");
  }

  function renderPoints() {
    const list = $("ptList");
    $("ptCount").textContent = points.length;
    if (points.length === 0) {
      list.innerHTML = '<div class="empty-state" style="padding:20px"><div class="big" aria-hidden="true">📍</div>لا توجد نقاط بعد</div>';
      return;
    }
    list.innerHTML = points.map((p, i) => `
      <div class="point-item${i === editIndex ? " editing" : ""}">
        <span class="idx">${i + 1}</span>
        <span class="coords">X: <b>${p.x.toFixed(3)}</b> &nbsp; Y: <b>${p.y.toFixed(3)}</b></span>
        <span class="acts">
          <button type="button" data-up="${i}" aria-label="تحريك النقطة ${i + 1} لأعلى" ${i === 0 ? "disabled" : ""}>▲</button>
          <button type="button" data-down="${i}" aria-label="تحريك النقطة ${i + 1} لأسفل" ${i === points.length - 1 ? "disabled" : ""}>▼</button>
          <button type="button" data-edit="${i}" aria-label="تعديل النقطة ${i + 1}">✎</button>
          <button type="button" class="del" data-del="${i}" aria-label="حذف النقطة ${i + 1}">✕</button>
        </span>
      </div>`).join("");
  }

  function compute() {
    const msgs = $("messages"), head = $("headline"), box = $("result"), bar = $("exportBar");
    if (points.length < 2) {
      drawPreview(null);
      msgs.innerHTML = ""; head.innerHTML = "";
      box.className = "result-box empty";
      box.textContent = "أضف نقطتين على الأقل";
      bar.hidden = true;
      return;
    }

    const a = AreaCalc.analyze(points);
    drawPreview(a);
    msgs.innerHTML = UI.messageList(a.errors, "error") + UI.messageList(a.warnings, "warn");

    if (!a.ok) {
      head.innerHTML = "";
      box.className = "result-box empty";
      box.textContent = "صحّح ترتيب النقاط لعرض المساحة";
      bar.hidden = true;
      return;
    }

    const rows = [];
    if (a.area !== null && a.area !== undefined) {
      const fq = AreaCalc.formatFeddan(a.area);
      head.innerHTML = `<div class="headline ok">
        <span class="k">المساحة<span class="sub">${UI.esc(fq.text)} · ${a.units.hectare.toFixed(4)} هكتار</span></span>
        <span class="v">${a.area.toFixed(2)}<span class="sub">متر مربع</span></span></div>`;
      rows.push(["المساحة", `${a.area.toFixed(3)} m²`]);
      rows.push(["بالنظام المصري", fq.text]);
      rows.push(["فدان (عشري)", a.units.feddan.toFixed(4)]);
      rows.push(["هكتار", a.units.hectare.toFixed(4)]);
      rows.push(["فدّان أمريكي (acre)", a.units.acre.toFixed(4)]);
      rows.push(["المحيط (مغلق)", `${a.closedPerimeter.toFixed(3)} m`]);
      rows.push(["اتجاه الترقيم", a.orientation]);
    } else {
      head.innerHTML = `<div class="headline">
        <span class="k">طول المسار<span class="sub">${points.length} نقطة — أضف ثالثة لحساب المساحة</span></span>
        <span class="v">${a.openPerimeter.toFixed(2)}<span class="sub">متر</span></span></div>`;
    }
    rows.push(["طول المسار (مفتوح)", `${a.openPerimeter.toFixed(3)} m`]);
    if (a.lastLeg) {
      rows.push(["المسافة بين آخر نقطتين", `${a.lastLeg.distance.toFixed(3)} m`]);
      rows.push(["الأزيموث بين آخر نقطتين", a.lastLeg.azimuth === null ? "غير معرّف (نقطتان متطابقتان)" : `${a.lastLeg.azimuth.toFixed(4)}°`]);
    }

    box.className = "result-box";
    box.innerHTML = rows.map(([k, v]) => `<div class="row"><span>${UI.esc(k)}</span><b>${UI.esc(v)}</b></div>`).join("");

    bar.hidden = false;
    UI.exportBar(bar, {
      filename: () => `area_${UI.stamp()}.csv`,
      rows: () => [["Point", "Easting", "Northing"]]
        .concat(points.map((p, i) => [i + 1, p.x.toFixed(3), p.y.toFixed(3)]))
        .concat([[], ["Result", "Value"]], rows.map(([k, v]) => [k, v])),
      text: () => rows.map(([k, v]) => `${k}: ${v}`).join("\n"),
    });
  }

  function refresh() { renderPoints(); compute(); saver.save(); }

  function readInputs() {
    const x = parseFloat($("ptX").value);
    const y = parseFloat($("ptY").value);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      UI.toast("أدخل إحداثيتين رقميتين صحيحتين", "error");
      return null;
    }
    return { x, y };
  }

  function clearForm() {
    $("ptX").value = ""; $("ptY").value = "";
    editIndex = -1;
    $("btnAdd").textContent = "+ إضافة نقطة";
    $("btnCancelEdit").hidden = true;
    $("ptFormTitle").textContent = "إضافة نقطة (Easting / Northing بالمتر)";
  }

  $("btnAdd").onclick = () => {
    const p = readInputs();
    if (!p) return;
    if (editIndex >= 0) { points[editIndex] = p; UI.toast(`حُدّثت النقطة ${editIndex + 1}`, "success"); }
    else points.push(p);
    clearForm();
    refresh();
    $("ptX").focus();
  };

  $("btnCancelEdit").onclick = () => { clearForm(); renderPoints(); };

  $("btnClear").onclick = async () => {
    if (!points.length) return;
    const ok = await UI.confirm({
      title: "حذف كل النقاط؟",
      message: `سيتم حذف ${points.length} نقطة نهائيًا. لا يمكن التراجع.`,
      confirmLabel: "حذف الكل",
    });
    if (!ok) return;
    points = []; clearForm(); refresh();
    UI.toast("تم حذف كل النقاط", "success");
  };

  $("ptList").addEventListener("click", async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    const { up, down, edit, del } = b.dataset;
    if (up !== undefined) { const i = +up; [points[i - 1], points[i]] = [points[i], points[i - 1]]; if (editIndex === i) editIndex = i - 1; refresh(); }
    else if (down !== undefined) { const i = +down; [points[i + 1], points[i]] = [points[i], points[i + 1]]; if (editIndex === i) editIndex = i + 1; refresh(); }
    else if (edit !== undefined) {
      const i = +edit;
      editIndex = i;
      $("ptX").value = points[i].x; $("ptY").value = points[i].y;
      $("btnAdd").textContent = `حفظ التعديل على النقطة ${i + 1}`;
      $("btnCancelEdit").hidden = false;
      $("ptFormTitle").textContent = `تعديل النقطة ${i + 1}`;
      renderPoints();
      $("ptX").focus();
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (del !== undefined) {
      const i = +del;
      const ok = await UI.confirm({ title: `حذف النقطة ${i + 1}؟`, message: `X: ${points[i].x} — Y: ${points[i].y}`, confirmLabel: "حذف" });
      if (!ok) return;
      points.splice(i, 1);
      if (editIndex === i) clearForm(); else if (editIndex > i) editIndex--;
      refresh();
    }
  });

  $("ptX").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("ptY").focus(); } });
  $("ptY").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); $("btnAdd").click(); } });

  (async () => {
    const saved = await Store.getToolState(TOOL);
    if (saved && Array.isArray(saved.points)) {
      points = saved.points.filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
      if (points.length) UI.toast(`تم استرجاع ${points.length} نقطة من الجلسة السابقة`, "success");
    }
    renderPoints(); compute();
  })();
})();

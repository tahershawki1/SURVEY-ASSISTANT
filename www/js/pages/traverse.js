/* تسوية المضلعات: Bowditch و Transit، تسوية الزوايا، تحقق من المدخلات، حفظ تلقائي */
(() => {
  const $ = (id) => document.getElementById(id);
  const TOOL = "traverse";
  let legs = [{ azimuth: 0, distance: 0 }, { azimuth: 90, distance: 0 }, { azimuth: 180, distance: 0 }, { azimuth: 270, distance: 0 }];
  let angles = [];

  const state = () => ({
    legs, angles,
    startX: $("startX").value, startY: $("startY").value,
    closed: $("closedLoop").checked, closeX: $("closeX").value, closeY: $("closeY").value,
    method: $("method").value, useAngles: $("useAngles").checked, startAz: $("startAz").value,
  });
  const saver = Store.autosaver(TOOL, state);

  /* ---------- الأضلاع ---------- */
  function buildLeg() {
    const el = document.createElement("div");
    el.className = "card sub";
    el.innerHTML = `
      <div class="row-3" style="align-items:flex-end">
        <div class="field" style="margin-bottom:0"><label data-lbl-az></label>
          <input type="number" step="any" inputmode="decimal" data-f="azimuth" /></div>
        <div class="field" style="margin-bottom:0"><label>المسافة m</label>
          <input type="number" step="any" inputmode="decimal" min="0" data-f="distance" /></div>
        <button type="button" class="btn danger sm" data-del>حذف</button>
      </div>`;
    return el;
  }

  function renderLegs() {
    const wrap = $("legsWrap");
    while (wrap.children.length > legs.length) wrap.lastElementChild.remove();
    while (wrap.children.length < legs.length) wrap.appendChild(buildLeg());
    const derived = $("useAngles").checked;
    [...wrap.children].forEach((el, i) => {
      el.dataset.row = i;
      el.querySelector("[data-lbl-az]").textContent = `ضلع ${i + 1} — أزيموث °${derived ? " (محسوب)" : ""}`;
      el.querySelectorAll("[data-f]").forEach((inp) => {
        const k = inp.dataset.f;
        if (document.activeElement !== inp && inp.value !== String(legs[i][k])) inp.value = legs[i][k];
        inp.setAttribute("aria-label", `${k === "azimuth" ? "أزيموث" : "مسافة"} الضلع ${i + 1}`);
        if (k === "azimuth") inp.readOnly = derived;
      });
      el.querySelector("[data-del]").setAttribute("aria-label", `حذف الضلع ${i + 1}`);
    });
  }

  $("legsWrap").addEventListener("input", (ev) => {
    const inp = ev.target.closest("[data-f]");
    if (!inp) return;
    const i = +inp.closest("[data-row]").dataset.row;
    const v = parseFloat(inp.value);
    legs[i][inp.dataset.f] = Number.isFinite(v) ? v : (inp.value === "" ? 0 : NaN);
    saver.save();
  });

  $("legsWrap").addEventListener("click", async (ev) => {
    if (!ev.target.closest("[data-del]")) return;
    const i = +ev.target.closest("[data-row]").dataset.row;
    const ok = await UI.confirm({ title: `حذف الضلع ${i + 1}؟`, message: `أزيموث ${legs[i].azimuth}° — مسافة ${legs[i].distance} م`, confirmLabel: "حذف" });
    if (!ok) return;
    legs.splice(i, 1);
    syncAngles(); renderLegs(); renderAngles(); saver.save();
  });

  $("btnAddLeg").onclick = () => { legs.push({ azimuth: 0, distance: 0 }); syncAngles(); renderLegs(); renderAngles(); saver.save(); };
  $("btnResetLegs").onclick = async () => {
    const ok = await UI.confirm({ title: "مسح الأضلاع؟", message: "سيتم حذف كل الأضلاع المُدخلة.", confirmLabel: "مسح" });
    if (!ok) return;
    legs = [{ azimuth: 0, distance: 0 }, { azimuth: 90, distance: 0 }, { azimuth: 180, distance: 0 }];
    syncAngles(); renderLegs(); renderAngles(); saver.save();
  };

  /* ---------- الزوايا ---------- */
  function syncAngles() {
    while (angles.length > legs.length) angles.pop();
    while (angles.length < legs.length) angles.push(90);
  }

  function renderAngles() {
    const wrap = $("anglesList");
    if (!$("useAngles").checked) { wrap.innerHTML = ""; return; }
    syncAngles();
    wrap.innerHTML = angles.map((a, i) => `
      <div class="field">
        <label for="ang${i}">الزاوية الداخلية عند النقطة ${i + 1} (درجات)</label>
        <input type="number" step="any" inputmode="decimal" id="ang${i}" data-ang="${i}" value="${a}" />
      </div>`).join("");
  }

  $("anglesList").addEventListener("input", (ev) => {
    const inp = ev.target.closest("[data-ang]");
    if (!inp) return;
    angles[+inp.dataset.ang] = parseFloat(inp.value);
    applyAngles();
    saver.save();
  });

  function applyAngles() {
    const out = $("angleResult");
    if (!$("useAngles").checked) { out.innerHTML = ""; return; }
    const res = Traverse.adjustAngles(angles, parseFloat($("startAz").value), { isClosed: $("closedLoop").checked });
    if (!res.ok) { out.innerHTML = UI.messageList(res.errors, "error"); return; }

    res.azimuths.forEach((az, i) => { if (legs[i]) legs[i].azimuth = Number(az.toFixed(6)); });
    renderLegs();

    const misSec = res.angularMisclosure * 3600;
    const allowSec = res.allowable * 3600;
    const ok = Math.abs(misSec) <= allowSec;
    out.innerHTML = `<div class="headline ${ok ? "ok" : "bad"}">
      <span class="k">خطأ الإغلاق الزاوي<span class="sub">المجموع النظري ${res.theoretical.toFixed(0)}° — المسموح ± ${allowSec.toFixed(0)}″</span></span>
      <span class="v">${misSec.toFixed(0)}″<span class="sub">تصحيح ${(res.correction * 3600).toFixed(1)}″ لكل زاوية</span></span></div>`;
  }

  $("useAngles").onchange = () => { $("anglesWrap").hidden = !$("useAngles").checked; renderAngles(); applyAngles(); renderLegs(); saver.save(); };
  $("startAz").addEventListener("input", () => { applyAngles(); saver.save(); });
  $("closedLoop").onchange = () => { $("closeToWrap").hidden = $("closedLoop").checked; applyAngles(); saver.save(); };
  ["startX", "startY", "closeX", "closeY", "method"].forEach((id) => $(id).addEventListener("input", saver.save));

  /* ---------- الحساب ---------- */
  function compute() {
    const msgs = $("messages"), head = $("headline"), box = $("result"), bar = $("exportBar");
    const start = { x: parseFloat($("startX").value), y: parseFloat($("startY").value) };
    const isClosed = $("closedLoop").checked;
    const closeTo = isClosed ? null : { x: parseFloat($("closeX").value), y: parseFloat($("closeY").value) };

    const res = Traverse.compute(start, legs, closeTo, { method: $("method").value, isClosed });
    msgs.innerHTML = UI.messageList(res.errors, "error") + UI.messageList(res.warnings, "warn");

    if (!res.ok) {
      head.innerHTML = "";
      box.className = "result-box empty";
      box.textContent = "صحّح المدخلات ثم أعد المحاولة";
      bar.hidden = true;
      return;
    }

    const exact = res.precision === Infinity;
    const good = exact || res.precision >= 5000;
    head.innerHTML = `<div class="headline ${good ? "ok" : "bad"}">
      <span class="k">الدقة النسبية<span class="sub">الخطأ الخطي ${res.misclosure.toFixed(4)} م على ${res.sumDist.toFixed(2)} م</span></span>
      <span class="v">${exact ? "مضبوط" : "1 : " + Math.round(res.precision)}<span class="sub">${good ? "مقبول" : "أقل من 1:5000"}</span></span></div>`;

    const legRows = res.legs.map((l, i) =>
      `<tr><td>${i + 1}</td><td class="n">${l.azimuth.toFixed(4)}</td><td class="n">${l.distance.toFixed(3)}</td>
       <td class="n">${l.adjLat.toFixed(3)}</td><td class="n">${l.adjDep.toFixed(3)}</td></tr>`).join("");
    const ptRows = res.points.map((p, i) =>
      `<tr><td>${i}</td><td class="n">${p.x.toFixed(3)}</td><td class="n">${p.y.toFixed(3)}</td></tr>`).join("");

    box.className = "result-box";
    box.innerHTML = `
      <div class="row"><span>الطريقة</span><b>${res.method === "transit" ? "Transit" : "Bowditch"}</b></div>
      <div class="row"><span>مجموع الأطوال</span><b>${res.sumDist.toFixed(3)} m</b></div>
      <div class="row"><span>خطأ الإغلاق (Lat / Dep)</span><b>${res.errorLat.toFixed(4)} / ${res.errorDep.toFixed(4)}</b></div>
      <div class="row"><span>اتجاه خطأ الإغلاق</span><b>${res.misclosureBearing === null ? "—" : res.misclosureBearing.toFixed(2) + "°"}</b></div>
      <div class="section-title">الأضلاع بعد التسوية</div>
      <div class="tbl-wrap"><table class="data"><thead><tr><th>#</th><th>أزيموث</th><th>مسافة</th><th>ΔN معدّل</th><th>ΔE معدّل</th></tr></thead><tbody>${legRows}</tbody></table></div>
      <div class="section-title">إحداثيات النقاط بعد التسوية</div>
      <div class="tbl-wrap"><table class="data"><thead><tr><th>النقطة</th><th>X (E)</th><th>Y (N)</th></tr></thead><tbody>${ptRows}</tbody></table></div>`;

    bar.hidden = false;
    UI.exportBar(bar, {
      filename: () => `traverse_${UI.stamp()}.csv`,
      rows: () => [["Point", "Easting", "Northing"]]
        .concat(res.points.map((p, i) => [i, p.x.toFixed(3), p.y.toFixed(3)]))
        .concat([[], ["Leg", "Azimuth", "Distance", "AdjLat", "AdjDep"]],
          res.legs.map((l, i) => [i + 1, l.azimuth.toFixed(4), l.distance.toFixed(3), l.adjLat.toFixed(3), l.adjDep.toFixed(3)]),
          [[], ["Method", res.method], ["Total distance", res.sumDist.toFixed(3)],
           ["Misclosure", res.misclosure.toFixed(4)], ["Precision", exact ? "exact" : "1:" + Math.round(res.precision)]]),
      text: () => res.points.map((p, i) => `${i}: X ${p.x.toFixed(3)} Y ${p.y.toFixed(3)}`).join("\n") +
        `\n\nالخطأ الخطي: ${res.misclosure.toFixed(4)} م — الدقة ${exact ? "مضبوط" : "1:" + Math.round(res.precision)}`,
    });
  }

  $("btnCompute").onclick = compute;

  (async () => {
    const s = await Store.getToolState(TOOL);
    if (s) {
      if (Array.isArray(s.legs) && s.legs.length) legs = s.legs.map((l) => ({ azimuth: Number(l.azimuth) || 0, distance: Number(l.distance) || 0 }));
      if (Array.isArray(s.angles)) angles = s.angles.map(Number);
      if (s.startX !== undefined) $("startX").value = s.startX;
      if (s.startY !== undefined) $("startY").value = s.startY;
      if (s.closeX !== undefined) $("closeX").value = s.closeX;
      if (s.closeY !== undefined) $("closeY").value = s.closeY;
      if (s.startAz !== undefined) $("startAz").value = s.startAz;
      $("closedLoop").checked = s.closed !== false;
      $("useAngles").checked = s.useAngles === true;
      if (s.method) $("method").value = s.method;
      const n = legs.filter((l) => l.distance > 0).length;
      if (n) UI.toast(`تم استرجاع ${n} ضلع من الجلسة السابقة`, "success");
    }
    $("closeToWrap").hidden = $("closedLoop").checked;
    $("anglesWrap").hidden = !$("useAngles").checked;
    syncAngles(); renderLegs(); renderAngles(); applyAngles();
  })();
})();

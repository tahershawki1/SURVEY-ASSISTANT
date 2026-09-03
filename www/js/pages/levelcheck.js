/* التحقق من المناسيب: سماحية قابلة للضبط، إقفال عكسي للمراحل، حفظ تلقائي، تصدير */
(() => {
  const $ = (id) => document.getElementById(id);
  const TOOL = "levelcheck";
  let HI = null, targetRL = null, readings = [];
  let tolerance = LevelCheck.DEFAULT_TOLERANCE_M;

  const state = () => ({
    bmRL: $("bmRL").value, bmBS: $("bmBS").value, targetRL: $("targetRL").value,
    profile: $("tolProfile").value, tolMM: $("tolMM").value,
    readings: readings.map((r) => r.reading),
  });
  const saver = Store.autosaver(TOOL, state);

  $("tolProfile").innerHTML = LevelCheck.PROFILES
    .map((p) => `<option value="${p.id}">${UI.esc(p.label)}${p.tolerance !== null ? ` (± ${(p.tolerance * 1000).toFixed(0)} مم)` : ""}</option>`).join("");

  /* ---------- المراحل ---------- */
  function setStage(n) {
    document.querySelectorAll(".dot").forEach((d) => {
      const v = Number(d.dataset.dot);
      d.classList.toggle("active", v === n);
      d.classList.toggle("done", v < n);
      d.setAttribute("aria-current", v === n ? "step" : "false");
    });
  }

  function setLocked(id, locked) {
    const el = $(id);
    el.classList.toggle("locked", locked);
    el.querySelectorAll("input, select, button").forEach((n) => {
      if (n.id === "btnReset") return;
      n.disabled = locked;
    });
  }

  function goTo(id) {
    setStage({ stage1: 1, stage2: 2, stage3: 3 }[id]);
    $(id).scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ---------- التحقق التدريجي (يقفل المراحل عند بطلان ما قبلها) ---------- */
  function validateStage1() {
    const bmRL = parseFloat($("bmRL").value);
    const bmBS = parseFloat($("bmBS").value);
    const box = $("hiPreview");
    let err = null;
    if (!Number.isFinite(bmRL) || !Number.isFinite(bmBS)) err = "أدخل القيمتين لحساب ارتفاع خط النظر (HI)";
    else if (bmBS < 0) err = "قراءة القامة لا تكون سالبة";

    if (err) {
      HI = null;
      box.className = "result-box empty";
      box.textContent = err;
      $("next1").disabled = true;
      setLocked("stage2", true);
      setLocked("stage3", true);
      $("next2").disabled = true;
      setStage(1);
      validateStage3();
      return;
    }
    HI = LevelCheck.computeHI(bmRL, bmBS);
    box.className = "result-box";
    box.innerHTML = `<div class="row"><span>ارتفاع خط النظر (HI)</span><b>${HI.toFixed(3)} m</b></div>`;
    $("next1").disabled = false;
    setLocked("stage2", false);
    validateStage2();
  }

  function validateStage2() {
    if (HI === null) return;
    const val = parseFloat($("targetRL").value);
    const profile = LevelCheck.PROFILES.find((p) => p.id === $("tolProfile").value);
    $("customTolWrap").hidden = !profile || profile.tolerance !== null;
    tolerance = profile && profile.tolerance !== null
      ? profile.tolerance
      : (parseFloat($("tolMM").value) || 5) / 1000;

    if (!Number.isFinite(val)) {
      targetRL = null;
      $("next2").disabled = true;
      setLocked("stage3", true);
      validateStage3();
      return;
    }
    targetRL = val;
    $("next2").disabled = false;
    setLocked("stage3", false);
    recomputeAll();
  }

  function validateStage3() {
    const val = parseFloat($("fieldReading").value);
    $("calcBtn").disabled = !Number.isFinite(val) || val < 0 || HI === null || targetRL === null;
  }

  /* ---------- القراءات ---------- */
  function label(res) {
    const mm = LevelCheck.formatDiffMM(res.diffMM, res.toleranceMM);
    if (res.status === "match") return { cls: "ok", sym: "✅", text: `مطابق (فرق ${mm} مم)` };
    if (res.status === "high") return { cls: "warn", sym: "🔺", text: `أعلى بـ ${mm} مم — اقطع` };
    return { cls: "danger", sym: "🔻", text: `أقل بـ ${mm} مم — اردم` };
  }

  function renderReadings() {
    const body = $("readingsBody");
    $("readingsWrap").hidden = readings.length === 0;
    $("readingsEmpty").hidden = readings.length > 0;
    $("exportBar").hidden = readings.length === 0;

    body.innerHTML = readings.map((r, i) => {
      const l = label(r.res);
      return `<div class="readings-row">
        <span class="rd">${r.reading.toFixed(3)}</span>
        <span class="st ${l.cls}"><span class="sym" aria-hidden="true">${l.sym}</span>${UI.esc(l.text)}</span>
        <button type="button" data-del="${i}" aria-label="حذف القراءة ${i + 1}">✕</button>
      </div>`;
    }).join("");

    if (readings.length) {
      const okCount = readings.filter((r) => r.res.status === "match").length;
      const allOk = okCount === readings.length;
      $("headline").innerHTML = `<div class="headline ${allOk ? "ok" : "warn"}">
        <span class="k">القراءات المطابقة<span class="sub">HI ${HI !== null ? HI.toFixed(3) : "—"} · الهدف ${targetRL !== null ? targetRL.toFixed(3) : "—"} · سماحية ± ${(tolerance * 1000).toFixed(1)} مم</span></span>
        <span class="v">${okCount} / ${readings.length}</span></div>`;
      UI.exportBar($("exportBar"), {
        filename: () => `levelcheck_${UI.stamp()}.csv`,
        rows: () => [["#", "Reading", "ActualRL", "TargetRL", "Diff_mm", "Tolerance_mm", "Status"]]
          .concat(readings.map((r, i) => [i + 1, r.reading.toFixed(3), r.res.actualRL.toFixed(3),
            targetRL.toFixed(3), r.res.diffMM.toFixed(2), r.res.toleranceMM.toFixed(1), r.res.status])),
        text: () => readings.map((r, i) => `${i + 1}) ${r.reading.toFixed(3)} → ${label(r.res).text}`).join("\n"),
      });
    } else {
      $("headline").innerHTML = "";
    }
  }

  function recomputeAll() {
    if (HI === null || targetRL === null) return;
    readings = readings.map((r) => ({ reading: r.reading, res: LevelCheck.checkReading(HI, targetRL, r.reading, tolerance) }));
    renderReadings();
  }

  function calcReading() {
    if (HI === null || targetRL === null) return UI.toast("أكمل المرحلتين السابقتين أولًا", "warn");
    const input = $("fieldReading");
    const reading = parseFloat(input.value);
    let res;
    try { res = LevelCheck.checkReading(HI, targetRL, reading, tolerance); }
    catch (e) { return UI.toast(e.message, "error"); }
    readings.push({ reading, res });
    renderReadings();
    saver.save();
    input.value = "";
    input.focus();
    validateStage3();
  }

  $("readingsBody").addEventListener("click", async (ev) => {
    const b = ev.target.closest("[data-del]");
    if (!b) return;
    const i = +b.dataset.del;
    const ok = await UI.confirm({ title: `حذف القراءة ${i + 1}؟`, message: `القراءة: ${readings[i].reading.toFixed(3)}`, confirmLabel: "حذف" });
    if (!ok) return;
    readings.splice(i, 1);
    renderReadings(); saver.save();
  });

  $("btnReset").onclick = async () => {
    const ok = await UI.confirm({
      title: "إعادة الضبط؟",
      message: readings.length ? `سيتم حذف ${readings.length} قراءة مسجّلة والبدء من جديد.` : "سيتم مسح كل المدخلات والبدء من جديد.",
      confirmLabel: "إعادة الضبط",
    });
    if (!ok) return;
    HI = null; targetRL = null; readings = [];
    ["bmRL", "bmBS", "targetRL", "fieldReading"].forEach((id) => ($(id).value = ""));
    setLocked("stage2", true); setLocked("stage3", true);
    $("next1").disabled = true; $("next2").disabled = true; $("calcBtn").disabled = true;
    $("hiPreview").className = "result-box empty";
    $("hiPreview").textContent = "أدخل القيمتين لحساب ارتفاع خط النظر (HI)";
    renderReadings();
    await Store.clearToolState(TOOL);
    goTo("stage1");
    $("bmRL").focus();
  };

  /* ---------- تدفّق لوحة المفاتيح: زر Go ينقل للحقل التالي حتى عبر المراحل ---------- */
  const enter = (id, fn) => $(id).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); fn(); } });
  enter("bmRL", () => $("bmBS").focus());
  enter("bmBS", () => { if (!$("next1").disabled) { goTo("stage2"); $("targetRL").focus(); } });
  enter("targetRL", () => { if (!$("next2").disabled) { goTo("stage3"); $("fieldReading").focus(); } });
  enter("fieldReading", () => { if (!$("calcBtn").disabled) calcReading(); });

  ["bmRL", "bmBS"].forEach((id) => $(id).addEventListener("input", () => { validateStage1(); saver.save(); }));
  $("targetRL").addEventListener("input", () => { validateStage2(); saver.save(); });
  $("tolProfile").addEventListener("change", () => { validateStage2(); saver.save(); });
  $("tolMM").addEventListener("input", () => { validateStage2(); saver.save(); });
  $("fieldReading").addEventListener("input", validateStage3);
  $("next1").onclick = () => { goTo("stage2"); $("targetRL").focus(); };
  $("next2").onclick = () => { goTo("stage3"); $("fieldReading").focus(); };
  $("calcBtn").onclick = calcReading;

  (async () => {
    const s = await Store.getSettings();
    $("tolProfile").value = s.levelToleranceProfile || "concrete";
    $("tolMM").value = ((s.levelTolerance || 0.005) * 1000).toFixed(1);

    const saved = await Store.getToolState(TOOL);
    if (saved) {
      if (saved.bmRL) $("bmRL").value = saved.bmRL;
      if (saved.bmBS) $("bmBS").value = saved.bmBS;
      if (saved.targetRL) $("targetRL").value = saved.targetRL;
      if (saved.profile) $("tolProfile").value = saved.profile;
      if (saved.tolMM) $("tolMM").value = saved.tolMM;
      validateStage1();
      if (HI !== null && targetRL !== null && Array.isArray(saved.readings)) {
        readings = saved.readings.filter(Number.isFinite).map((v) => ({ reading: v, res: LevelCheck.checkReading(HI, targetRL, v, tolerance) }));
        if (readings.length) UI.toast(`تم استرجاع ${readings.length} قراءة من الجلسة السابقة`, "success");
      }
      renderReadings();
      return;
    }
    validateStage1();
    renderReadings();
  })();
})();

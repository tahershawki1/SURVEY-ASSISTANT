/* حسابات الميزانية: تحرير الصفوف بلا إعادة بناء تفقد التركيز، حفظ تلقائي، تصدير */
(() => {
  const $ = (id) => document.getElementById(id);
  const TOOL = "leveling";
  const blank = (name) => ({ station: name, bs: "", is: "", fs: "" });
  let rows = [blank("BM"), blank("P1")];
  const saver = Store.autosaver(TOOL, () => ({ rows, firstRL: $("firstRL").value }));

  /* بناء الصف مرة واحدة: التعديل اللاحق يمس القيم فقط حتى لا يضيع مؤشر الكتابة */
  function buildRow(i) {
    const el = document.createElement("div");
    el.className = "card sub";
    el.dataset.row = i;
    el.innerHTML = `
      <div class="row-2" style="margin-bottom:8px">
        <div class="field" style="margin-bottom:0">
          <label>اسم المحطة</label>
          <input data-f="station" style="direction:rtl;text-align:right" />
        </div>
        <div style="display:flex;align-items:flex-end">
          <button type="button" class="btn danger sm" style="width:100%" data-del>حذف</button>
        </div>
      </div>
      <div class="row-3">
        <div class="field" style="margin-bottom:0"><label>BS خلفي</label>
          <input type="number" step="any" inputmode="decimal" data-f="bs" /></div>
        <div class="field" style="margin-bottom:0"><label>IS متوسط</label>
          <input type="number" step="any" inputmode="decimal" data-f="is" /></div>
        <div class="field" style="margin-bottom:0"><label>FS أمامي</label>
          <input type="number" step="any" inputmode="decimal" data-f="fs" /></div>
      </div>`;
    return el;
  }

  function syncRow(el, i) {
    el.dataset.row = i;
    const r = rows[i];
    el.querySelectorAll("[data-f]").forEach((inp) => {
      const k = inp.dataset.f;
      // القيمة تُكتب فقط إن اختلفت، حتى لا يتحرك مؤشر الكتابة أثناء الإدخال
      if (document.activeElement !== inp && inp.value !== String(r[k])) inp.value = r[k];
      inp.setAttribute("aria-label", `${{ station: "اسم المحطة", bs: "قراءة خلفية", is: "قراءة متوسطة", fs: "قراءة أمامية" }[k]} للصف ${i + 1}`);
    });
    el.querySelector("[data-del]").setAttribute("aria-label", `حذف الصف ${i + 1}`);
  }

  function renderRows() {
    const wrap = $("rowsWrap");
    while (wrap.children.length > rows.length) wrap.lastElementChild.remove();
    while (wrap.children.length < rows.length) wrap.appendChild(buildRow(wrap.children.length));
    [...wrap.children].forEach((el, i) => syncRow(el, i));
  }

  $("rowsWrap").addEventListener("input", (ev) => {
    const inp = ev.target.closest("[data-f]");
    if (!inp) return;
    const i = +inp.closest("[data-row]").dataset.row;
    rows[i][inp.dataset.f] = inp.value;
    saver.save();
  });

  $("rowsWrap").addEventListener("click", async (ev) => {
    if (!ev.target.closest("[data-del]")) return;
    const i = +ev.target.closest("[data-row]").dataset.row;
    if (rows.length <= 1) return UI.toast("يجب إبقاء صف واحد على الأقل", "warn");
    const ok = await UI.confirm({ title: `حذف الصف ${i + 1}؟`, message: rows[i].station || "بدون اسم", confirmLabel: "حذف" });
    if (!ok) return;
    rows.splice(i, 1);
    renderRows(); saver.save();
  });

  $("btnAddRow").onclick = () => {
    rows.push(blank(`P${rows.length}`));
    renderRows(); saver.save();
    const last = $("rowsWrap").lastElementChild;
    if (last) last.querySelector('[data-f="station"]').focus();
  };

  $("btnResetRows").onclick = async () => {
    const ok = await UI.confirm({ title: "مسح الجدول؟", message: "سيتم حذف كل القراءات المُدخلة.", confirmLabel: "مسح" });
    if (!ok) return;
    rows = [blank("BM"), blank("P1")];
    renderRows(); saver.save();
    $("result").className = "result-box empty";
    $("result").textContent = 'أدخل القراءات ثم اضغط «تفريغ المناسيب»';
    $("headline").innerHTML = ""; $("messages").innerHTML = ""; $("exportBar").hidden = true;
  };

  function compute() {
    const firstRL = parseFloat($("firstRL").value);
    const msgs = $("messages"), head = $("headline"), box = $("result"), bar = $("exportBar");

    const res = Leveling.reduce(firstRL, rows);
    msgs.innerHTML = UI.messageList(res.errors, "error") + UI.messageList(res.warnings, "warn");

    if (!res.ok) {
      head.innerHTML = "";
      box.className = "result-box empty";
      box.textContent = "صحّح المدخلات ثم أعد المحاولة";
      bar.hidden = true;
      return;
    }

    const setups = res.rows.filter((r) => r.bs !== null).length;
    const allow = Leveling.allowableMisclosure(setups);
    const hasCheck = res.misclosure !== null;
    const ok = hasCheck && Math.abs(res.misclosure) <= Math.max(allow, 0.001);

    head.innerHTML = hasCheck
      ? `<div class="headline ${ok ? "ok" : "bad"}">
          <span class="k">خطأ الإغلاق الحسابي<span class="sub">المسموح ± ${(allow * 1000).toFixed(1)} مم عند ${setups} محطة</span></span>
          <span class="v">${(res.misclosure * 1000).toFixed(1)}<span class="sub">مليمتر — ${ok ? "مقبول" : "خارج السماحية"}</span></span></div>`
      : `<div class="headline warn"><span class="k">التحقق الحسابي<span class="sub">لا توجد قراءة أمامية تُغلق الدورة</span></span>
          <span class="v">—</span></div>`;

    const tbl = `<div class="tbl-wrap"><table class="data">
      <thead><tr><th>المحطة</th><th>BS</th><th>IS</th><th>FS</th><th>HI</th><th>RL</th><th>النوع</th></tr></thead>
      <tbody>${res.rows.map((r) => `<tr>
        <td>${UI.esc(r.station || "—")}</td>
        <td class="n">${r.bs !== null ? r.bs.toFixed(3) : ""}</td>
        <td class="n">${r.is !== null ? r.is.toFixed(3) : ""}</td>
        <td class="n">${r.fs !== null ? r.fs.toFixed(3) : ""}</td>
        <td class="n">${r.HI !== null ? r.HI.toFixed(3) : ""}</td>
        <td class="n"><b>${r.RL !== null ? r.RL.toFixed(3) : "—"}</b></td>
        <td>${UI.esc({ BM: "نقطة ثابتة", IS: "متوسطة", FS: "أمامية", CP: "نقطة تغيير", BS: "خلفية" }[r.kind] || "")}</td>
      </tr>`).join("")}</tbody></table></div>`;

    const summary = [
      ["مجموع BS (الجزء المغلق)", res.checkBS.toFixed(3)],
      ["مجموع FS (الجزء المغلق)", res.checkFS.toFixed(3)],
      ["ΣBS − ΣFS", res.arithmeticCheck !== null ? res.arithmeticCheck.toFixed(3) : "—"],
      ["منسوب الإغلاق − منسوب البداية", res.expectedDiff !== null ? res.expectedDiff.toFixed(3) : "—"],
      ["عدد المحطات", String(setups)],
    ];

    box.className = "result-box";
    box.innerHTML = tbl + `<div style="margin-top:10px">` +
      summary.map(([k, v]) => `<div class="row"><span>${UI.esc(k)}</span><b>${UI.esc(v)}</b></div>`).join("") + `</div>`;

    bar.hidden = false;
    UI.exportBar(bar, {
      filename: () => `leveling_${UI.stamp()}.csv`,
      rows: () => [["Station", "BS", "IS", "FS", "HI", "RL", "Type"]]
        .concat(res.rows.map((r) => [r.station || "", r.bs ?? "", r.is ?? "", r.fs ?? "",
          r.HI !== null ? r.HI.toFixed(3) : "", r.RL !== null ? r.RL.toFixed(3) : "", r.kind || ""]))
        .concat([[], ["Check", "Value"]], summary,
          [["Misclosure (m)", hasCheck ? res.misclosure.toFixed(4) : ""], ["Allowable (m)", allow.toFixed(4)]]),
      text: () => res.rows.map((r) => `${r.station || "-"}: RL ${r.RL !== null ? r.RL.toFixed(3) : "-"}`).join("\n") +
        `\n\nخطأ الإغلاق: ${hasCheck ? (res.misclosure * 1000).toFixed(1) + " مم" : "غير محسوب"}`,
    });
  }

  $("btnCompute").onclick = compute;
  $("firstRL").addEventListener("input", saver.save);

  (async () => {
    const saved = await Store.getToolState(TOOL);
    if (saved && Array.isArray(saved.rows) && saved.rows.length) {
      rows = saved.rows.map((r) => ({ station: String(r.station || ""), bs: String(r.bs ?? ""), is: String(r.is ?? ""), fs: String(r.fs ?? "") }));
      if (saved.firstRL) $("firstRL").value = saved.firstRL;
      const filled = rows.filter((r) => r.bs || r.is || r.fs).length;
      if (filled) UI.toast(`تم استرجاع ${filled} قراءة من الجلسة السابقة`, "success");
    }
    renderRows();
  })();
})();

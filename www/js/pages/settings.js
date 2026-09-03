/* الإعدادات: المظهر، حجم الخط، السماحية، التحديثات، والبيانات المحفوظة */
(() => {
  const $ = (id) => document.getElementById(id);

  /* ---------- المظهر ---------- */
  $("themeRow").innerHTML = UI.THEMES.map((t) =>
    `<button type="button" class="btn secondary sm" data-theme-btn="${t.id}" aria-pressed="false">${t.icon} ${UI.esc(t.label)}</button>`).join("");
  $("themeRow").addEventListener("click", (ev) => {
    const b = ev.target.closest("[data-theme-btn]");
    if (!b) return;
    UI.applyTheme(b.dataset.themeBtn);
    paintThemeButtons();
  });
  function paintThemeButtons() {
    const cur = UI.readTheme();
    document.querySelectorAll("[data-theme-btn]").forEach((b) => {
      const on = b.dataset.themeBtn === cur;
      b.className = "btn sm" + (on ? "" : " secondary");
      b.setAttribute("aria-pressed", String(on));
    });
  }

  const fs = $("fontScale");
  fs.value = UI.readFontScale();
  $("fontScaleVal").textContent = Math.round(fs.value * 100) + "%";
  fs.addEventListener("input", () => {
    UI.applyFontScale(fs.value);
    $("fontScaleVal").textContent = Math.round(fs.value * 100) + "%";
  });

  /* ---------- السماحية ---------- */
  $("tolProfile").innerHTML = LevelCheck.PROFILES
    .map((p) => `<option value="${p.id}">${UI.esc(p.label)}${p.tolerance !== null ? ` (± ${(p.tolerance * 1000).toFixed(0)} مم)` : ""}</option>`).join("");
  $("tolProfile").addEventListener("change", () => {
    const p = LevelCheck.PROFILES.find((x) => x.id === $("tolProfile").value);
    $("customTolWrap").hidden = !p || p.tolerance !== null;
    if (p && p.tolerance !== null) $("tolMM").value = (p.tolerance * 1000).toFixed(1);
  });
  $("btnSaveTol").onclick = async () => {
    const p = LevelCheck.PROFILES.find((x) => x.id === $("tolProfile").value);
    const mm = parseFloat($("tolMM").value);
    if (p && p.tolerance === null && (!Number.isFinite(mm) || mm < 0)) return UI.toast("أدخل سماحية رقمية موجبة", "error");
    await Store.saveSettings({
      levelToleranceProfile: $("tolProfile").value,
      levelTolerance: p && p.tolerance !== null ? p.tolerance : mm / 1000,
    });
    UI.toast("تم حفظ السماحية", "success");
  };

  /* ---------- التحديثات ---------- */
  $("btnSaveAuto").onclick = async () => {
    const h = parseInt($("interval").value, 10);
    if (!Number.isFinite(h) || h < Store.MIN_INTERVAL_HOURS || h > Store.MAX_INTERVAL_HOURS) {
      $("interval").setAttribute("aria-invalid", "true");
      return UI.toast(`الفحص كل ${Store.MIN_INTERVAL_HOURS} إلى ${Store.MAX_INTERVAL_HOURS} ساعة فقط`, "error");
    }
    $("interval").removeAttribute("aria-invalid");
    await Store.saveSettings({ autoCheck: $("autoCheck").checked, checkIntervalHours: h });
    UI.toast("تم الحفظ", "success");
    await load();
  };

  $("btnCheckNow").onclick = async () => {
    if (navigator.onLine === false) return UI.toast("لا يوجد اتصال بالإنترنت", "error");
    const btn = $("btnCheckNow");
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ الفحص...";
    try {
      const { otaResult, nativeResult } = await promptAvailableUpdates({ manual: true });
      if (otaResult.status === "error") UI.toast("تعذّر الفحص: " + otaResult.error, "error");
      else if (otaResult.status === "up-to-date" && (nativeResult.status === "up-to-date" || nativeResult.status === "unavailable")) {
        UI.toast("أنت تستخدم أحدث إصدار: " + otaResult.version, "success");
      }
      await load();
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  };

  /* ---------- البيانات المحفوظة ---------- */
  const TOOL_IDS = [
    ["area", "المساحات والمسافات"], ["leveling", "حسابات الميزانية"],
    ["traverse", "تسوية المضلعات"], ["levelcheck", "التحقق من المناسيب"],
  ];

  $("btnClearTools").onclick = async () => {
    const ok = await UI.confirm({
      title: "مسح جلسات الأدوات؟",
      message: "سيتم حذف النقاط والقراءات والأضلاع المحفوظة في كل الأدوات. لا يشمل ذلك الدفتر الميداني.",
      confirmLabel: "مسح الجلسات",
    });
    if (!ok) return;
    for (const [id] of TOOL_IDS) await Store.clearToolState(id);
    UI.toast("تم مسح جلسات الأدوات", "success");
    await load();
  };

  async function load() {
    const s = await Store.getSettings();
    $("autoCheck").checked = s.autoCheck;
    $("interval").value = s.checkIntervalHours;
    $("tolProfile").value = s.levelToleranceProfile || "concrete";
    $("tolMM").value = ((s.levelTolerance || 0.005) * 1000).toFixed(1);
    $("tolProfile").dispatchEvent(new Event("change"));
    paintThemeButtons();

    const pending = Updater.getPending();
    const local = typeof NativeUpdater !== "undefined" ? await NativeUpdater.getLocalInfo() : null;

    $("versionBox").innerHTML = [
      ["إصدار الواجهة (OTA)", s.currentVersion],
      ...(local ? [["إصدار التطبيق المثبّت", `${local.versionName} (build ${local.versionCode})`]] : []),
      ["آخر فحص", s.lastCheck ? new Date(s.lastCheck).toLocaleString("ar-EG") : "لم يتم بعد"],
      ...(pending ? [["تحديث جاهز للتثبيت", pending.version + (pending.armed ? " (يُفعَّل تلقائيًا)" : "")]] : []),
    ].map(([k, v]) => `<div class="row"><span>${UI.esc(k)}</span><b>${UI.esc(v)}</b></div>`).join("");

    $("sourceBox").innerHTML = [
      ["المستودع", `${s.githubOwner}/${s.githubRepo}`],
      ["الفرع", s.branch],
      ["التحقق من البصمة", "SHA-256 إلزامي"],
    ].map(([k, v]) => `<div class="row"><span>${UI.esc(k)}</span><b>${UI.esc(v)}</b></div>`).join("");

    const rows = [];
    for (const [id, label] of TOOL_IDS) {
      const st = await Store.getToolState(id);
      const n = st ? (st.points || st.rows || st.legs || st.readings || []).length : 0;
      rows.push([label, st ? `${n} عنصر · ${new Date(st.savedAt).toLocaleString("ar-EG")}` : "لا توجد جلسة"]);
    }
    const notes = await Store.getFieldNotes();
    rows.push(["الدفتر الميداني", `${notes.length} ملاحظة (الحد ${Store.MAX_NOTES})`]);
    $("dataBox").innerHTML = rows.map(([k, v]) => `<div class="row"><span>${UI.esc(k)}</span><b>${UI.esc(v)}</b></div>`).join("");
  }

  load();
})();

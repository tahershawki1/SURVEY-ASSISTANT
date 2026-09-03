/* الدفتر الميداني: بحث، تعديل، حذف بتأكيد، تصدير CSV */
(() => {
  const $ = (id) => document.getElementById(id);
  let currentGPS = null;
  let editId = null;
  let notes = [];

  function fmtTime(iso) {
    try { return new Date(iso).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }); }
    catch (e) { return iso; }
  }

  function showGps() {
    $("gpsPreview").hidden = !currentGPS;
    if (!currentGPS) return;
    $("gpsBox").innerHTML = `
      <div class="row"><span>Lat</span><b>${currentGPS.lat.toFixed(7)}</b></div>
      <div class="row"><span>Lon</span><b>${currentGPS.lon.toFixed(7)}</b></div>
      <div class="row"><span>الدقة</span><b>${Number.isFinite(currentGPS.accuracy) ? currentGPS.accuracy.toFixed(1) : "—"} m</b></div>`;
  }

  async function captureLocation() {
    const btn = $("btnGps");
    btn.disabled = true;
    const old = btn.textContent;
    btn.textContent = "جارٍ تحديد الموقع...";
    try {
      let pos;
      if (window.Native && window.Native.Geolocation) {
        const perm = await window.Native.Geolocation.checkPermissions();
        if (perm.location !== "granted") {
          const asked = await window.Native.Geolocation.requestPermissions();
          if (asked.location !== "granted") throw new Error("لم يُسمح للتطبيق بالوصول إلى الموقع");
        }
        pos = await window.Native.Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 20000 });
      } else if (navigator.geolocation) {
        pos = await new Promise((res, rej) =>
          navigator.geolocation.getCurrentPosition((p) => res({ coords: p.coords }), rej, { enableHighAccuracy: true, timeout: 20000 }));
      } else {
        throw new Error("تحديد الموقع غير متاح على هذا الجهاز");
      }
      currentGPS = { lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy };
      showGps();
      UI.toast("تم التقاط الموقع", "success");
    } catch (e) {
      UI.toast("تعذّر الحصول على الموقع: " + (e.message || e), "error");
    } finally {
      btn.disabled = false;
      btn.textContent = old;
    }
  }

  function clearForm() {
    $("noteText").value = "";
    currentGPS = null; editId = null;
    showGps();
    $("btnSave").textContent = "حفظ الملاحظة";
    $("btnCancelEdit").hidden = true;
    $("noteFormTitle").textContent = "ملاحظة جديدة";
  }

  async function saveNote() {
    const text = $("noteText").value.trim();
    if (!text && !currentGPS) return UI.toast("أدخل نصًا أو التقط موقعًا أولًا", "warn");
    if (editId) {
      await Store.updateFieldNote(editId, { text, gps: currentGPS });
      UI.toast("تم تحديث الملاحظة", "success");
    } else {
      await Store.addFieldNote({ text, gps: currentGPS });
      UI.toast("تم حفظ الملاحظة", "success");
    }
    clearForm();
    await render();
  }

  async function render() {
    notes = await Store.getFieldNotes();
    const q = $("search").value.trim().toLowerCase();
    const shown = q
      ? notes.filter((n) => (n.text || "").toLowerCase().includes(q) ||
          (n.gps && (`${n.gps.lat} ${n.gps.lon}`).includes(q)))
      : notes;

    $("noteCount").textContent = q ? `${shown.length} من ${notes.length}` : String(notes.length);
    const wrap = $("notesList");
    $("exportBar").hidden = notes.length === 0;

    if (!shown.length) {
      wrap.innerHTML = `<div class="empty-state"><div class="big" aria-hidden="true">📒</div>${
        q ? "لا توجد ملاحظة تطابق البحث" : "لا توجد ملاحظات محفوظة بعد"}</div>`;
    } else {
      wrap.innerHTML = shown.map((n) => `
        <div class="notif-item">
          <span class="ic" aria-hidden="true">${n.gps ? "📍" : "📝"}</span>
          <div class="body">
            ${n.text ? `<div class="t" style="white-space:pre-wrap;font-weight:400">${UI.esc(n.text)}</div>` : ""}
            ${n.gps ? `<div class="m">Lat ${n.gps.lat.toFixed(6)} — Lon ${n.gps.lon.toFixed(6)}${
              Number.isFinite(n.gps.accuracy) ? ` (±${n.gps.accuracy.toFixed(0)} م)` : ""}</div>` : ""}
            <div class="time">
              <span>${UI.esc(fmtTime(n.time))}${n.editedAt ? " · مُعدّلة" : ""}</span>
              <button type="button" data-edit="${UI.esc(n.id)}" style="color:var(--primary-text)">تعديل</button>
              <button type="button" data-del="${UI.esc(n.id)}">حذف</button>
            </div>
          </div>
        </div>`).join("");
    }

    if (notes.length) {
      UI.exportBar($("exportBar"), {
        filename: () => `fieldnotes_${UI.stamp()}.csv`,
        rows: () => [["Time", "Text", "Latitude", "Longitude", "Accuracy_m"]]
          .concat(notes.map((n) => [n.time, n.text || "", n.gps ? n.gps.lat : "", n.gps ? n.gps.lon : "", n.gps ? n.gps.accuracy : ""])),
        text: () => notes.map((n) => `${fmtTime(n.time)}\n${n.text || ""}${n.gps ? `\n(${n.gps.lat.toFixed(6)}, ${n.gps.lon.toFixed(6)})` : ""}`).join("\n\n"),
      });
    }
  }

  $("notesList").addEventListener("click", async (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.edit) {
      const n = notes.find((x) => x.id === b.dataset.edit);
      if (!n) return;
      editId = n.id;
      $("noteText").value = n.text || "";
      currentGPS = n.gps || null;
      showGps();
      $("btnSave").textContent = "حفظ التعديل";
      $("btnCancelEdit").hidden = false;
      $("noteFormTitle").textContent = "تعديل ملاحظة";
      window.scrollTo({ top: 0, behavior: "smooth" });
      $("noteText").focus();
    } else if (b.dataset.del) {
      const n = notes.find((x) => x.id === b.dataset.del);
      const ok = await UI.confirm({
        title: "حذف الملاحظة؟",
        message: (n && n.text ? n.text.slice(0, 120) : "ملاحظة بموقع فقط") + "\n\nلا يمكن التراجع.",
        confirmLabel: "حذف",
      });
      if (!ok) return;
      await Store.deleteFieldNote(b.dataset.del);
      if (editId === b.dataset.del) clearForm();
      await render();
      UI.toast("تم حذف الملاحظة", "success");
    }
  });

  $("btnGps").onclick = captureLocation;
  $("btnSave").onclick = saveNote;
  $("btnCancelEdit").onclick = clearForm;
  $("search").addEventListener("input", render);
  render();
})();

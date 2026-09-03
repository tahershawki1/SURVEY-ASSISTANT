/* تحويل الإحداثيات — كل تحقق من المدخلات يمر عبر وحدة Geo */
(() => {
  const $ = (id) => document.getElementById(id);
  const msgs = $("messages"), head = $("headline"), box = $("result"), bar = $("exportBar");
  let last = null;

  function setMode(m) {
    $("formLL").hidden = m !== "ll";
    $("formUTM").hidden = m !== "utm";
    $("tabLL").className = m === "ll" ? "btn" : "btn secondary";
    $("tabUTM").className = m === "utm" ? "btn" : "btn secondary";
    $("tabLL").setAttribute("aria-pressed", String(m === "ll"));
    $("tabUTM").setAttribute("aria-pressed", String(m === "utm"));
  }

  function fail(message) {
    last = null;
    msgs.innerHTML = UI.messageList([message], "error");
    head.innerHTML = "";
    box.className = "result-box empty";
    box.textContent = "صحّح المدخلات ثم أعد المحاولة";
    bar.hidden = true;
  }

  function rows(list) {
    return list.map(([k, v]) => `<div class="row"><span>${UI.esc(k)}</span><b>${UI.esc(v)}</b></div>`).join("");
  }

  function show(headlineHtml, list, warnings, csvRows, textOut, name) {
    msgs.innerHTML = UI.messageList(warnings, "warn");
    head.innerHTML = headlineHtml;
    box.className = "result-box";
    box.innerHTML = rows(list);
    bar.hidden = false;
    last = { csvRows, textOut, name };
    UI.exportBar(bar, {
      filename: () => `${name}_${UI.stamp()}.csv`,
      rows: () => csvRows,
      text: () => textOut,
    });
  }

  function convertLLtoUTM() {
    const lat = parseFloat($("latIn").value);
    const lon = parseFloat($("lonIn").value);
    const errs = Geo.validateLatLon(lat, lon);
    if (errs.length) return fail(errs.join(" "));
    let r;
    try { r = Geo.latLonToUTM(lat, lon); } catch (e) { return fail(e.message); }

    const warnings = [];
    const naturalZone = Math.floor((Geo.normalizeLon(lon) + 180) / 6) + 1;
    if (r.zone !== naturalZone && naturalZone <= 60) {
      warnings.push(`تنبيه: هذه النقطة تقع في منطقة استثنائية بالمعيار — استُخدمت المنطقة ${r.zone} بدل ${naturalZone}.`);
    }

    const list = [
      ["المنطقة (Zone)", `${r.zone}${r.band || ""} ${r.hemisphere}`],
      ["Easting", `${r.easting.toFixed(3)} m`],
      ["Northing", `${r.northing.toFixed(3)} m`],
      ["زاوية التقارب", `${r.convergence.toFixed(4)}°`],
      ["Latitude (DMS)", Geo.ddToDMS(lat, true)],
      ["Longitude (DMS)", Geo.ddToDMS(lon, false)],
    ];
    show(
      `<div class="headline ok"><span class="k">إحداثيات UTM<span class="sub">المنطقة ${r.zone}${r.band || ""} ${r.hemisphere}</span></span>
       <span class="v">${r.easting.toFixed(2)}<br>${r.northing.toFixed(2)}</span></div>`,
      list, warnings,
      [["Latitude", "Longitude", "Zone", "Band", "Hemisphere", "Easting", "Northing", "Convergence"],
       [lat, lon, r.zone, r.band || "", r.hemisphere, r.easting.toFixed(3), r.northing.toFixed(3), r.convergence.toFixed(6)]],
      list.map(([k, v]) => `${k}: ${v}`).join("\n"),
      "utm"
    );
  }

  function convertUTMtoLL() {
    const e = parseFloat($("eastIn").value);
    const n = parseFloat($("northIn").value);
    const zone = parseInt($("zoneIn").value, 10);
    const hemi = $("hemiIn").value;
    const v = Geo.validateUTM(e, n, zone, hemi);
    if (v.errors.length) return fail(v.errors.join(" "));
    let r;
    try { r = Geo.utmToLatLon(e, n, zone, hemi); } catch (err) { return fail(err.message); }

    const list = [
      ["Latitude", r.lat.toFixed(8)],
      ["Longitude", r.lon.toFixed(8)],
      ["النطاق", r.band || "—"],
      ["Latitude (DMS)", Geo.ddToDMS(r.lat, true)],
      ["Longitude (DMS)", Geo.ddToDMS(r.lon, false)],
    ];
    show(
      `<div class="headline ok"><span class="k">إحداثيات جغرافية<span class="sub">WGS84</span></span>
       <span class="v">${r.lat.toFixed(6)}<br>${r.lon.toFixed(6)}</span></div>`,
      list, v.warnings.concat(r.warnings || []),
      [["Easting", "Northing", "Zone", "Hemisphere", "Latitude", "Longitude"],
       [e, n, zone, hemi, r.lat.toFixed(8), r.lon.toFixed(8)]],
      list.map(([k, val]) => `${k}: ${val}`).join("\n"),
      "latlon"
    );
  }

  $("tabLL").onclick = () => setMode("ll");
  $("tabUTM").onclick = () => setMode("utm");
  $("btnLL").onclick = convertLLtoUTM;
  $("btnUTM").onclick = convertUTMtoLL;
  ["latIn", "lonIn"].forEach((id) => $(id).addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); convertLLtoUTM(); } }));
  ["eastIn", "northIn", "zoneIn"].forEach((id) => $(id).addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); convertUTMtoLL(); } }));
  setMode("ll");
})();

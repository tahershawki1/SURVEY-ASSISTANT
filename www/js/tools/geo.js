/* تحويل الإحداثيات: خط الطول/العرض (WGS84) ⇄ UTM
   الصيغ القياسية (Snyder 1987)، مع استثناءات المناطق المعتمدة في المعيار
   (توسعة المنطقة 32 فوق جنوب النرويج، وإعادة ترتيب المناطق فوق سفالبارد). */

const Geo = (() => {
  const a = 6378137.0; // نصف المحور الأكبر WGS84
  const f = 1 / 298.257223563; // التفلطح
  const k0 = 0.9996;
  const eSq = f * (2 - f);
  const ePrimeSq = eSq / (1 - eSq);

  const MIN_LAT = -80, MAX_LAT = 84;
  const BANDS = "CDEFGHJKLMNPQRSTUVWX";

  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  /* يعيد خط الطول إلى المدى [-180, 180) */
  function normalizeLon(lon) {
    let l = ((lon + 180) % 360 + 360) % 360 - 180;
    return l;
  }

  function zoneOf(lon, lat) {
    const L = normalizeLon(lon);
    let zone = Math.floor((L + 180) / 6) + 1;
    if (zone > 60) zone = 60; // يحدث فقط عند lon = 180 بالضبط

    if (Number.isFinite(lat)) {
      // استثناء جنوب النرويج: المنطقة 32 تمتد غربًا
      if (lat >= 56 && lat < 64 && L >= 3 && L < 12) return 32;
      // استثناءات سفالبارد
      if (lat >= 72 && lat < 84) {
        if (L >= 0 && L < 9) return 31;
        if (L >= 9 && L < 21) return 33;
        if (L >= 21 && L < 33) return 35;
        if (L >= 33 && L < 42) return 37;
      }
    }
    return zone;
  }

  /* حرف نطاق خط العرض (C إلى X، بدون I و O) */
  function latBand(lat) {
    if (!Number.isFinite(lat) || lat < MIN_LAT || lat > MAX_LAT) return null;
    if (lat >= 72) return "X"; // النطاق X بارتفاع 12 درجة
    return BANDS[Math.floor((lat + 80) / 8)];
  }

  function validateLatLon(lat, lon) {
    const errors = [];
    if (!Number.isFinite(lat)) errors.push("خط العرض غير رقمي.");
    else if (lat < MIN_LAT || lat > MAX_LAT) errors.push(`خط العرض يجب أن يقع بين ${MIN_LAT} و ${MAX_LAT} (نظام UTM لا يغطي القطبين).`);
    if (!Number.isFinite(lon)) errors.push("خط الطول غير رقمي.");
    else if (lon < -180 || lon > 180) errors.push("خط الطول يجب أن يقع بين ‎-180 و 180.");
    return errors;
  }

  function validateUTM(easting, northing, zone, hemisphere) {
    const errors = [];
    const warnings = [];
    if (!Number.isFinite(easting)) errors.push("قيمة Easting غير رقمية.");
    else if (easting < 100000 || easting > 900000) errors.push(`قيمة Easting خارج المدى الصالح للمنطقة (100000 – 900000)، المُدخل: ${easting}.`);
    if (!Number.isFinite(northing)) errors.push("قيمة Northing غير رقمية.");
    else if (northing < 0 || northing > 10000000) errors.push(`قيمة Northing خارج المدى الصالح (0 – 10000000)، المُدخل: ${northing}.`);
    if (!Number.isInteger(zone) || zone < 1 || zone > 60) errors.push(`رقم المنطقة يجب أن يكون عددًا صحيحًا بين 1 و 60، المُدخل: ${zone}.`);
    if (hemisphere !== "N" && hemisphere !== "S") errors.push("نصف الكرة يجب أن يكون N أو S.");
    if (Number.isFinite(easting) && Math.abs(easting - 500000) > 320000) {
      warnings.push("النقطة بعيدة عن خط الوسط للمنطقة — تحقق من رقم المنطقة، فقد تكون النقطة في منطقة مجاورة.");
    }
    return { errors, warnings };
  }

  function latLonToUTM(lat, lon, forcedZone) {
    const errors = validateLatLon(lat, lon);
    if (errors.length) throw new RangeError(errors.join(" "));

    const L = normalizeLon(lon);
    const zone = Number.isInteger(forcedZone) && forcedZone >= 1 && forcedZone <= 60 ? forcedZone : zoneOf(L, lat);
    const lonOrigin = (zone - 1) * 6 - 180 + 3;
    const latRad = toRad(lat);
    const lonRad = toRad(L);
    const lonOriginRad = toRad(lonOrigin);

    const N = a / Math.sqrt(1 - eSq * Math.sin(latRad) ** 2);
    const T = Math.tan(latRad) ** 2;
    const C = ePrimeSq * Math.cos(latRad) ** 2;
    const A = Math.cos(latRad) * (lonRad - lonOriginRad);

    const M =
      a *
      ((1 - eSq / 4 - (3 * eSq ** 2) / 64 - (5 * eSq ** 3) / 256) * latRad -
        ((3 * eSq) / 8 + (3 * eSq ** 2) / 32 + (45 * eSq ** 3) / 1024) * Math.sin(2 * latRad) +
        ((15 * eSq ** 2) / 256 + (45 * eSq ** 3) / 1024) * Math.sin(4 * latRad) -
        ((35 * eSq ** 3) / 3072) * Math.sin(6 * latRad));

    const easting =
      k0 * N * (A + ((1 - T + C) * A ** 3) / 6 + ((5 - 18 * T + T ** 2 + 72 * C - 58 * ePrimeSq) * A ** 5) / 120) +
      500000.0;

    let northing =
      k0 *
      (M +
        N * Math.tan(latRad) *
          ((A ** 2) / 2 +
            ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
            ((61 - 58 * T + T ** 2 + 600 * C - 330 * ePrimeSq) * A ** 6) / 720));

    if (lat < 0) northing += 10000000.0;

    return { zone, band: latBand(lat), hemisphere: lat < 0 ? "S" : "N", easting, northing, convergence: convergenceAngle(lat, L, zone) };
  }

  /* زاوية التقارب: الفرق بين الشمال الشبكي والشمال الحقيقي عند النقطة */
  function convergenceAngle(lat, lon, zone) {
    const lonOrigin = (zone - 1) * 6 - 180 + 3;
    return toDeg(Math.atan(Math.tan(toRad(lon - lonOrigin)) * Math.sin(toRad(lat))));
  }

  function utmToLatLon(easting, northing, zone, hemisphere) {
    const v = validateUTM(easting, northing, zone, hemisphere);
    if (v.errors.length) throw new RangeError(v.errors.join(" "));

    const x = easting - 500000.0;
    let y = northing;
    if (hemisphere === "S") y -= 10000000.0;

    const lonOrigin = (zone - 1) * 6 - 180 + 3;
    const M = y / k0;
    const mu = M / (a * (1 - eSq / 4 - (3 * eSq ** 2) / 64 - (5 * eSq ** 3) / 256));
    const e1 = (1 - Math.sqrt(1 - eSq)) / (1 + Math.sqrt(1 - eSq));

    const phi1 =
      mu +
      ((3 * e1) / 2 - (27 * e1 ** 3) / 32) * Math.sin(2 * mu) +
      ((21 * e1 ** 2) / 16 - (55 * e1 ** 4) / 32) * Math.sin(4 * mu) +
      ((151 * e1 ** 3) / 96) * Math.sin(6 * mu) +
      ((1097 * e1 ** 4) / 512) * Math.sin(8 * mu);

    const N1 = a / Math.sqrt(1 - eSq * Math.sin(phi1) ** 2);
    const T1 = Math.tan(phi1) ** 2;
    const C1 = ePrimeSq * Math.cos(phi1) ** 2;
    const R1 = (a * (1 - eSq)) / Math.pow(1 - eSq * Math.sin(phi1) ** 2, 1.5);
    const D = x / (N1 * k0);

    let lat =
      phi1 -
      ((N1 * Math.tan(phi1)) / R1) *
        ((D ** 2) / 2 -
          ((5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ePrimeSq) * D ** 4) / 24 +
          ((61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ePrimeSq - 3 * C1 ** 2) * D ** 6) / 720);
    lat = toDeg(lat);

    let lon =
      (D -
        ((1 + 2 * T1 + C1) * D ** 3) / 6 +
        ((5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ePrimeSq + 24 * T1 ** 2) * D ** 5) / 120) /
      Math.cos(phi1);
    lon = lonOrigin + toDeg(lon);

    return { lat, lon: normalizeLon(lon), band: latBand(lat), warnings: v.warnings };
  }

  /* تحويل الدرجات العشرية إلى درجات/دقائق/ثوانٍ مع ترحيل التقريب
     (بدون الترحيل تظهر قراءات مستحيلة مثل 59' 60.00") */
  function ddToDMS(dd, isLat, decimals = 2) {
    if (!Number.isFinite(dd)) return "—";
    const dir = isLat ? (dd >= 0 ? "N" : "S") : dd >= 0 ? "E" : "W";
    let abs = Math.abs(dd);
    let deg = Math.floor(abs);
    let minFloat = (abs - deg) * 60;
    let min = Math.floor(minFloat);
    let sec = (minFloat - min) * 60;

    const p = Math.pow(10, decimals);
    sec = Math.round(sec * p) / p;
    if (sec >= 60) { sec -= 60; min += 1; }
    if (min >= 60) { min -= 60; deg += 1; }

    return `${deg}° ${min}' ${sec.toFixed(decimals)}" ${dir}`;
  }

  return { zoneOf, latBand, normalizeLon, validateLatLon, validateUTM, latLonToUTM, utmToLatLon, ddToDMS, convergenceAngle, MIN_LAT, MAX_LAT };
})();

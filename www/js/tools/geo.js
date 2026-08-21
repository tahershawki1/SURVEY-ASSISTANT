/* تحويل الإحداثيات: خط الطول/العرض (WGS84) ⇄ UTM
   الصيغ القياسية (Snyder 1987) المستخدمة في أغلب مكتبات UTM المفتوحة المصدر. */

const Geo = (() => {
  const a = 6378137.0; // نصف المحور الأكبر WGS84
  const f = 1 / 298.257223563; // التفلطح
  const k0 = 0.9996;
  const eSq = f * (2 - f);
  const ePrimeSq = eSq / (1 - eSq);

  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  function zoneOf(lon) {
    return Math.floor((lon + 180) / 6) + 1;
  }

  function latLonToUTM(lat, lon) {
    const zone = zoneOf(lon);
    const lonOrigin = (zone - 1) * 6 - 180 + 3;
    const latRad = toRad(lat);
    const lonRad = toRad(lon);
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

    let easting =
      k0 *
        N *
        (A +
          ((1 - T + C) * A ** 3) / 6 +
          ((5 - 18 * T + T ** 2 + 72 * C - 58 * ePrimeSq) * A ** 5) / 120) +
      500000.0;

    let northing =
      k0 *
      (M +
        N *
          Math.tan(latRad) *
          ((A ** 2) / 2 +
            ((5 - T + 9 * C + 4 * C ** 2) * A ** 4) / 24 +
            ((61 - 58 * T + T ** 2 + 600 * C - 330 * ePrimeSq) * A ** 6) / 720));

    if (lat < 0) northing += 10000000.0;

    return {
      zone,
      hemisphere: lat < 0 ? "S" : "N",
      easting,
      northing,
    };
  }

  function utmToLatLon(easting, northing, zone, hemisphere) {
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

    return { lat, lon };
  }

  function ddToDMS(dd, isLat) {
    const dir = isLat ? (dd >= 0 ? "N" : "S") : dd >= 0 ? "E" : "W";
    const abs = Math.abs(dd);
    const deg = Math.floor(abs);
    const minFloat = (abs - deg) * 60;
    const min = Math.floor(minFloat);
    const sec = (minFloat - min) * 60;
    return `${deg}° ${min}' ${sec.toFixed(2)}" ${dir}`;
  }

  return { zoneOf, latLonToUTM, utmToLatLon, ddToDMS };
})();

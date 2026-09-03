/* تسوية المضلعات المساحية
   legs: [{ azimuth: بالدرجات من الشمال باتجاه عقارب الساعة, distance: بالمتر }]
   start: { x, y } — نقطة البداية المعروفة
   closeTo: { x, y } — نقطة الإغلاق (تساوي start في المضلع المغلق)
   طريقتان: Bowditch (قاعدة البوصلة) و Transit (قاعدة العبور). */

const Traverse = (() => {
  const toRad = (d) => (d * Math.PI) / 180;
  const toDeg = (r) => (r * 180) / Math.PI;

  /* يعيد الأزيموث إلى المدى [0, 360) */
  function normalizeAzimuth(az) {
    const a = az % 360;
    return a < 0 ? a + 360 : a;
  }

  function validate(start, legs, closeTo, { isClosed = true } = {}) {
    const errors = [];
    const warnings = [];

    if (!start || !Number.isFinite(start.x) || !Number.isFinite(start.y)) {
      errors.push("إحداثيات نقطة البداية غير صالحة.");
    }
    if (!isClosed && (!closeTo || !Number.isFinite(closeTo.x) || !Number.isFinite(closeTo.y))) {
      errors.push("إحداثيات نقطة الإغلاق غير صالحة.");
    }

    const list = Array.isArray(legs) ? legs : [];
    const usable = list.filter((l) => Number.isFinite(l.distance) && l.distance > 0);

    list.forEach((leg, i) => {
      if (!Number.isFinite(leg.azimuth)) errors.push(`الضلع ${i + 1}: الأزيموث غير رقمي.`);
      if (!Number.isFinite(leg.distance)) errors.push(`الضلع ${i + 1}: المسافة غير رقمية.`);
      else if (leg.distance < 0) errors.push(`الضلع ${i + 1}: المسافة سالبة (${leg.distance}) — المسافة المرصودة لا تكون سالبة.`);
      else if (leg.distance === 0) warnings.push(`الضلع ${i + 1}: المسافة صفر وتم تجاهله.`);
      if (Number.isFinite(leg.azimuth) && (leg.azimuth < 0 || leg.azimuth >= 360)) {
        warnings.push(`الضلع ${i + 1}: الأزيموث ${leg.azimuth}° خارج المدى 0–360 وتمت معايرته إلى ${normalizeAzimuth(leg.azimuth).toFixed(4)}°.`);
      }
    });

    if (usable.length === 0) {
      errors.push("لم تُدخل أي أضلاع بمسافة أكبر من صفر.");
    } else if (isClosed && usable.length < 3) {
      errors.push(`المضلع المغلق يحتاج 3 أضلاع على الأقل (المُدخل: ${usable.length}).`);
    }

    return { errors, warnings, usable };
  }

  function compute(start, legs, closeTo, options = {}) {
    const { method = "bowditch", isClosed = closeTo === undefined || closeTo === null } = options;
    const target = closeTo || start;
    const v = validate(start, legs, closeTo, { isClosed });

    if (v.errors.length) {
      return { ok: false, errors: v.errors, warnings: v.warnings, legs: [], points: [], sumDist: 0,
               errorLat: null, errorDep: null, misclosure: null, precision: null, method };
    }

    let sumLat = 0, sumDep = 0, sumDist = 0;
    let sumAbsLat = 0, sumAbsDep = 0;

    const raw = v.usable.map((leg) => {
      const azimuth = normalizeAzimuth(leg.azimuth);
      const az = toRad(azimuth);
      const dLat = leg.distance * Math.cos(az); // ΔNorthing
      const dDep = leg.distance * Math.sin(az); // ΔEasting
      sumLat += dLat; sumDep += dDep; sumDist += leg.distance;
      sumAbsLat += Math.abs(dLat); sumAbsDep += Math.abs(dDep);
      return { ...leg, azimuth, dLat, dDep };
    });

    const targetDLat = target.y - start.y;
    const targetDDep = target.x - start.x;
    const errorLat = sumLat - targetDLat;
    const errorDep = sumDep - targetDDep;
    const misclosure = Math.hypot(errorLat, errorDep);
    const precision = misclosure > 1e-12 ? sumDist / misclosure : Infinity;
    const misclosureBearing = misclosure > 1e-12 ? normalizeAzimuth(toDeg(Math.atan2(-errorDep, -errorLat))) : null;

    let running = { x: start.x, y: start.y };
    const points = [{ ...running }];

    const adjusted = raw.map((leg) => {
      let corrLat, corrDep;
      if (method === "transit") {
        // قاعدة العبور: التصحيح يتناسب مع مركّبة الضلع نفسها (تُستخدم عندما تكون
        // الزوايا أدقّ من المسافات)
        corrLat = sumAbsLat > 0 ? -errorLat * (Math.abs(leg.dLat) / sumAbsLat) : 0;
        corrDep = sumAbsDep > 0 ? -errorDep * (Math.abs(leg.dDep) / sumAbsDep) : 0;
      } else {
        // قاعدة البوصلة (Bowditch): التصحيح يتناسب مع طول الضلع
        corrLat = -errorLat * (leg.distance / sumDist);
        corrDep = -errorDep * (leg.distance / sumDist);
      }
      const adjLat = leg.dLat + corrLat;
      const adjDep = leg.dDep + corrDep;
      running = { x: running.x + adjDep, y: running.y + adjLat };
      points.push({ ...running });
      return { ...leg, corrLat, corrDep, adjLat, adjDep };
    });

    return {
      ok: true, errors: [], warnings: v.warnings, method,
      legs: adjusted, sumDist, errorLat, errorDep, misclosure, misclosureBearing, precision, points, isClosed,
    };
  }

  /* تسوية خطأ الإغلاق الزاوي وحساب الأزيموثات المصححة من الزوايا المرصودة.
     angles: الزوايا الداخلية المرصودة بالدرجات، startAzimuth: أزيموث الضلع الأول. */
  function adjustAngles(angles, startAzimuth, { isClosed = true, interior = true } = {}) {
    const errors = [];
    const list = (angles || []).map(Number);
    if (list.some((a) => !Number.isFinite(a))) errors.push("توجد زاوية غير رقمية.");
    if (!Number.isFinite(startAzimuth)) errors.push("أزيموث الضلع الأول غير صالح.");
    const n = list.length;
    if (isClosed && n < 3) errors.push(`المضلع المغلق يحتاج 3 زوايا على الأقل (المُدخل: ${n}).`);
    if (errors.length) return { ok: false, errors, angles: [], azimuths: [] };

    const theoretical = interior ? (n - 2) * 180 : (n + 2) * 180;
    const observed = list.reduce((a, b) => a + b, 0);
    const angularMisclosure = isClosed ? observed - theoretical : 0;
    const correction = isClosed ? -angularMisclosure / n : 0;
    const adjustedAngles = list.map((a) => a + correction);

    // اشتقاق الأزيموثات: أزيموث التالي = أزيموث السابق + الزاوية − 180
    const azimuths = [normalizeAzimuth(startAzimuth)];
    for (let i = 1; i < n; i++) {
      azimuths.push(normalizeAzimuth(azimuths[i - 1] + adjustedAngles[i] - 180));
    }

    return {
      ok: true, errors: [], observed, theoretical, angularMisclosure, correction,
      angles: adjustedAngles, azimuths,
      allowable: 60 * Math.sqrt(n) / 3600, // ±60″√n بالدرجات، معيار شائع
    };
  }

  return { compute, validate, adjustAngles, normalizeAzimuth };
})();

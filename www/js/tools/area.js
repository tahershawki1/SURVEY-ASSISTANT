/* حساب المساحة والمحيط (صيغة Shoelace) والمسافة/الأزيموث بين النقاط
   الإحداثيات المدخلة مسقطة (Easting/Northing) بالمتر */

const AreaCalc = (() => {
  // 1 فدان = 4200.833 م² ، الفدان = 24 قيراطًا ، القيراط = 24 سهمًا
  const FEDDAN_M2 = 4200.833;
  const QIRAT_M2 = FEDDAN_M2 / 24;
  const SAHM_M2 = QIRAT_M2 / 24;

  function distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  function azimuth(p1, p2) {
    const dE = p2.x - p1.x;
    const dN = p2.y - p1.y;
    if (dE === 0 && dN === 0) return null; // نقطتان متطابقتان: لا اتجاه معرّف
    let az = (Math.atan2(dE, dN) * 180) / Math.PI;
    if (az < 0) az += 360;
    return az;
  }

  function signedArea(points) {
    let sum = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      sum += p1.x * p2.y - p2.x * p1.y;
    }
    return sum / 2;
  }

  function polygonArea(points) {
    return Math.abs(signedArea(points));
  }

  function perimeterClosed(points) {
    let per = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) per += distance(points[i], points[(i + 1) % n]);
    return per;
  }

  function perimeterOpen(points) {
    let per = 0;
    for (let i = 0; i < points.length - 1; i++) per += distance(points[i], points[i + 1]);
    return per;
  }

  /* ---- كشف التقاطع الذاتي: مضلع متقاطع يُعطي مساحة خاطئة بصيغة Shoelace ---- */
  function orient(a, b, c) {
    const v = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
    if (Math.abs(v) < 1e-12) return 0;
    return v > 0 ? 1 : 2;
  }

  function onSegment(a, b, c) {
    return (
      Math.min(a.x, c.x) - 1e-12 <= b.x && b.x <= Math.max(a.x, c.x) + 1e-12 &&
      Math.min(a.y, c.y) - 1e-12 <= b.y && b.y <= Math.max(a.y, c.y) + 1e-12
    );
  }

  function segmentsIntersect(p1, q1, p2, q2) {
    const o1 = orient(p1, q1, p2), o2 = orient(p1, q1, q2);
    const o3 = orient(p2, q2, p1), o4 = orient(p2, q2, q1);
    if (o1 !== o2 && o3 !== o4) return true;
    if (o1 === 0 && onSegment(p1, p2, q1)) return true;
    if (o2 === 0 && onSegment(p1, q2, q1)) return true;
    if (o3 === 0 && onSegment(p2, p1, q2)) return true;
    if (o4 === 0 && onSegment(p2, q1, q2)) return true;
    return false;
  }

  /* يُرجع قائمة أزواج الأضلاع المتقاطعة (بأرقام تبدأ من 1) */
  function findSelfIntersections(points) {
    const n = points.length;
    const hits = [];
    if (n < 4) return hits;
    for (let i = 0; i < n; i++) {
      const a1 = points[i], a2 = points[(i + 1) % n];
      for (let j = i + 1; j < n; j++) {
        // الأضلاع المتجاورة تشترك في نقطة طرفية — نتجاهلها
        if (j === i) continue;
        if ((j + 1) % n === i || (i + 1) % n === j) continue;
        const b1 = points[j], b2 = points[(j + 1) % n];
        if (segmentsIntersect(a1, a2, b1, b2)) hits.push([i + 1, j + 1]);
      }
    }
    return hits;
  }

  function isSelfIntersecting(points) {
    return findSelfIntersections(points).length > 0;
  }

  function duplicatePoints(points) {
    const dups = [];
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        if (distance(points[i], points[j]) < 1e-9) dups.push([i + 1, j + 1]);
      }
    }
    return dups;
  }

  /* التحليل الكامل مع التحقق — هذا ما تستدعيه الواجهة */
  function analyze(points) {
    const errors = [];
    const warnings = [];
    const pts = (points || []).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));

    if (pts.length !== (points || []).length) errors.push("توجد نقطة بإحداثيات غير رقمية.");
    if (pts.length < 2) {
      errors.push("أضف نقطتين على الأقل.");
      return { ok: false, errors, warnings };
    }

    duplicatePoints(pts).forEach(([a, b]) => warnings.push(`النقطتان ${a} و ${b} متطابقتان.`));

    const openPerimeter = perimeterOpen(pts);
    const lastLeg = pts.length >= 2
      ? { distance: distance(pts[pts.length - 2], pts[pts.length - 1]), azimuth: azimuth(pts[pts.length - 2], pts[pts.length - 1]) }
      : null;

    if (pts.length < 3) {
      return { ok: true, errors, warnings, points: pts, openPerimeter, lastLeg, area: null, closedPerimeter: null, selfIntersections: [] };
    }

    const selfIntersections = findSelfIntersections(pts);
    if (selfIntersections.length) {
      errors.push(
        `المضلع يتقاطع مع نفسه عند الأضلاع: ${selfIntersections.map(([a, b]) => `${a}×${b}`).join("، ")}. ` +
        "المساحة المحسوبة بهذا الترتيب غير صحيحة — أعد ترتيب النقاط بحيث تسير على محيط القطعة بالتتابع."
      );
      return { ok: false, errors, warnings, points: pts, openPerimeter, lastLeg, selfIntersections };
    }

    const signed = signedArea(pts);
    const area = Math.abs(signed);
    if (area < 1e-9) warnings.push("المساحة الناتجة صفر تقريبًا — النقاط تقع على استقامة واحدة.");

    return {
      ok: true, errors, warnings, points: pts,
      area, signedArea: signed,
      orientation: signed > 0 ? "عكس عقارب الساعة" : "مع عقارب الساعة",
      closedPerimeter: perimeterClosed(pts),
      openPerimeter, lastLeg, selfIntersections: [],
      units: {
        m2: area,
        hectare: area / 10000,
        feddan: area / FEDDAN_M2,
        qirat: (area % FEDDAN_M2) / QIRAT_M2,
        sahm: ((area % FEDDAN_M2) % QIRAT_M2) / SAHM_M2,
        acre: area / 4046.8564224,
      },
    };
  }

  /* صياغة المساحة بالنظام المصري: فدان — قيراط — سهم */
  function formatFeddan(m2) {
    const f = Math.floor(m2 / FEDDAN_M2);
    const restF = m2 - f * FEDDAN_M2;
    const q = Math.floor(restF / QIRAT_M2);
    const restQ = restF - q * QIRAT_M2;
    const s = restQ / SAHM_M2;
    return { feddan: f, qirat: q, sahm: s, text: `${f} ف ${q} ط ${s.toFixed(1)} س` };
  }

  return {
    distance, azimuth, polygonArea, signedArea, perimeterClosed, perimeterOpen,
    findSelfIntersections, isSelfIntersecting, duplicatePoints, analyze, formatFeddan,
    FEDDAN_M2, QIRAT_M2, SAHM_M2,
  };
})();

/* حساب المساحة والمحيط (صيغة Shoelace) والمسافة/الأزيموث بين نقطتين
   الإحداثيات المدخلة هي إحداثيات مسقطة (Easting/Northing) بالمتر */

const AreaCalc = (() => {
  function distance(p1, p2) {
    return Math.hypot(p2.x - p1.x, p2.y - p1.y);
  }

  function azimuth(p1, p2) {
    const dE = p2.x - p1.x;
    const dN = p2.y - p1.y;
    let az = (Math.atan2(dE, dN) * 180) / Math.PI;
    if (az < 0) az += 360;
    return az;
  }

  function polygonArea(points) {
    let sum = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % n];
      sum += p1.x * p2.y - p2.x * p1.y;
    }
    return Math.abs(sum) / 2;
  }

  function perimeterClosed(points) {
    let per = 0;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      per += distance(points[i], points[(i + 1) % n]);
    }
    return per;
  }

  function perimeterOpen(points) {
    let per = 0;
    for (let i = 0; i < points.length - 1; i++) {
      per += distance(points[i], points[i + 1]);
    }
    return per;
  }

  return { distance, azimuth, polygonArea, perimeterClosed, perimeterOpen };
})();

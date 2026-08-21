/* تسوية المضلعات المساحية بقاعدة Bowditch (Compass Rule)
   legs: [{ azimuth: deg 0-360 من الشمال باتجاه عقارب الساعة, distance: m }]
   start: { x, y } — نقطة البداية المعروفة
   closeTo: { x, y } — نقطة الإغلاق (تساوي start في حالة مضلع مغلق) */

const Traverse = (() => {
  const toRad = (d) => (d * Math.PI) / 180;

  function compute(start, legs, closeTo) {
    closeTo = closeTo || start;

    let sumLat = 0,
      sumDep = 0,
      sumDist = 0;

    const raw = legs.map((leg) => {
      const az = toRad(leg.azimuth);
      const dLat = leg.distance * Math.cos(az); // ΔNorthing
      const dDep = leg.distance * Math.sin(az); // ΔEasting
      sumLat += dLat;
      sumDep += dDep;
      sumDist += leg.distance;
      return { ...leg, dLat, dDep };
    });

    const targetDLat = closeTo.y - start.y;
    const targetDDep = closeTo.x - start.x;

    const errorLat = sumLat - targetDLat;
    const errorDep = sumDep - targetDDep;
    const misclosure = Math.hypot(errorLat, errorDep);
    const precision = misclosure > 0 ? sumDist / misclosure : Infinity;

    let running = { x: start.x, y: start.y };
    const points = [{ ...running }];

    const adjusted = raw.map((leg) => {
      const corrLat = sumDist > 0 ? -errorLat * (leg.distance / sumDist) : 0;
      const corrDep = sumDist > 0 ? -errorDep * (leg.distance / sumDist) : 0;
      const adjLat = leg.dLat + corrLat;
      const adjDep = leg.dDep + corrDep;
      running = { x: running.x + adjDep, y: running.y + adjLat };
      points.push({ ...running });
      return { ...leg, corrLat, corrDep, adjLat, adjDep };
    });

    return {
      legs: adjusted,
      sumDist,
      errorLat,
      errorDep,
      misclosure,
      precision,
      points,
    };
  }

  return { compute };
})();

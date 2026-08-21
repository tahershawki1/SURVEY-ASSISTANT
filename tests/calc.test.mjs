import fs from "fs";
import vm from "vm";

function loadIIFE(path, name) {
  const code = fs.readFileSync(path, "utf8");
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext(code + `\nglobalThis.__EXPORT__ = ${name};`, ctx);
  return ctx.__EXPORT__;
}

const Geo = loadIIFE("www/js/tools/geo.js", "Geo");
const AreaCalc = loadIIFE("www/js/tools/area.js", "AreaCalc");
const Leveling = loadIIFE("www/js/tools/leveling.js", "Leveling");
const Traverse = loadIIFE("www/js/tools/traverse.js", "Traverse");
const LevelCheck = loadIIFE("www/js/tools/levelcheck.js", "LevelCheck");

let failures = 0;
function check(name, cond, detail) {
  if (!cond) {
    failures++;
    console.log(`❌ ${name} ${detail || ""}`);
  } else {
    console.log(`✅ ${name}`);
  }
}

// ---- Geo round trip ----
const riyadh = { lat: 24.7136, lon: 46.6753 };
const utm = Geo.latLonToUTM(riyadh.lat, riyadh.lon);
check("Geo zone Riyadh = 38", utm.zone === 38, JSON.stringify(utm));
const back = Geo.utmToLatLon(utm.easting, utm.northing, utm.zone, utm.hemisphere);
check(
  "Geo round-trip lat",
  Math.abs(back.lat - riyadh.lat) < 1e-6,
  `${back.lat} vs ${riyadh.lat}`
);
check(
  "Geo round-trip lon",
  Math.abs(back.lon - riyadh.lon) < 1e-6,
  `${back.lon} vs ${riyadh.lon}`
);

// ---- Area: unit square 10x10 ----
const sq = [
  { x: 0, y: 0 },
  { x: 0, y: 10 },
  { x: 10, y: 10 },
  { x: 10, y: 0 },
];
const area = AreaCalc.polygonArea(sq);
check("Area square = 100", Math.abs(area - 100) < 1e-9, area);
const per = AreaCalc.perimeterClosed(sq);
check("Perimeter square = 40", Math.abs(per - 40) < 1e-9, per);
const az = AreaCalc.azimuth({ x: 0, y: 0 }, { x: 10, y: 0 });
check("Azimuth due East = 90", Math.abs(az - 90) < 1e-9, az);

// ---- Leveling: BM=100, BS=1.500 at BM, FS=1.000 at P1 -> RL P1 = 100.5 ----
const lvl = Leveling.reduce(100, [
  { station: "BM", bs: 1.5, is: "", fs: "" },
  { station: "P1", bs: "", is: "", fs: 1.0 },
]);
check(
  "Leveling RL P1 = 100.5",
  Math.abs(lvl.rows[1].RL - 100.5) < 1e-9,
  JSON.stringify(lvl.rows)
);
check("Leveling misclosure ~ 0", Math.abs(lvl.misclosure) < 1e-9, lvl.misclosure);

// ---- Traverse: closed square, 4 legs of 10m, azimuths 90,180,270,0 ----
const trav = Traverse.compute(
  { x: 0, y: 0 },
  [
    { azimuth: 90, distance: 10 },
    { azimuth: 180, distance: 10 },
    { azimuth: 270, distance: 10 },
    { azimuth: 0, distance: 10 },
  ]
);
check("Traverse misclosure ~ 0", trav.misclosure < 1e-9, trav.misclosure);
check(
  "Traverse closes back to start",
  Math.abs(trav.points[4].x) < 1e-9 && Math.abs(trav.points[4].y) < 1e-9,
  JSON.stringify(trav.points[4])
);

// ---- LevelCheck: BM=100, BS=1.500 -> HI=101.5, target=100.2 ----
const HI = LevelCheck.computeHI(100, 1.5);
check("LevelCheck HI = 101.5", Math.abs(HI - 101.5) < 1e-9, HI);

const matchRes = LevelCheck.checkReading(HI, 100.2, 1.3); // actualRL = 100.2 -> مطابق
check("LevelCheck match status", matchRes.status === "match", JSON.stringify(matchRes));

const highRes = LevelCheck.checkReading(HI, 100.2, 1.1); // actualRL = 100.4 -> أعلى بـ 200مم
check(
  "LevelCheck high status + diffMM",
  highRes.status === "high" && Math.abs(highRes.diffMM - 200) < 1e-6,
  JSON.stringify(highRes)
);

const lowRes = LevelCheck.checkReading(HI, 100.2, 1.5); // actualRL = 100.0 -> أقل بـ 200مم
check(
  "LevelCheck low status + diffMM",
  lowRes.status === "low" && Math.abs(lowRes.diffMM + 200) < 1e-6,
  JSON.stringify(lowRes)
);

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);

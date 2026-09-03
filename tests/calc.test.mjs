/* اختبارات الوحدات الحسابية — تغطي الحالات الطبيعية والحالات الحدّية التي
   كانت تُنتج أرقامًا خاطئة بصمت قبل الإصلاح. */
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

let failures = 0, passes = 0;
function check(name, cond, detail) {
  if (!cond) { failures++; console.log(`❌ ${name} ${detail !== undefined ? "→ " + detail : ""}`); }
  else { passes++; console.log(`✅ ${name}`); }
}
const near = (a, b, eps = 1e-9) => Math.abs(a - b) < eps;
function throws(name, fn, re) {
  try { fn(); check(name, false, "لم يُرفض المدخل"); }
  catch (e) { check(name, re ? re.test(e.message) : true, e.message); }
}
const section = (t) => console.log(`\n── ${t} ──`);

/* ==================== Geo ==================== */
section("تحويل الإحداثيات");
const riyadh = { lat: 24.7136, lon: 46.6753 };
const utm = Geo.latLonToUTM(riyadh.lat, riyadh.lon);
check("منطقة الرياض = 38", utm.zone === 38, utm.zone);
check("نطاق خط العرض = R", utm.band === "R", utm.band);
const back = Geo.utmToLatLon(utm.easting, utm.northing, utm.zone, utm.hemisphere);
check("الذهاب والعودة — خط العرض", near(back.lat, riyadh.lat, 1e-7), back.lat);
check("الذهاب والعودة — خط الطول", near(back.lon, riyadh.lon, 1e-7), back.lon);

// نقطة مرجعية معروفة: مقارنة مع القيم القياسية للمنطقة 31N عند خط الوسط
const mid = Geo.latLonToUTM(0, 3);
check("عند خط الاستواء وخط الوسط: E=500000", near(mid.easting, 500000, 1e-6), mid.easting);
check("عند خط الاستواء: N=0", near(mid.northing, 0, 1e-6), mid.northing);

const south = Geo.latLonToUTM(-33.8688, 151.2093); // سيدني
check("نصف الكرة الجنوبي: إزاحة 10,000,000", south.hemisphere === "S" && south.northing > 6e6, south.northing);
const southBack = Geo.utmToLatLon(south.easting, south.northing, south.zone, "S");
check("الذهاب والعودة في الجنوب", near(southBack.lat, -33.8688, 1e-7) && near(southBack.lon, 151.2093, 1e-7), `${southBack.lat}, ${southBack.lon}`);

// CALC-08: منطقة 61 غير موجودة
check("خط الطول 180 → المنطقة 1 لا 61", Geo.zoneOf(180) === 1, Geo.zoneOf(180));
check("خط الطول 179.9 → المنطقة 60", Geo.zoneOf(179.9) === 60, Geo.zoneOf(179.9));
check("خط الطول -180 → المنطقة 1", Geo.zoneOf(-180) === 1, Geo.zoneOf(-180));

// CALC-09: استثناءات المعيار
check("استثناء جنوب النرويج: 60.5N 5E → 32", Geo.latLonToUTM(60.5, 5).zone === 32, Geo.latLonToUTM(60.5, 5).zone);
check("سفالبارد: 78N 5E → 31", Geo.latLonToUTM(78, 5).zone === 31);
check("سفالبارد: 78N 20E → 33", Geo.latLonToUTM(78, 20).zone === 33);
check("سفالبارد: 78N 25E → 35", Geo.latLonToUTM(78, 25).zone === 35);
check("سفالبارد: 78N 35E → 37", Geo.latLonToUTM(78, 35).zone === 37);

// CALC-10: التحقق من المدخلات
throws("خط عرض 90 يُرفض", () => Geo.latLonToUTM(90, 30), /خط العرض/);
throws("خط عرض -85 يُرفض", () => Geo.latLonToUTM(-85, 30), /خط العرض/);
throws("خط عرض غير رقمي يُرفض", () => Geo.latLonToUTM(NaN, 30), /غير رقمي/);
throws("Easting = 0 يُرفض", () => Geo.utmToLatLon(0, 0, 38, "N"), /Easting/);
throws("المنطقة 61 تُرفض", () => Geo.utmToLatLon(5e5, 1e6, 61, "N"), /1 و 60/);
throws("المنطقة 0 تُرفض", () => Geo.utmToLatLon(5e5, 1e6, 0, "N"), /1 و 60/);
throws("نصف كرة غير صالح يُرفض", () => Geo.utmToLatLon(5e5, 1e6, 38, "X"), /N أو S/);

// CALC-11: ترحيل تقريب DMS
check("DMS: 1.99999999 → 2° 0' 0.00\"", Geo.ddToDMS(1.99999999, true) === `2° 0' 0.00" N`, Geo.ddToDMS(1.99999999, true));
check("DMS: 0.999999999 → 1° 0' 0.00\"", Geo.ddToDMS(0.999999999, true) === `1° 0' 0.00" N`, Geo.ddToDMS(0.999999999, true));
check("DMS: 59.9999999 → 60° 0' 0.00\"", Geo.ddToDMS(59.9999999, true) === `60° 0' 0.00" N`, Geo.ddToDMS(59.9999999, true));
check("DMS عادي يبقى صحيحًا", Geo.ddToDMS(24.7136, true) === `24° 42' 48.96" N`, Geo.ddToDMS(24.7136, true));
check("DMS للاتجاه الجنوبي", Geo.ddToDMS(-24.5, true).endsWith("S"), Geo.ddToDMS(-24.5, true));
check("لا تظهر 60 ثانية أبدًا", !/60\.00"/.test(Geo.ddToDMS(1.99999999, true)));

/* ==================== المساحات ==================== */
section("المساحات والمسافات");
const sq = [{ x: 0, y: 0 }, { x: 0, y: 10 }, { x: 10, y: 10 }, { x: 10, y: 0 }];
check("مساحة المربع = 100", near(AreaCalc.polygonArea(sq), 100), AreaCalc.polygonArea(sq));
check("محيط المربع = 40", near(AreaCalc.perimeterClosed(sq), 40), AreaCalc.perimeterClosed(sq));
check("الأزيموث شرقًا = 90", near(AreaCalc.azimuth({ x: 0, y: 0 }, { x: 10, y: 0 }), 90));
check("الأزيموث شمالًا = 0", near(AreaCalc.azimuth({ x: 0, y: 0 }, { x: 0, y: 10 }), 0));
check("الأزيموث جنوبًا = 180", near(AreaCalc.azimuth({ x: 0, y: 0 }, { x: 0, y: -10 }), 180));
check("الأزيموث غربًا = 270", near(AreaCalc.azimuth({ x: 0, y: 0 }, { x: -10, y: 0 }), 270));
check("نقطتان متطابقتان: لا أزيموث", AreaCalc.azimuth({ x: 1, y: 1 }, { x: 1, y: 1 }) === null);

// CALC-07: التقاطع الذاتي
const bow = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 10, y: 0 }, { x: 0, y: 10 }];
check("كشف المضلع المتقاطع (bow-tie)", AreaCalc.isSelfIntersecting(bow));
const bowA = AreaCalc.analyze(bow);
check("التحليل يرفض المضلع المتقاطع", bowA.ok === false && /يتقاطع مع نفسه/.test(bowA.errors[0]));
check("المضلع السليم لا يُعلَّم كمتقاطع", !AreaCalc.isSelfIntersecting(sq));
const penta = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 50, y: 150 }, { x: 0, y: 100 }];
check("الخماسي السليم يُقبل", AreaCalc.analyze(penta).ok && near(AreaCalc.analyze(penta).area, 12500));

const sqA = AreaCalc.analyze(sq);
check("التحليل يعطي مساحة المربع", near(sqA.area, 100));
check("اتجاه الترقيم مكتشف", typeof sqA.orientation === "string" && sqA.orientation.length > 0, sqA.orientation);
check("نقطة واحدة تُرفض", AreaCalc.analyze([{ x: 0, y: 0 }]).ok === false);
check("النقاط على استقامة واحدة تُحذَّر", AreaCalc.analyze([{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }]).warnings.length > 0);
check("النقاط المكررة تُحذَّر", AreaCalc.analyze([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }]).warnings.length > 0);

// وحدات المساحة المصرية
const fed = AreaCalc.formatFeddan(AreaCalc.FEDDAN_M2);
check("فدان واحد = 1 ف 0 ط 0 س", fed.feddan === 1 && fed.qirat === 0 && near(fed.sahm, 0, 1e-6), fed.text);
const q3 = AreaCalc.formatFeddan(AreaCalc.QIRAT_M2 * 3);
check("ثلاثة قراريط", q3.feddan === 0 && q3.qirat === 3, q3.text);
check("الفدان = 24 قيراطًا", near(AreaCalc.FEDDAN_M2 / AreaCalc.QIRAT_M2, 24));
check("القيراط = 24 سهمًا", near(AreaCalc.QIRAT_M2 / AreaCalc.SAHM_M2, 24));

/* ==================== الميزانية ==================== */
section("حسابات الميزانية");
const simple = Leveling.reduce(100, [{ station: "BM", bs: 1.5 }, { station: "P1", fs: 1.0 }]);
check("منسوب P1 = 100.5", near(simple.rows[1].RL, 100.5), simple.rows[1].RL);
check("خطأ الإغلاق = 0", near(simple.misclosure, 0), simple.misclosure);

// دفتر ميزانية حقيقي بمحطتين ونقطة تغيير
const book = Leveling.reduce(50, [
  { station: "BM", bs: 2.191 }, { station: "A", is: 1.505 }, { station: "B", is: 2.325 },
  { station: "CP1", fs: 1.098, bs: 2.512 }, { station: "C", is: 1.875 }, { station: "BM2", fs: 1.505 },
]);
check("دفتر حقيقي: منسوب A", near(book.rows[1].RL, 50.686, 1e-6), book.rows[1].RL);
check("دفتر حقيقي: منسوب B", near(book.rows[2].RL, 49.866, 1e-6), book.rows[2].RL);
check("دفتر حقيقي: نقطة التغيير CP1", near(book.rows[3].RL, 51.093, 1e-6), book.rows[3].RL);
check("دفتر حقيقي: منسوب C", near(book.rows[4].RL, 51.730, 1e-6), book.rows[4].RL);
check("دفتر حقيقي: منسوب الإغلاق", near(book.rows[5].RL, 52.100, 1e-6), book.rows[5].RL);
check("دفتر حقيقي: خطأ الإغلاق = 0", near(book.misclosure, 0, 1e-9), book.misclosure);
check("نقطة التغيير مُعلَّمة", book.rows[3].kind === "CP", book.rows[3].kind);

// CALC-01: آخر صف يحمل BS فقط
const trailing = Leveling.reduce(100, [
  { station: "BM", bs: 1.5 }, { station: "P1", is: 1.2 }, { station: "P2", fs: 1.0 }, { station: "P3", bs: 0.8 },
]);
check("CALC-01: BS أخير لا يُنتج خطأ إغلاق كاذبًا", near(trailing.misclosure, 0), trailing.misclosure);
check("CALC-01: يُحذَّر من المحطة غير المغلقة", trailing.warnings.some((w) => /لم تُغلق/.test(w)));
check("CALC-01: منسوب الإغلاق = 100.5", near(trailing.closingRL, 100.5), trailing.closingRL);

// CALC-02: القراءة المتوسطة لا تُغلق دورة
const lastIS = Leveling.reduce(100, [{ station: "BM", bs: 1.5 }, { station: "P1", fs: 1.0 }, { station: "P2", is: 1.2 }]);
check("CALC-02: IS أخيرة لا تُغلق الدورة", near(lastIS.misclosure, 0), lastIS.misclosure);
check("CALC-02: منسوب IS محسوب مع ذلك", near(lastIS.rows[2].RL, 100.3), lastIS.rows[2].RL);

// CALC-03 وبقية التحقق
check("CALC-03: صف أول بلا BS يُرفض", Leveling.reduce(100, [{ station: "A", fs: 1 }]).ok === false);
check("قراءة سالبة تُرفض", Leveling.reduce(100, [{ station: "BM", bs: -1.5 }, { station: "P", fs: 1 }]).ok === false);
check("IS و FS في صف واحد يُرفضان", Leveling.reduce(100, [{ station: "BM", bs: 1.5 }, { station: "P", is: 1, fs: 2 }]).ok === false);
check("جدول فارغ يُرفض", Leveling.reduce(100, []).ok === false);
check("منسوب بداية غير رقمي يُرفض", Leveling.reduce(NaN, [{ station: "BM", bs: 1 }]).ok === false);
check("قراءة غير رقمية تُرفض", Leveling.reduce(100, [{ station: "BM", bs: "abc" }]).ok === false);
check("الصفوف الفارغة تُتجاهل مع تحذير", Leveling.reduce(100, [{ station: "BM", bs: 1.5 }, { station: "X" }, { station: "P", fs: 1 }]).warnings.length > 0);
check("قراءة أطول من القامة تُحذَّر", Leveling.reduce(100, [{ station: "BM", bs: 6.2 }, { station: "P", fs: 1 }]).warnings.some((w) => /القامة/.test(w)));
check("السماحية تزيد مع عدد المحطات", Leveling.allowableMisclosure(16) > Leveling.allowableMisclosure(4));

/* ==================== المضلعات ==================== */
section("تسوية المضلعات");
const closedSq = [
  { azimuth: 90, distance: 10 }, { azimuth: 180, distance: 10 },
  { azimuth: 270, distance: 10 }, { azimuth: 0, distance: 10 },
];
const trav = Traverse.compute({ x: 0, y: 0 }, closedSq);
check("مضلع مغلق مضبوط: خطأ ≈ 0", trav.ok && trav.misclosure < 1e-9, trav.misclosure);
check("يعود إلى نقطة البداية", near(trav.points[4].x, 0) && near(trav.points[4].y, 0));
check("عدد النقاط = عدد الأضلاع + 1", trav.points.length === 5, trav.points.length);

// CALC-04: النموذج الفارغ
const empty = Traverse.compute({ x: 0, y: 0 }, [{ azimuth: 0, distance: 0 }, { azimuth: 90, distance: 0 }]);
check("CALC-04: أضلاع بمسافة صفر تُرفض", empty.ok === false && /لم تُدخل أي أضلاع/.test(empty.errors[0]));
check("CALC-04: لا تُرجع دقة Infinity لمدخل فارغ", empty.precision === null);
check("مضلع مغلق بضلعين يُرفض", Traverse.compute({ x: 0, y: 0 }, [{ azimuth: 0, distance: 5 }, { azimuth: 90, distance: 5 }]).ok === false);

// CALC-05: المسافة السالبة
const neg = Traverse.compute({ x: 0, y: 0 }, [{ azimuth: 0, distance: -100 }, { azimuth: 90, distance: 100 }, { azimuth: 180, distance: 50 }]);
check("CALC-05: المسافة السالبة تُرفض", neg.ok === false && /سالبة/.test(neg.errors[0]));

// CALC-06: معايرة الأزيموث
check("معايرة الأزيموث 450 → 90", near(Traverse.normalizeAzimuth(450), 90));
check("معايرة الأزيموث -90 → 270", near(Traverse.normalizeAzimuth(-90), 270));
check("معايرة الأزيموث 360 → 0", near(Traverse.normalizeAzimuth(360), 0));
const wild = Traverse.compute({ x: 0, y: 0 }, [
  { azimuth: 450, distance: 10 }, { azimuth: 180, distance: 10 }, { azimuth: -90, distance: 10 }, { azimuth: 720, distance: 10 },
]);
check("أزيموثات خارج المدى تُعاير وتُغلق", wild.ok && wild.misclosure < 1e-9, wild.misclosure);
check("يُحذَّر من الأزيموث خارج المدى", wild.warnings.length >= 3, wild.warnings.length);

// خطأ إغلاق حقيقي وتوزيعه
const legs4 = [
  { azimuth: 45, distance: 100 }, { azimuth: 135, distance: 100 },
  { azimuth: 225, distance: 100 }, { azimuth: 315, distance: 100.5 },
];
const bow2 = Traverse.compute({ x: 1000, y: 2000 }, legs4);
check("خطأ خطي = 0.5 م", near(bow2.misclosure, 0.5, 1e-9), bow2.misclosure);
check("الدقة النسبية ≈ 1:801", Math.round(bow2.precision) === 801, Math.round(bow2.precision));
check("Bowditch يُغلق المضلع بعد التسوية",
  near(bow2.points[4].x, 1000, 1e-9) && near(bow2.points[4].y, 2000, 1e-9),
  `${bow2.points[4].x}, ${bow2.points[4].y}`);
check("مجموع التصحيحات = -خطأ الإغلاق",
  near(bow2.legs.reduce((s, l) => s + l.corrLat, 0), -bow2.errorLat, 1e-9));
check("اتجاه خطأ الإغلاق محسوب", near(bow2.misclosureBearing, 135, 1e-6), bow2.misclosureBearing);

const tr = Traverse.compute({ x: 1000, y: 2000 }, legs4, null, { method: "transit" });
check("Transit يُغلق المضلع أيضًا", near(tr.points[4].x, 1000, 1e-9) && near(tr.points[4].y, 2000, 1e-9));

// مضلع غير متماثل: الضلع الشرقي مركّبته الشمالية صفر، فتصحيحه بقاعدة العبور صفر
// بينما Bowditch يوزّع عليه تصحيحًا لأنه يعتمد على الطول وحده.
const asym = [
  { azimuth: 0, distance: 100 }, { azimuth: 90, distance: 20 },
  { azimuth: 180, distance: 99 }, { azimuth: 270, distance: 20 },
];
const aBow = Traverse.compute({ x: 0, y: 0 }, asym);
const aTr = Traverse.compute({ x: 0, y: 0 }, asym, null, { method: "transit" });
check("الطريقتان تُغلقان المضلع غير المتماثل",
  near(aBow.points[4].x, 0, 1e-9) && near(aTr.points[4].x, 0, 1e-9));
check("Transit: الضلع الشرقي بلا تصحيح شمالي", near(aTr.legs[1].corrLat, 0, 1e-12), aTr.legs[1].corrLat);
check("Bowditch: الضلع الشرقي له تصحيح شمالي", Math.abs(aBow.legs[1].corrLat) > 1e-9, aBow.legs[1].corrLat);
check("الطريقتان تعطيان إحداثيات مختلفة",
  !near(aBow.points[1].y, aTr.points[1].y, 1e-9), `${aBow.points[1].y} vs ${aTr.points[1].y}`);

// مضلع مفتوح
const open = Traverse.compute({ x: 0, y: 0 }, [{ azimuth: 0, distance: 100 }], { x: 0, y: 100.02 }, { isClosed: false });
check("المضلع المفتوح: خطأ 0.02 م", near(open.misclosure, 0.02, 1e-9), open.misclosure);

// تسوية الزوايا
const ang = Traverse.adjustAngles([90.01, 89.99, 90.02, 89.96], 45);
check("المجموع النظري للرباعي = 360", ang.theoretical === 360, ang.theoretical);
check("خطأ الإغلاق الزاوي = -72 ثانية", near(ang.angularMisclosure * 3600, -72, 1e-6), ang.angularMisclosure * 3600);
check("مجموع الزوايا بعد التصحيح = النظري", near(ang.angles.reduce((a, b) => a + b, 0), 360, 1e-9));
check("عدد الأزيموثات = عدد الزوايا", ang.azimuths.length === 4);
check("كل الأزيموثات داخل [0,360)", ang.azimuths.every((a) => a >= 0 && a < 360), ang.azimuths.join(","));
check("زاوية غير رقمية تُرفض", Traverse.adjustAngles([90, NaN, 90, 90], 45).ok === false);
check("زاويتان لمضلع مغلق تُرفضان", Traverse.adjustAngles([90, 90], 45).ok === false);

/* ==================== التحقق من المناسيب ==================== */
section("التحقق من المناسيب");
const HI = LevelCheck.computeHI(100, 1.5);
check("HI = 101.5", near(HI, 101.5), HI);
throws("HI برقم غير صالح يُرفض", () => LevelCheck.computeHI(NaN, 1.5), /غير صالح/);
throws("قراءة خلفية سالبة تُرفض", () => LevelCheck.computeHI(100, -1.5), /سالبة/);

check("مطابق", LevelCheck.checkReading(HI, 100.2, 1.3).status === "match");
const hi2 = LevelCheck.checkReading(HI, 100.2, 1.1);
check("أعلى + الفرق 200 مم", hi2.status === "high" && near(hi2.diffMM, 200, 1e-6), hi2.diffMM);
const lo = LevelCheck.checkReading(HI, 100.2, 1.5);
check("أقل + الفرق -200 مم", lo.status === "low" && near(lo.diffMM, -200, 1e-6), lo.diffMM);
check("على حدّ السماحية تمامًا = مطابق", LevelCheck.checkReading(HI, 100.2, 1.295).status === "match");

// CALC-12: التناقض بين النص والحالة
const edge = LevelCheck.checkReading(HI, 100.2, 1.2946);
check("CALC-12: 5.4 مم خارج سماحية 5 مم", edge.status === "high", edge.diffMM);
check("CALC-12: النص يعرض 5.4 لا 5", LevelCheck.formatDiffMM(edge.diffMM, edge.toleranceMM) === "5.4",
  LevelCheck.formatDiffMM(edge.diffMM, edge.toleranceMM));
check("سماحية كبيرة → عرض بلا كسور", LevelCheck.formatDiffMM(49.9, 50) === "50", LevelCheck.formatDiffMM(49.9, 50));

const fill = LevelCheck.checkReading(HI, 100.2, 1.25, 0.05);
check("سماحية الردم 50 مم تجعلها مطابقة", fill.status === "match", fill.status);
check("السماحية تُعاد في النتيجة", near(fill.toleranceMM, 50), fill.toleranceMM);
throws("قراءة سالبة تُرفض", () => LevelCheck.checkReading(HI, 100.2, -1), /سالبة/);
throws("قراءة غير رقمية تُرفض", () => LevelCheck.checkReading(HI, 100.2, NaN), /غير صالحة/);
check("قطع/ردم صحيح", LevelCheck.cutFill(hi2).action === "قطع" && LevelCheck.cutFill(lo).action === "ردم");
check("ملفات السماحية متوفرة", LevelCheck.PROFILES.length >= 5 && LevelCheck.PROFILES.some((p) => p.id === "fill"));

console.log(`\n${"=".repeat(46)}`);
console.log(failures === 0 ? `كل الاختبارات نجحت — ${passes} اختبارًا ✅` : `${failures} فشل من ${passes + failures} ❌`);
process.exit(failures === 0 ? 0 : 1);

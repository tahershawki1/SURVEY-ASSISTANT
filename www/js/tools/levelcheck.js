/* التحقق من عدة مناسيب في الموقع بطريقة ارتفاع خط النظر (HI Method)
   1) منسوب معروف للنقطة الثابتة (BM) + قراءة الميزان عليها → ارتفاع خط النظر (HI)
   2) المنسوب المراد التحقق منه (target RL)
   3) لكل قراءة ميدانية: المنسوب الفعلي = HI − القراءة، ويُقارن بالمنسوب المطلوب */

const LevelCheck = (() => {
  const DEFAULT_TOLERANCE_M = 0.005; // ±5 مم

  /* ملفات سماحية جاهزة حسب نوع العمل — كل قيمة بالمتر */
  const PROFILES = [
    { id: "concrete", label: "خرسانة / صبّة", tolerance: 0.005 },
    { id: "asphalt", label: "أسفلت / طبقات رصف", tolerance: 0.010 },
    { id: "subbase", label: "طبقة أساس", tolerance: 0.020 },
    { id: "fill", label: "ردم / تسوية موقع", tolerance: 0.050 },
    { id: "excavation", label: "حفر", tolerance: 0.100 },
    { id: "custom", label: "سماحية مخصّصة", tolerance: null },
  ];

  function computeHI(bmRL, bsReading) {
    if (!Number.isFinite(bmRL)) throw new RangeError("منسوب النقطة الثابتة غير صالح.");
    if (!Number.isFinite(bsReading)) throw new RangeError("قراءة الميزان غير صالحة.");
    if (bsReading < 0) throw new RangeError("قراءة القامة لا تكون سالبة.");
    return bmRL + bsReading;
  }

  function checkReading(HI, targetRL, reading, toleranceM = DEFAULT_TOLERANCE_M) {
    if (!Number.isFinite(HI)) throw new RangeError("ارتفاع خط النظر غير محسوب.");
    if (!Number.isFinite(targetRL)) throw new RangeError("المنسوب المطلوب غير صالح.");
    if (!Number.isFinite(reading)) throw new RangeError("القراءة غير صالحة.");
    if (reading < 0) throw new RangeError("قراءة القامة لا تكون سالبة.");
    const tol = Number.isFinite(toleranceM) && toleranceM >= 0 ? toleranceM : DEFAULT_TOLERANCE_M;

    const actualRL = HI - reading;
    const diff = actualRL - targetRL; // + أعلى من المطلوب، − أقل منه
    const diffMM = diff * 1000;
    let status;
    if (Math.abs(diff) <= tol + 1e-12) status = "match";
    else if (diff > 0) status = "high";
    else status = "low";
    return { actualRL, diff, diffMM, status, tolerance: tol, toleranceMM: tol * 1000 };
  }

  /* عدد الخانات العشرية اللازم لعرض الفرق دون أن يتعارض النص مع الحالة:
     سماحية 5 مم وفرق 5.4 مم يجب ألا يُعرضا كرقم واحد. */
  function formatDiffMM(diffMM, toleranceMM) {
    const abs = Math.abs(diffMM);
    const decimals = toleranceMM < 10 ? 1 : 0;
    return abs.toFixed(decimals);
  }

  /* الفرق المطلوب لبلوغ المنسوب: موجب = ارفع، سالب = اخفض */
  function cutFill(res) {
    return { action: res.diff > 0 ? "قطع" : "ردم", amountMM: Math.abs(res.diffMM) };
  }

  return { computeHI, checkReading, formatDiffMM, cutFill, DEFAULT_TOLERANCE_M, PROFILES };
})();

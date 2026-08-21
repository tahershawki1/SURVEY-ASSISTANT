/* التحقق من عدة مناسيب في الموقع بطريقة ارتفاع خط النظر (HI Method)
   1) منسوب معروف للنقطة الثابتة (BM) + قراءة الميزان عليها -> ارتفاع خط النظر (HI)
   2) المنسوب المراد التحقق منه (target RL)
   3) لكل قراءة ميدانية: المنسوب الفعلي = HI - القراءة، ويُقارن بالمنسوب المطلوب */

const LevelCheck = (() => {
  const DEFAULT_TOLERANCE_M = 0.005; // ±5 مم يُعتبر مطابقًا

  function computeHI(bmRL, bsReading) {
    return bmRL + bsReading;
  }

  function checkReading(HI, targetRL, reading, toleranceM = DEFAULT_TOLERANCE_M) {
    const actualRL = HI - reading;
    const diff = actualRL - targetRL; // + يعني المكان أعلى من المطلوب، - يعني أقل
    const diffMM = diff * 1000;
    let status;
    if (Math.abs(diff) <= toleranceM) status = "match";
    else if (diff > 0) status = "high";
    else status = "low";
    return { actualRL, diff, diffMM, status };
  }

  return { computeHI, checkReading, DEFAULT_TOLERANCE_M };
})();

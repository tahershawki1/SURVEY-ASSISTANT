/* تفريغ قراءات الميزانية بطريقة ارتفاع خط النظر (HI Method)
   rows: [{ station, bs, is, fs }] — القيم نصوص أو أرقام أو فارغة
   الصف الأول يجب أن يحتوي قراءة خلفية BS.
   أي صف يحمل FS و BS معًا هو نقطة تغيير (Change Point).
   التحقق الحسابي القياسي: ΣBS − ΣFS = (منسوب آخر قراءة أمامية) − (منسوب البداية)
   — القراءات المتوسطة IS لا تُغلق دورة ولا تدخل في هذا التحقق. */

const Leveling = (() => {
  const MAX_STAFF_READING = 5.0; // أطول قامة شائعة، للتحذير فقط

  function num(v) {
    if (v === "" || v === null || v === undefined) return null;
    const n = typeof v === "number" ? v : parseFloat(v);
    return Number.isFinite(n) ? n : NaN;
  }

  function reduce(firstRL, rows) {
    const errors = [];
    const warnings = [];

    if (!Number.isFinite(firstRL)) {
      errors.push("منسوب البداية غير صالح.");
    }

    const list = Array.isArray(rows) ? rows : [];

    // نتجاهل الصفوف الفارغة تمامًا (صفوف أُضيفت ولم تُملأ) مع تنبيه
    const used = [];
    list.forEach((row, i) => {
      const bs = num(row.bs), is = num(row.is), fs = num(row.fs);
      const blank = bs === null && is === null && fs === null;
      if (blank) {
        warnings.push(`الصف ${i + 1} (${row.station || "بدون اسم"}) فارغ وتم تجاهله.`);
        return;
      }
      if (Number.isNaN(bs) || Number.isNaN(is) || Number.isNaN(fs)) {
        errors.push(`الصف ${i + 1} (${row.station || "بدون اسم"}) يحتوي قراءة غير رقمية.`);
        return;
      }
      if (is !== null && fs !== null) {
        errors.push(`الصف ${i + 1} (${row.station || "بدون اسم"}) يحتوي IS و FS معًا — لا يمكن للمحطة أن تكون متوسطة وأمامية في الوقت نفسه.`);
        return;
      }
      [["BS", bs], ["IS", is], ["FS", fs]].forEach(([k, v]) => {
        if (v === null) return;
        if (v < 0) errors.push(`الصف ${i + 1}: قراءة ${k} سالبة (${v}) — قراءة القامة لا تكون سالبة.`);
        else if (v > MAX_STAFF_READING) warnings.push(`الصف ${i + 1}: قراءة ${k} = ${v} م أكبر من طول القامة المعتاد (${MAX_STAFF_READING} م).`);
      });
      used.push({ station: row.station, bs, is, fs });
    });

    if (used.length === 0) {
      errors.push("لا توجد أي قراءة مُدخلة.");
    } else if (used[0].bs === null) {
      errors.push("الصف الأول يجب أن يحتوي قراءة خلفية BS على النقطة الثابتة — بدونها لا يمكن حساب ارتفاع خط النظر.");
    }

    if (errors.length) {
      return { ok: false, errors, warnings, rows: [], sumBS: 0, sumFS: 0, firstRL, lastRL: null, closingRL: null, arithmeticCheck: null, expectedDiff: null, misclosure: null };
    }

    const out = [];
    let HI = null;
    let sumBS = 0;
    let sumFS = 0;
    let closingRL = null; // منسوب آخر قراءة أمامية FS — هو وحده ما يُغلق الدورة
    // لقطة المجاميع لحظة آخر قراءة أمامية: التحقق الحسابي يقارن الدورة المغلقة فقط،
    // وأي قراءة خلفية بعد آخر FS تخص محطة لم تُغلق بعد ولا تدخل في الفحص.
    let snapBS = null, snapFS = null;
    let trailingBS = false;

    used.forEach((row, i) => {
      const { bs, is, fs } = row;
      if (fs !== null) sumFS += fs;

      if (i === 0) {
        sumBS += bs;
        trailingBS = true;
        HI = firstRL + bs;
        out.push({ station: row.station, bs, is, fs, HI, RL: firstRL, kind: "BM" });
        return;
      }

      let rowRL = null;
      let kind = null;
      if (is !== null) {
        rowRL = HI - is;
        kind = "IS";
      } else if (fs !== null) {
        rowRL = HI - fs;
        kind = "FS";
        closingRL = rowRL;
        snapBS = sumBS;
        snapFS = sumFS;
        trailingBS = false;
      }

      if (bs !== null) {
        sumBS += bs;
        trailingBS = true;
        if (rowRL === null) {
          // قراءة خلفية جديدة بلا قراءة أمامية قبلها على نفس المحطة
          warnings.push(`الصف ${i + 1} (${row.station || "بدون اسم"}) يحتوي BS بلا FS — يُفترض أنه إعادة رصد من نفس النقطة السابقة.`);
          rowRL = closingRL !== null ? closingRL : firstRL;
          kind = kind || "BS";
        } else {
          kind = "CP"; // نقطة تغيير
        }
        HI = rowRL + bs;
      }

      out.push({ station: row.station, bs, is, fs, HI, RL: rowRL, kind });
    });

    const hasClosing = closingRL !== null;
    const checkBS = hasClosing ? snapBS : sumBS;
    const checkFS = hasClosing ? snapFS : sumFS;
    const arithmeticCheck = hasClosing ? checkBS - checkFS : null;
    const expectedDiff = hasClosing ? closingRL - firstRL : null;
    const misclosure = hasClosing ? arithmeticCheck - expectedDiff : null;

    if (!hasClosing) {
      warnings.push("لا توجد أي قراءة أمامية FS — لا يمكن إجراء التحقق الحسابي للإغلاق.");
    } else if (trailingBS) {
      warnings.push("آخر قراءة خلفية BS ليس بعدها قراءة أمامية — المحطة الأخيرة لم تُغلق، والتحقق الحسابي أُجري على الجزء المغلق من الدورة فقط.");
    }

    return {
      ok: true,
      errors,
      warnings,
      rows: out,
      sumBS,
      sumFS,
      checkBS,
      checkFS,
      trailingBS,
      firstRL,
      lastRL: closingRL,
      closingRL,
      arithmeticCheck,
      expectedDiff,
      misclosure,
    };
  }

  /* السماحية القياسية لخطأ إغلاق دورة ميزانية: ك × √(المسافة بالكيلومتر).
     نستخدم عدد المحطات بدلًا من المسافة عند عدم توفرها. */
  function allowableMisclosure(numSetups, mmPerRootKm = 12, avgSightM = 50) {
    const km = (numSetups * avgSightM * 2) / 1000;
    return (mmPerRootKm * Math.sqrt(Math.max(km, 0))) / 1000;
  }

  return { reduce, allowableMisclosure, MAX_STAFF_READING };
})();

/* تفريغ قراءات الميزانية بطريقة ارتفاع خط النظر (HI Method)
   rows: [{ station, bs, is, fs }] — bs/is/fs أرقام أو null
   الصف الأول يجب أن يحتوي BS. أي صف به FS+BS معًا يُعتبر نقطة تغيير (Change Point). */

const Leveling = (() => {
  function reduce(firstRL, rows) {
    const out = [];
    let HI = null;
    let RL = firstRL;
    let sumBS = 0;
    let sumFS = 0;

    rows.forEach((row, i) => {
      const bs = row.bs === "" || row.bs === null || row.bs === undefined ? null : parseFloat(row.bs);
      const is = row.is === "" || row.is === null || row.is === undefined ? null : parseFloat(row.is);
      const fs = row.fs === "" || row.fs === null || row.fs === undefined ? null : parseFloat(row.fs);

      if (bs !== null && !isNaN(bs)) sumBS += bs;
      if (fs !== null && !isNaN(fs)) sumFS += fs;

      if (i === 0) {
        HI = firstRL + (bs || 0);
        out.push({ station: row.station, bs, is, fs, HI, RL: firstRL });
        return;
      }

      let rowRL = null;
      if (is !== null && !isNaN(is)) {
        rowRL = HI - is;
      } else if (fs !== null && !isNaN(fs)) {
        rowRL = HI - fs;
      }

      if (rowRL !== null) RL = rowRL;

      // نقطة تغيير: يوجد BS جديد على نفس الصف (بعد FS أو IS)
      if (bs !== null && !isNaN(bs) && rowRL !== null) {
        HI = rowRL + bs;
      }

      out.push({ station: row.station, bs, is, fs, HI, RL: rowRL });
    });

    const lastRL = out.length ? out[out.length - 1].RL : firstRL;
    const arithmeticCheck = sumBS - sumFS; // يجب أن يساوي (آخر RL - أول RL)
    const expectedDiff = (lastRL ?? firstRL) - firstRL;
    const misclosure = arithmeticCheck - expectedDiff;

    return { rows: out, sumBS, sumFS, lastRL, firstRL, arithmeticCheck, expectedDiff, misclosure };
  }

  return { reduce };
})();

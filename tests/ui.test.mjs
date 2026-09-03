/* اختبارات سلوك الواجهة في متصفح حقيقي.
   الاختبارات الحسابية في tests/calc.test.mjs؛ هذا الملف يغطي ما تعيش فيه أخطاء
   الصفحات: التحقق من المدخلات، حفظ الجلسة، تهريب المحتوى، السمة، والوصول.
   التشغيل: npm run test:ui   (يتطلب متصفحًا: PW_CHROME=/path/to/chrome) */
import { chromium } from 'playwright-core';
import http from 'http';
import fs from 'fs';
import path from 'path';

const ROOT = path.resolve(process.cwd(), 'www');
const MIME = { '.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.json':'application/json', '.webmanifest':'application/manifest+json', '.png':'image/png', '.svg':'image/svg+xml' };
const server = http.createServer((req,res)=>{
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('nf'); }
  res.writeHead(200, {'Content-Type': MIME[path.extname(f)] || 'application/octet-stream'});
  res.end(fs.readFileSync(f));
});
const PORT = Number(process.env.PORT) || 8931;
await new Promise(r=>server.listen(PORT, r));
const B=`http://localhost:${PORT}`;

const CHROME = process.env.PW_CHROME
  || process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH
  || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
if (!fs.existsSync(CHROME)) {
  console.log(`تخطٍّ: لم يُعثر على متصفح في ${CHROME}\nاضبط PW_CHROME على مسار Chrome/Chromium لتشغيل هذه الاختبارات.`);
  server.close();
  process.exit(0);
}
const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
let fails = 0;
const log = (ok,msg)=>{ if(!ok) fails++; console.log(`${ok?'PASS':'FAIL'}  ${msg}`); };

async function newPage(theme='dark'){
  const ctx = await browser.newContext({ viewport:{width:390,height:844}, colorScheme:theme, locale:'ar-EG' });
  const pg = await ctx.newPage();
  const errs = [];
  pg.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
  pg.on('pageerror', e => errs.push('PAGEERROR: '+e.message));
  pg.on('requestfailed', r => errs.push('REQFAIL '+r.url()));
  pg.on('response', r => { if (r.status()>=400) errs.push('HTTP'+r.status()+' '+r.url()); });
  return { pg, ctx, errs };
}

const PAGES = [['/index.html','home'],['/pages/coords.html','coords'],['/pages/area.html','area'],
  ['/pages/leveling.html','leveling'],['/pages/traverse.html','traverse'],['/pages/levelcheck.html','levelcheck'],
  ['/pages/fieldnotes.html','fieldnotes'],['/pages/notifications.html','notifications'],['/pages/settings.html','settings']];

console.log('=== 1) كل صفحة تُحمّل بلا أخطاء + الترويسة والشريط السفلي يُرسمان ===');
for (const [url,id] of PAGES){
  const {pg,ctx,errs} = await newPage();
  await pg.goto(B+url,{waitUntil:'networkidle'});
  const h = await pg.locator('#appHeader h1').count();
  const nav = await pg.locator('#appNav .nav-item').count();
  const title = await pg.locator('#appHeader h1').textContent().catch(()=>null);
  const real = errs.filter(e=>!/favicon|raw\.githubusercontent|CONNECTION_RESET|ERR_FAILED/i.test(e));
  log(h===1 && nav===5 && real.length===0, `${id.padEnd(14)} header:${h} nav:${nav} "${(title||'').trim()}" errors:${real.length} ${real.join(' | ')}`);
  await ctx.close();
}

console.log('\n=== 2) التبديل بين السمة الفاتحة والداكنة ===');
{
  const {pg,ctx} = await newPage('light');
  await pg.goto(B+'/index.html',{waitUntil:'networkidle'});
  const lightBg = await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  const lightTx = await pg.evaluate(()=>getComputedStyle(document.body).color);
  await pg.click('[data-theme-toggle]'); await pg.waitForTimeout(120);
  await pg.click('[data-theme-toggle]'); await pg.waitForTimeout(120);
  const attr = await pg.evaluate(()=>document.documentElement.getAttribute('data-theme'));
  const darkBg = await pg.evaluate(()=>getComputedStyle(document.body).backgroundColor);
  log(lightBg==='rgb(238, 241, 246)', `السمة الفاتحة خلفية ${lightBg} نص ${lightTx}`);
  log(attr==='dark' && darkBg==='rgb(15, 23, 42)', `التبديل إلى الداكن data-theme=${attr} خلفية ${darkBg}`);
  const persisted = await pg.evaluate(()=>localStorage.getItem('masaha_theme'));
  log(persisted==='dark', `السمة محفوظة: ${persisted}`);
  await ctx.close();
}

console.log('\n=== 3) التكبير غير معطّل + لا يوجد سكربت مضمّن (CSP) ===');
{
  const {pg,ctx,errs} = await newPage();
  await pg.goto(B+'/pages/area.html',{waitUntil:'networkidle'});
  const vp = await pg.getAttribute('meta[name=viewport]','content');
  const csp = await pg.getAttribute('meta[http-equiv="Content-Security-Policy"]','content');
  const inline = await pg.evaluate(()=>[...document.querySelectorAll('script:not([src])')].length);
  const onclicks = await pg.evaluate(()=>[...document.querySelectorAll('[onclick]')].length);
  log(!/maximum-scale/.test(vp), `viewport بلا maximum-scale: ${vp}`);
  log(/script-src 'self'/.test(csp) && !/script-src[^;]*unsafe-inline/.test(csp), `CSP يمنع السكربت المضمّن`);
  log(inline===0 && onclicks===0, `سكربتات مضمّنة: ${inline} — معالجات onclick: ${onclicks}`);
  await ctx.close();
}

console.log('\n=== 4) المساحات: مضلع متقاطع + حفظ الجلسة + التعديل وإعادة الترتيب ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/area.html',{waitUntil:'networkidle'});
  const add = async (x,y)=>{ await pg.fill('#ptX',String(x)); await pg.fill('#ptY',String(y)); await pg.click('#btnAdd'); await pg.waitForTimeout(60); };
  await add(0,0); await add(10,10); await add(10,0); await add(0,10);   // bow-tie
  const err = await pg.locator('.msg-error').textContent().catch(()=>'');
  log(/يتقاطع مع نفسه/.test(err), `المضلع المتقاطع يُرفض برسالة: "${err.trim().slice(0,50)}..."`);
  const svgBad = await pg.locator('#preview .poly-line.bad').count();
  log(svgBad===1, `المعاينة ترسم الشكل الخاطئ بخط أحمر متقطع`);
  // إعادة الترتيب لإصلاحه
  await pg.click('[data-up="3"]'); await pg.waitForTimeout(150);
  await pg.click('[data-up="2"]'); await pg.waitForTimeout(200);
  const area = await pg.locator('.headline .v').textContent().catch(()=>'');
  log(/100/.test(area), `بعد إعادة الترتيب: المساحة = ${area.trim().split('\n')[0]}`);
  const feddan = await pg.locator('.headline .sub').first().textContent();
  log(/ف .* ط .* س/.test(feddan), `وحدات مصرية: ${feddan.trim()}`);
  await pg.waitForTimeout(600);
  // إعادة التحميل: هل تُستعاد النقاط؟
  await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(400);
  const n = await pg.locator('#ptCount').textContent();
  log(n==='4', `بعد إعادة التحميل استُعيدت ${n} نقاط من الحفظ التلقائي`);
  // حذف الكل يطلب تأكيدًا
  await pg.click('#btnClear'); await pg.waitForTimeout(150);
  const dlg = await pg.locator('.modal-overlay').count();
  log(dlg===1, `«حذف كل النقاط» يعرض مربع تأكيد`);
  await pg.click('[data-cancel]'); await pg.waitForTimeout(100);
  log((await pg.locator('#ptCount').textContent())==='4', `الإلغاء يحافظ على النقاط`);
  await ctx.close();
}

console.log('\n=== 5) الميزانية: خطأ الإغلاق الكاذب (CALC-01) ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/leveling.html',{waitUntil:'networkidle'});
  await pg.click('#btnAddRow'); await pg.click('#btnAddRow'); await pg.waitForTimeout(100);
  const rows = pg.locator('#rowsWrap > .card');
  await rows.nth(0).locator('[data-f="bs"]').fill('1.5');
  await rows.nth(1).locator('[data-f="is"]').fill('1.2');
  await rows.nth(2).locator('[data-f="fs"]').fill('1.0');
  await rows.nth(3).locator('[data-f="bs"]').fill('0.8');
  await pg.click('#btnCompute'); await pg.waitForTimeout(200);
  const v = await pg.locator('.headline .v').textContent();
  const cls = await pg.locator('.headline').getAttribute('class');
  log(/^0\.0/.test(v.trim()) && /ok/.test(cls), `خطأ الإغلاق = ${v.trim().split('\n')[0]} مم (كان 1300 مم كاذبًا) — الحالة: ${cls.includes('ok')?'مقبول':'مرفوض'}`);
  const warn = await pg.locator('.msg-warn').textContent().catch(()=>'');
  log(/لم تُغلق/.test(warn), `تحذير المحطة غير المغلقة ظاهر`);
  // صف أول بلا BS
  await rows.nth(0).locator('[data-f="bs"]').fill('');
  await pg.click('#btnCompute'); await pg.waitForTimeout(200);
  const e2 = await pg.locator('.msg-error').textContent();
  log(/قراءة خلفية BS/.test(e2), `التفريغ بلا BS أول يُرفض`);
  await ctx.close();
}

console.log('\n=== 6) المضلعات: النموذج الفارغ + المسافة السالبة + تسوية الزوايا ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/traverse.html',{waitUntil:'networkidle'});
  await pg.click('#btnCompute'); await pg.waitForTimeout(200);
  const err = await pg.locator('.msg-error').textContent();
  log(/لم تُدخل أي أضلاع/.test(err), `النموذج الفارغ يُرفض بدل «مضبوط تمامًا»`);
  const legs = pg.locator('#legsWrap > .card');
  for (const [i,a,d] of [[0,45,100],[1,135,100],[2,225,100],[3,315,100.5]]) {
    await legs.nth(i).locator('[data-f="azimuth"]').fill(String(a));
    await legs.nth(i).locator('[data-f="distance"]').fill(String(d));
  }
  await pg.click('#btnCompute'); await pg.waitForTimeout(200);
  const prec = await pg.locator('.headline .v').textContent();
  log(/1 : 80\d/.test(prec), `الدقة النسبية = ${prec.trim().split('\n')[0]}`);
  await legs.nth(0).locator('[data-f="distance"]').fill('-100');
  await pg.click('#btnCompute'); await pg.waitForTimeout(200);
  log(/سالبة/.test(await pg.locator('.msg-error').textContent()), `المسافة السالبة تُرفض`);
  await legs.nth(0).locator('[data-f="distance"]').fill('100');
  // تسوية الزوايا
  await pg.check('#useAngles'); await pg.waitForTimeout(200);
  const angCount = await pg.locator('[data-ang]').count();
  log(angCount===4, `ظهرت ${angCount} حقول زوايا`);
  for (let i=0;i<4;i++) await pg.locator(`#ang${i}`).fill(['90.01','89.99','90.02','89.96'][i]);
  await pg.waitForTimeout(250);
  const angMis = await pg.locator('#angleResult .v').textContent();
  log(/-72/.test(angMis), `خطأ الإغلاق الزاوي = ${angMis.trim().split('\n')[0]}`);
  const derivedAz = await legs.nth(1).locator('[data-f="azimuth"]').inputValue();
  log(parseFloat(derivedAz)!==135, `الأزيموثات اشتُقت من الزوايا المصححة: ضلع2 = ${derivedAz}`);
  await ctx.close();
}

console.log('\n=== 7) التحقق من المناسيب: السماحية + الإقفال العكسي ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/levelcheck.html',{waitUntil:'networkidle'});
  await pg.fill('#bmRL','100'); await pg.fill('#bmBS','1.5'); await pg.waitForTimeout(150);
  log((await pg.locator('#hiPreview b').textContent()).includes('101.500'), `HI محسوب = 101.500`);
  await pg.fill('#targetRL','100.2'); await pg.waitForTimeout(150);
  await pg.fill('#fieldReading','1.2946'); await pg.click('#calcBtn'); await pg.waitForTimeout(150);
  const st = await pg.locator('.readings-row .st').last().textContent();
  log(/5\.4 مم/.test(st), `التناقض القديم اختفى — يعرض: "${st.trim()}"`);
  // تغيير ملف السماحية إلى ردم 50 مم يعيد الحساب
  await pg.selectOption('#tolProfile','fill'); await pg.waitForTimeout(200);
  const st2 = await pg.locator('.readings-row .st').last().textContent();
  log(/مطابق/.test(st2), `بعد اختيار «ردم ±50 مم» أصبحت: "${st2.trim()}"`);
  // الإقفال العكسي
  await pg.fill('#bmRL',''); await pg.waitForTimeout(200);
  const locked = await pg.locator('#stage3').getAttribute('class');
  const disabled = await pg.locator('#fieldReading').isDisabled();
  log(/locked/.test(locked) && disabled, `مسح منسوب النقطة الثابتة يُقفل المرحلة 3 مجددًا`);
  await ctx.close();
}

console.log('\n=== 8) الإحداثيات: التحقق من المدخلات + DMS ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/coords.html',{waitUntil:'networkidle'});
  await pg.fill('#latIn','24.7136'); await pg.fill('#lonIn','46.6753'); await pg.click('#btnLL'); await pg.waitForTimeout(150);
  const zone = await pg.locator('.result-box .row b').first().textContent();
  log(/38R N/.test(zone), `المنطقة والنطاق = ${zone}`);
  await pg.fill('#latIn','1.99999999'); await pg.click('#btnLL'); await pg.waitForTimeout(150);
  const dms = await pg.locator('.result-box .row').nth(4).locator('b').textContent();
  log(/2° 0' 0\.00"/.test(dms), `تقريب DMS صحيح: ${dms}`);
  await pg.fill('#latIn','95'); await pg.click('#btnLL'); await pg.waitForTimeout(150);
  log(/بين -80 و 84/.test(await pg.locator('.msg-error').textContent()), `خط عرض 95 يُرفض`);
  await pg.click('#tabUTM'); await pg.waitForTimeout(100);
  await pg.fill('#eastIn','0'); await pg.fill('#northIn','0'); await pg.fill('#zoneIn','61');
  await pg.click('#btnUTM'); await pg.waitForTimeout(150);
  const e = await pg.locator('.msg-error').textContent();
  log(/Easting خارج المدى/.test(e) && /بين 1 و 60/.test(e), `منطقة 61 و Easting=0 يُرفضان معًا`);
  await ctx.close();
}

console.log('\n=== 9) الأمان: تهريب المحتوى القادم من الشبكة (SEC-02) ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/notifications.html',{waitUntil:'networkidle'});
  await pg.evaluate(async ()=>{
    await Store.addNotification({ icon:'⬆️', title:'<img src=x onerror="window.__PWN=1">',
      message:'<script>window.__PWN2=1<\/script><b>bold?</b>' });
  });
  await pg.reload({waitUntil:'networkidle'}); await pg.waitForTimeout(300);
  const pwn = await pg.evaluate(()=>({a:window.__PWN,b:window.__PWN2,imgs:document.querySelectorAll('#list img').length,bolds:document.querySelectorAll('#list b').length}));
  const shown = await pg.locator('.notif-item .t').first().textContent();
  log(!pwn.a && !pwn.b && pwn.imgs===0 && pwn.bolds===0, `الحقن مُحبَط: imgs=${pwn.imgs} bold=${pwn.bolds} PWN=${!!pwn.a||!!pwn.b}`);
  log(shown.includes('<img'), `النص يُعرض حرفيًا: ${shown.slice(0,32)}...`);
  await ctx.close();
}

console.log('\n=== 10) الأمان: رفض المستودع غير الموثوق والبصمة الناقصة (SEC-03) ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/settings.html',{waitUntil:'networkidle'});
  const r = await pg.evaluate(()=>{
    const good = 'https://raw.githubusercontent.com/tahershawki1/SURVEY-ASSISTANT/main/updates/b.zip';
    const evil = 'https://evil.example.com/b.zip';
    const evil2 = 'https://raw.githubusercontent.com/attacker/repo/main/b.zip';
    const sha = 'a'.repeat(64);
    return {
      trustGood: Updater.isTrustedBundleUrl(good),
      trustEvil: Updater.isTrustedBundleUrl(evil),
      trustEvil2: Updater.isTrustedBundleUrl(evil2),
      noChecksum: Updater.validateManifest({version:'9.9.9', url:good}),
      badChecksum: Updater.validateManifest({version:'9.9.9', url:good, checksum:'xx'}),
      evilUrl: Updater.validateManifest({version:'9.9.9', url:evil, checksum:sha}),
      valid: Updater.validateManifest({version:'9.9.9', url:good, checksum:sha}),
      settingsHasOwner: 'ghOwner' in window || !!document.getElementById('ghOwner'),
    };
  });
  log(r.trustGood && !r.trustEvil && !r.trustEvil2, `رابط الحزمة: الرسمي مقبول، evil.example مرفوض، مستودع آخر مرفوض`);
  log(r.noChecksum.length>0 && /بصمة/.test(r.noChecksum.join()), `manifest بلا checksum يُرفض`);
  log(r.badChecksum.length>0 && r.evilUrl.length>0 && r.valid.length===0, `بصمة تالفة ورابط غريب يُرفضان، والصحيح يُقبل`);
  log(!r.settingsHasOwner, `حقول تغيير المستودع أُزيلت من الإعدادات`);
  const src = await pg.locator('#sourceBox').textContent();
  log(/SHA-256 إلزامي/.test(src), `الإعدادات تعرض المصدر المثبّت للقراءة فقط`);
  await ctx.close();
}

console.log('\n=== 11) التنبيهات تتراكم ولا تطبع فوق بعضها (UI-07) ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/index.html',{waitUntil:'networkidle'});
  await pg.evaluate(()=>{ UI.toast('أول'); UI.toast('ثانٍ','success'); UI.toast('ثالث','error'); });
  await pg.waitForTimeout(250);
  const boxes = await pg.evaluate(()=>[...document.querySelectorAll('.toast')].map(t=>t.getBoundingClientRect().top));
  const distinct = new Set(boxes.map(Math.round)).size;
  log(boxes.length===3 && distinct===3, `${boxes.length} تنبيهات في ${distinct} مواضع مختلفة: ${boxes.map(Math.round).join(', ')}`);
  await ctx.close();
}

console.log('\n=== 12) حالات التركيز والوصول ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/index.html',{waitUntil:'networkidle'});
  const aria = await pg.evaluate(()=>{
    const btns=[...document.querySelectorAll('button, a')];
    const unnamed = btns.filter(b=>!(b.textContent||'').trim() && !b.getAttribute('aria-label')).length;
    return { total: btns.length, unnamed,
      themeLabel: document.querySelector('[data-theme-toggle]').getAttribute('aria-label'),
      navLabel: document.getElementById('appNav').getAttribute('aria-label'),
      current: document.querySelector('.nav-item[aria-current="page"]')?.textContent.trim() };
  });
  log(aria.unnamed===0, `كل الأزرار والروابط لها اسم منطوق (${aria.total} عنصر، ${aria.unnamed} بلا اسم)`);
  log(!!aria.themeLabel && !!aria.navLabel, `aria-label للمظهر والتنقّل موجود`);
  await pg.keyboard.press('Tab'); await pg.keyboard.press('Tab');
  const outline = await pg.evaluate(()=>getComputedStyle(document.activeElement).outlineWidth);
  log(outline!=='0px', `حالة التركيز مرئية: outline ${outline}`);
  await ctx.close();
}

console.log('\n=== 13) الدفتر الميداني: بحث + تعديل + تصدير ===');
{
  const {pg,ctx} = await newPage();
  await pg.goto(B+'/pages/fieldnotes.html',{waitUntil:'networkidle'});
  await pg.fill('#noteText','نقطة تحكم رقم 7 عند البوابة'); await pg.click('#btnSave'); await pg.waitForTimeout(200);
  await pg.fill('#noteText','ملاحظة أخرى عن الردم'); await pg.click('#btnSave'); await pg.waitForTimeout(200);
  log((await pg.locator('#noteCount').textContent())==='2', `حُفظت ملاحظتان`);
  await pg.fill('#search','الردم'); await pg.waitForTimeout(200);
  log((await pg.locator('.notif-item').count())===1, `البحث يصفّي إلى نتيجة واحدة`);
  await pg.fill('#search',''); await pg.waitForTimeout(200);
  await pg.locator('[data-edit]').first().click(); await pg.waitForTimeout(200);
  log((await pg.locator('#btnSave').textContent()).includes('التعديل'), `وضع التعديل يعمل`);
  const xsv = await pg.locator('#exportBar').isVisible();
  log(xsv, `شريط التصدير ظاهر`);
  await ctx.close();
}

console.log(`\n${'='.repeat(52)}\n${fails===0 ? 'كل الاختبارات نجحت ✅' : fails+' اختبار فشل ❌'}`);
await browser.close(); server.close();
process.exit(fails?1:0);

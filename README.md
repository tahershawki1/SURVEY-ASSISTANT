# مساعد المساحة (Masaha Assistant)

تطبيق هاتف محمول مبني على **Capacitor** لمهندسي المساحة، يحتوي على أدوات ميدانية (تحويل إحداثيات، حساب مساحات ومسافات، تفريغ ميزانية، تسوية مضلعات، دفتر ميداني)، مع نظام **تحديث تلقائي عبر الإنترنت (OTA)** يعمل بدون الحاجة لإعادة رفع التطبيق على المتاجر، ومركز إشعارات داخل التطبيق يُنبّه المستخدم عند وصول تحديث جديد.

## 1. هيكل المشروع

```
www/                  ملفات الواجهة (HTML/CSS/JS) - هذا ما يراه المستخدم داخل التطبيق
src/native.js          نقطة تجميع إضافات Capacitor (يُبنى إلى www/js/native-bundle.js عبر esbuild)
android/ ، ios/        المشروعان الأصليان الناتجان عن Capacitor
updates/                يُنشئه GitHub Actions تلقائيًا: manifest.json + حزم zip للتحديثات
.github/workflows/      خط أنابيب النشر التلقائي للتحديثات
```

## 2. رفع المشروع إلى GitHub

```bash
git init
git add .
git commit -m "أول نسخة من التطبيق"
git branch -M main
git remote add origin https://github.com/tahershawki1/SURVEY-ASSISTANT.git
git push -u origin main
```

بعد أول رفع، تأكد أن **GitHub Actions** مُفعّلة على المستودع (Settings → Actions → General → Allow all actions)، وأن صلاحية الكتابة متاحة لـ `GITHUB_TOKEN` (Settings → Actions → General → Workflow permissions → Read and write permissions).

## 3. كيف يعمل التحديث التلقائي (OTA)

1. أنت تعدّل أي ملف داخل `www/` أو `src/` وتعمل `git push` على فرع `main`.
2. تعمل GitHub Action تلقائيًا (`.github/workflows/publish-update.yml`):
   - تبني حزمة الواجهة (`www/`) كملف zip.
   - تزيد رقم الإصدار تلقائيًا (Patch)، أو يمكنك تحديد رقم إصدار وملاحظات يدويًا عبر تشغيل الـ Workflow يدويًا (Actions → نشر تحديث OTA للتطبيق → Run workflow).
   - تنشر `updates/manifest.json` + ملف الحزمة داخل نفس المستودع (عبر `raw.githubusercontent.com`، لا حاجة لخادم منفصل).
3. التطبيق المثبت على هاتف المستخدم يتحقق من `updates/manifest.json` دوريًا (كل عدة ساعات حسب الإعداد، أو يدويًا من صفحة الإعدادات/الإشعارات).
4. إن وجد إصدارًا أحدث:
   - يضيف إشعارًا في **مركز الإشعارات** + إشعار محلي على الهاتف.
   - يُنزّل الحزمة الجديدة في الخلفية عبر `@capgo/capacitor-updater`.
   - يُفعّلها تلقائيًا في المرة التالية التي يغادر/يعيد فتح فيها المستخدم التطبيق — بدون أي تدخل يدوي وبدون المرور بمتجر التطبيقات.

> **ملاحظة تقنية:** بخلاف الاستخدام النمطي لإضافة `@capgo/capacitor-updater` (التي تعتمد عادة على خادم يستقبل طلب POST من التطبيق)، هذا المشروع يستخدم آلية "فحص ثابت" مبسّطة (GET إلى ملف JSON مستضاف مباشرة داخل مستودع GitHub) لأنها تعمل تمامًا بدون الحاجة لتشغيل أي خادم — فقط GitHub. المنطق بالكامل موجود في `www/js/updater.js`.

## 4. الإعدادات القابلة للتعديل داخل التطبيق

من صفحة **الإعدادات** داخل التطبيق يمكن تغيير:
- اسم المستخدم/المستودع على GitHub (مضبوط افتراضيًا على `tahershawki1/SURVEY-ASSISTANT`).
- الفرع (افتراضيًا `main`).
- تفعيل/تعطيل الفحص التلقائي وعدد ساعات الفحص.

نفس القيم الافتراضية موجودة في `www/js/storage.js` (`DEFAULT_SETTINGS`) إن أردت تغييرها في الكود مباشرة.

## 5. البناء المحلي وتشغيل التطبيق

```bash
npm install
npm run sync        # يبني native-bundle.js وينسخ www/ إلى android/ و ios/

npx cap open android   # يفتح المشروع في Android Studio لتشغيله/بنائه كـ APK
npx cap open ios       # يفتح المشروع في Xcode (يتطلب جهاز Mac)
```

بعد أي تعديل على ملفات `www/`، نفّذ `npm run sync` قبل إعادة البناء من Android Studio/Xcode.

### 5.1 بناء ملف APK عبر GitHub Actions (بدون Android Studio)

لست مضطرًا لتثبيت Android Studio على جهازك: يوجد Workflow جاهز يبني ملف APK كاملًا على خوادم GitHub.

**كيف تشغّله:** Actions → **بناء تطبيق أندرويد (APK)** → Run workflow.
كما يعمل تلقائيًا عند أي تعديل على `android/` أو `src/` أو `capacitor.config.json` أو `package.json` في فرع `main`.

**من أين تنزّل الملف:**
- من صفحة الـ Run نفسها ضمن **Artifacts** باسم `masaha-assistant-debug-apk`.
- أو من رابط ثابت لا يتغير بعد كل بناء على فرع `main`:
  <https://github.com/tahershawki1/SURVEY-ASSISTANT/releases/download/android-debug-latest/app-debug.apk>

> النسخة الناتجة هي **Debug** للتجربة والتثبيت اليدوي على الهاتف (فعّل "تثبيت من مصادر غير معروفة")، وليست موقّعة للنشر على Google Play.

**متطلبات البيئة المستخدمة في البناء:** Node 22 (إجباري — Capacitor CLI 8 لا يعمل على Node 20)، JDK 21، و Android SDK 36 مع build-tools 36.0.0.

### 5.2 توقيع نسخة الإصدار (Signed Release APK)

نسخة **Debug** كافية للتجربة، لكن التوزيع الحقيقي (وأي نشر مستقبلي على Google Play) يحتاج نسخة **موقّعة**. خط البناء يدعم ذلك تلقائيًا بمجرد ضبط أربعة أسرار في المستودع.

#### أولًا: إنشاء مفتاح التوقيع (مرة واحدة فقط)

```bash
keytool -genkeypair -v \
  -keystore masaha-release.jks \
  -alias masaha \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -dname "CN=Masaha Assistant, OU=Surveying Tools, O=Masaha, L=Cairo, C=EG"
```

> ⚠️ **احتفظ بهذا الملف وكلمة مروره في مكان آمن ولا ترفعه إلى المستودع أبدًا** (‏`.gitignore` يمنع ذلك). فقدان المفتاح يعني أنك لن تستطيع إصدار تحديث للتطبيق بنفس الهوية على Google Play إطلاقًا.

#### ثانيًا: إضافة الأسرار في GitHub

من **Settings → Secrets and variables → Actions → New repository secret**، أضف:

| اسم السرّ | القيمة |
|---|---|
| `ANDROID_KEYSTORE_BASE64` | ناتج `base64 -w 0 masaha-release.jks` |
| `ANDROID_KEYSTORE_PASSWORD` | كلمة مرور الـ keystore |
| `ANDROID_KEY_ALIAS` | `masaha` |
| `ANDROID_KEY_PASSWORD` | كلمة مرور المفتاح (نفس السابقة عادةً) |

#### ثالثًا

شغّل workflow **بناء تطبيق أندرويد (APK)** كالمعتاد. عند وجود الأسرار سيبني نسخة موقّعة إضافية، ويتحقق من توقيعها بـ `apksigner`، وينشرها في نفس الـ Release باسم `app-release.apk`:

<https://github.com/tahershawki1/SURVEY-ASSISTANT/releases/download/android-debug-latest/app-release.apk>

إن لم تُضبط الأسرار، يتخطى البناء نسخة الإصدار بهدوء ويكتفي بـ Debug — فلا يفشل خط البناء.

**للبناء الموقّع محليًا:**

```bash
MASAHA_KEYSTORE_FILE=/path/to/masaha-release.jks \
MASAHA_KEYSTORE_PASSWORD=... \
MASAHA_KEY_ALIAS=masaha \
MASAHA_KEY_PASSWORD=... \
  ./android/gradlew -p android assembleRelease
```

## 6. إضافة صفحات/أدوات جديدة لاحقًا

كل أداة عبارة عن صفحة HTML مستقلة داخل `www/pages/` + ملف منطق داخل `www/js/tools/`. لإضافة أداة جديدة:
1. أنشئ `www/pages/tool-name.html` (انسخ من صفحة موجودة كقالب للرأس/التذييل).
2. أضف منطق الحساب في `www/js/tools/tool-name.js`.
3. أضف بطاقة الأداة في `www/index.html` ضمن `.tool-grid`.
4. اعمل `git push` — التحديث سيصل للمستخدمين تلقائيًا عبر OTA بدون الحاجة لرفع نسخة جديدة على المتجر.

## 7. الإشعارات المحلية على أندرويد

عند أول تشغيل، سيطلب التطبيق إذن الإشعارات (Android 13+) تلقائيًا عند أول عملية فحص للتحديثات ناجحة تحتوي على إصدار جديد.

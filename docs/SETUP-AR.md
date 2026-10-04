# دليل الإعداد: سجل العقارات على الإنترنت + النشر التلقائي على فيسبوك وإنستغرام

> ⚠️ لا ترسل أبداً كلمات السر أو المفاتيح في المحادثة. ضعها فقط في «الأسرار» (Secrets) الخاصة بمكان استضافة الموقع.

بدون هذه الإعدادات يبقى التطبيق يعمل كما كان: الحفظ على الجهاز فقط، والنشر بطريقة «نسخ وفتح».

---

## الجزء الأول: Firebase (حفظ السجل على الإنترنت + تسجيل دخول المدير)

1. ادخل إلى https://console.firebase.google.com بحساب Google الخاص بالمكتب، واضغط **Add project** (إنشاء مشروع)، مثلاً باسم `alwassit777`.
2. **Authentication** ← Get started ← فعّل **Email/Password**.
   ثم في تبويب **Users** اضغط **Add user** وأدخل بريدك وكلمة سر قوية. هذا هو حساب الدخول للتطبيق.
3. **Firestore Database** ← Create database ← اختر المنطقة `europe-west` (الأقرب للمغرب).
4. **Storage** ← Get started (لحفظ الصور والفيديو والمستندات).
5. **قواعد الحماية**: افتح الملفين `firestore.rules` و `storage.rules` في المشروع، وغيّر
   `REMPLACER_PAR_VOTRE_EMAIL@exemple.com` إلى بريدك، ثم انسخ كل ملف إلى:
   - Firestore ← **Rules** ← Publish
   - Storage ← **Rules** ← Publish
6. **Project settings** (⚙️) ← **Your apps** ← اضغط أيقونة الويب `</>` لإضافة تطبيق ويب.
   ستظهر قيم `apiKey`، `authDomain`، `projectId`، `storageBucket`، `appId`. ضعها في الأسرار بهذه الأسماء:

| الاسم | القيمة |
|---|---|
| `VITE_FIREBASE_API_KEY` | apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | authDomain |
| `VITE_FIREBASE_PROJECT_ID` | projectId |
| `VITE_FIREBASE_STORAGE_BUCKET` | storageBucket |
| `VITE_FIREBASE_APP_ID` | appId |
| `ADMIN_EMAILS` | بريدك (نفس بريد الخطوة 2) |

بعد ذلك، يطلب قسم «سجل العقارات و المالكين» تسجيل الدخول، وتجد نفس البيانات في الهاتف والحاسوب.

---

## الجزء الثاني: Meta (النشر التلقائي على فيسبوك وإنستغرام)

الشرط: حساب إنستغرام مهني (Business) مربوط بصفحة فيسبوك (عندك هذا ✅).

1. ادخل إلى https://developers.facebook.com ← **My Apps** ← **Create App** ← نوع **Business**.
2. أضف المنتجات: **Facebook Login for Business** و **Instagram Graph API**.
3. افتح **Graph API Explorer** (من قائمة Tools)، اختر تطبيقك، ثم اطلب الصلاحيات:
   `pages_show_list`، `pages_read_engagement`، `pages_manage_posts`، `instagram_basic`، `instagram_content_publish`، `business_management`.
   اضغط **Generate Access Token** ووافق.
4. حوّل المفتاح إلى مفتاح طويل المدة (**Access Token Debugger** ← Extend Access Token)، ثم في Explorer نفّذ الطلب `me/accounts`.
   ستجد صفحتك مع `id` الخاص بها و `access_token` (هذا هو **مفتاح الصفحة**).
5. للحصول على معرّف إنستغرام نفّذ الطلب: `{id-الصفحة}?fields=instagram_business_account`.
6. ضع في الأسرار (على الخادم فقط):

| الاسم | القيمة |
|---|---|
| `META_PAGE_ID` | معرّف الصفحة |
| `META_PAGE_ACCESS_TOKEN` | مفتاح الصفحة (سري جداً) |
| `META_IG_USER_ID` | معرّف حساب إنستغرام |

بعد ذلك، في قسم «الإعلانات» ← «الجدولة» تظهر عبارة **Facebook: مربوط / Instagram: مربوط**. سجّل الدخول وفعّل خانة «النشر تلقائياً».

---

## الجزء الثالث: نشر الموقع ووضعه في الهاتف (Google AI Studio)

الموقع والخادم أصبحا برنامجاً واحداً (`server.ts`)، وهذا ما يحتاجه AI Studio للنشر على Google Cloud Run.

1. **ادمج طلبات GitHub** (Merge pull request) لتصبح التعديلات في الفرع `main`.
2. **افتح مشروعك في AI Studio** (https://aistudio.google.com) ← قسم **Build** ← مشروع «Al Wassit 777».
3. **اسحب التعديلات من GitHub**: في إعدادات المزامنة مع GitHub اختر سحب التغييرات (Pull) من الفرع `main`.
   إذا لم يكن المشروع مربوطاً بعد، استعمل **Import from GitHub** واختر المستودع `alwasset777-ai/al-wasset-777`.
4. **ضع الأسرار** في لوحة **Secrets** داخل AI Studio:
   `GEMINI_API_KEY` + قيم Firebase (`VITE_FIREBASE_...` و `ADMIN_EMAILS`) + قيم Meta (`META_...`) كما في الجزأين الأول والثاني.
5. اضغط **Deploy** (نشر على Cloud Run). ستحصل على رابط عام يبدأ بـ `https://`.
6. **في الهاتف**: افتح الرابط.
   - **أندرويد (Chrome)**: افتح «كلّم الوكيل» ← «ثبّت التطبيق على هذا الهاتف»، أو من قائمة ⋮ ← «إضافة إلى الشاشة الرئيسية».
   - **آيفون (Safari)**: زر المشاركة ⬆️ ← «إضافة إلى الشاشة الرئيسية».
   تظهر أيقونة **الوسيط 777** في الهاتف.

> بعد كل تعديل جديد على GitHub: اسحب التغييرات في AI Studio ثم اضغط Deploy مرة أخرى.

### التشغيل على الحاسوب (للتجربة)
- `npm run dev` ثم افتح http://localhost:3000
- للإنتاج: `npm run build` ثم `npm start`

## حدود يجب معرفتها

- **النشر في الوقت المبرمج** يعمل ما دام التطبيق مفتوحاً على جهاز ما (حاسوب أو هاتف). عند فتح التطبيق، تُنشر المنشورات التي حان وقتها.
- **إنستغرام** ينشر الصور فقط حالياً. الفيديو (Reels) يحتاج صيغة MP4، وهي غير متوفرة بعد.
- **باقي المنصات** (تيك توك، سناب، X، لينكدإن، ثريدز، واتساب، أفيتو، مبوب، صاروتي) تبقى بطريقة «نسخ وفتح».

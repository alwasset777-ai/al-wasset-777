# CLAUDE.md – مكتب الوسيط 777

## اللغة (مهم)
- أجب دائماً **بالعربية** في المحادثة مع صاحب المشروع (السيد منير رادوي)، بأسلوب بسيط وواضح، بدون مصطلحات تقنية معقدة.
- **بالعربية فقط حتى لو كتب بالفرنسية أو بأي لغة أخرى**، ويمكن استعمال الدارجة المغربية إذا كتب بها.
- **الشعار**: الشعار فيه 777 أصلاً ← ما تكتبش «777» حدا الشعار ولا مع الشعار (رأس الموقع، التذييل، رأس الوكيل، الأغلفة، العلامة المائية) — غير «مجموعة الوسيط». «عرض 777» كاسم العرض كيبقى. نسخ الشعار: `public/brand/logo-alwasset777.webp` (المدوّر)، `logo-flat.webp` و`logo-flat-white.webp` (بلا دائرة، خلفية شفافة).

## عن المشروع
- موقع وتطبيق مكتب **الوسيط 777 للخدمات العقارية** بمكناس (React + Vite + Tailwind، خادم `server.ts` بـ Express).
- الأقسام المضافة: «الإعلانات» (وكيل إعلانات ذكي)، «سجل العقارات و المالكين»، المساعد «وكيل الوسيط 777» (محادثة نصية وصوتية)، والتطبيق قابل للتثبيت على الهاتف (PWA).
- معلومات المكتب في `src/data/agencyProfile.ts`، ودليل الإعداد بالعربية في `docs/SETUP-AR.md`.
- الوكيل الذكي: أدواته معرّفة في `src/agent/toolDefs.ts` (وضعان: `manager` للمدير و`customer` لزبائن الموقع)، وتُنفّذ في المتصفح عبر `src/agent/executor.ts`، والخادم (`app.ts` ← `/api/agent/chat`) يمرّرها إلى Gemini.
- «استوديو النشر» (`src/components/PublishStudioView.tsx`): صور + معلومات العقار + شعارات المنصات ← صورة إعلانية مرسومة في المتصفح (`src/services/posterMaker.ts`) بمقاس كل منصة (`studioPlatforms.ts`) ← نصوص بالذكاء الاصطناعي (`/api/studio/posts`) ← نشر عبر Metricool (`metricool.ts`) أو Meta. الإعداد في الجزء الرابع من `docs/SETUP-AR.md`. 25 قالباً احترافياً (أساليب «agence» و«luxe» و«fiche» على أمثلة المدير) متكيفاً مع كل مقاس في `src/services/proTemplates.ts` (أدوات الرسم في `posterKit.ts`)، وسجلّ القوالب + قوالب المستعمل (صورة + خانات، `templateStore.ts`، محررها `TemplateEditor.tsx`) في `posterTemplates.ts`. معلومات الوكالة على الإعلانات تأتي من «إعدادات الوكالة» (`agencySettings.ts`: الشعار، رمز QR، الاسم، الهواتف، العنوان، الشبكات؛ الواجهة `AgencySettingsPanel.tsx`، فارغة افتراضياً ومحفوظة في المتصفح) وليس من `agencyProfile.ts`. نفس الصفحة كتطبيق مستقل للمدير على `/studio` (`src/StudioApp.tsx`، يختاره `src/main.tsx`، مع `public/manifest-studio.webmanifest`).
- «المكتب الافتراضي» (`bureau-virtuel/`، Python مستقل عن الموقع، يشتغل على حاسوب المدير): 7 وكلاء (LangGraph) في مكتب pixel art (Phaser) مع أزرار «✅ Valider / ❌ Refuser» على الشاشة وTelegram. كل نشر/صرف/تعديل للقاعدة ينتظر موافقة المدير (`actions.py`)، والحملات تُنشأ دائماً متوقفة بسقف ميزانية. التثبيت على الماك بأمر واحد (`bureau-virtuel/installer-mac.sh`، تشغيل تلقائي عبر launchd في `~/BureauVirtuel`) وصفحة «الإعدادات» بالعربية `/reglages` (لصق المفاتيح، ربط تيليغرام بزر، رمز Meta واحد يكتشف الصفحة/إنستغرام/حساب الإشهار، `reglages.py`)؛ كل طلب POST يحتاج الترويسة `X-Bureau: 1`. الدليل بالفرنسية في `bureau-virtuel/README.md`، والاختبارات: `cd bureau-virtuel && python -m pytest -q tests`.
- خدمة «النمو · Croissance» (بيع تصاور الإعلانات للوكالات الأخرى + المداخيل + الفرص المنقطة /30): البيانات في `src/services/growthStore.ts` (محفوظة في المتصفح، 15 وكالة مبدئية)، و6 أدوات للوكيل «منير» في وضع المدير (`growth_summary`، `list_agency_prospects`، `save_agency_prospect`، `add_revenue` للمداخيل الحقيقية فقط، `log_growth_signal`، `growth_script`). نفس المعطيات في المستودع الخاص `alwasset777-ai/money-skills-lab`.
- «منير» كيقرا الوثائق (زر 📎 فوضع المدير): تصويرة ولا PDF ديال البطاقة / شهادة الملكية / عقد ← `/api/agent/read-document` (Gemini، ما كيتسجل والو فالخادم) ← فيشة قابلة للتعديل (`DocumentReviewCard.tsx`، `src/services/documentReader.ts`، الصور كتصغّر لأقل من 3 ميغا) ← كتسجل فـ«سجل العقارات» مع الوثيقة غير من بعد موافقة المدير.
- الوكيل الشخصي ديال المدير سميتو **monymounir** (`agencyProfile.agentNameAr`، و`MANAGER_SYSTEM` فـ`app.ts`). تطبيق مستقل قابل للتثبيت اسمو **i.wasset** على `/iwasset` (والعنوان القديم `/monymounir` كيخدم حتى هو؛ `public/manifest-iwasset.webmanifest`، الأيقونات `public/icons/iwasset-*`، يختارو `src/main.tsx`)، بألوان الأبيض والأحمر `#d71920` والأسود `#111111` كيفتح مباشرة على الوكيل. لوحة «🏆 إنجازاتي» (`AchievementsPanel.tsx`) كتعرض غير الأعمال الحقيقية المسجلة فـ`src/services/agentLog.ts` (كل أداة نجحات فوضع المدير + الوثائق).
- الموقع منشور على Vercel: https://al-wasset-777.vercel.app (كل دمج في `main` يُنشر تلقائياً).

## أوامر
- خادم واحد `server.ts` يشغّل الموقع والـ API معاً: `npm run dev` للتطوير، `npm run build && npm start` للإنتاج (Cloud Run / AI Studio)، `npm run lint` للتحقق.
- الحزم تُدار بـ `bun` (ملف `bun.lock`).

## طريقة الخدمة
- **قبل أي خدمة** طبّق الـ skill `brief-first` (`.claude/skills/brief-first/SKILL.md`): ملخص مهني دقيق + 2–3 أفكار جديدة، فابور فقط، وفالأخير شنو تدار/تجرب/ما تجربش.

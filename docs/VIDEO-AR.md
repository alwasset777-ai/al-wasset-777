# فيلم «الوسيط 777… مستقبل مهنتك يبدأ الآن»

الفيلم الترويجي التعليمي لتطبيق **مجموعة الوسيط 777**، مصنوع حرفيا من ملف السيناريو (PDF، 44 صفحة):
عمودي بصيغة الهاتف، بالعربية، مع تعليق صوتي وموسيقى ومؤثرات صوتية وصور شاشات التطبيق.

| الملف | المحتوى |
|---|---|
| `public/videos/film-al-wasset-777.mp4` | **الفيلم الكامل**: الافتتاحية، لماذا الوسيط 777، الأجزاء الأربعة (34 مشهدا) والخاتمة — مع كل الخطوات والنصائح |
| `public/videos/film-al-wasset-777-court.mp4` | **النسخة القصيرة** (كما يقترح السيناريو): الافتتاحية، المشاهد 1، 11، 17، 18، 19، 28، 29، والخاتمة |
| `public/videos/film-al-wasset-777.jpg` | صورة الغلاف |
| `public/videos/film-al-wasset-777-fr.mp4` و`-fr-court.mp4` | **النسخة الفرنسية** (الفيلم الكامل والنسخة القصيرة) |
| `public/videos/film-al-wasset-777-en.mp4` و`-en-court.mp4` | **النسخة الإنجليزية** (الفيلم الكامل والنسخة القصيرة) |

## النسختان الفرنسية والإنجليزية
- نفس الفيلم مشهدا بمشهد (نفس الصور والموسيقى والمؤثرات)، مع ترجمة كاملة للتعليق والخطوات والنصائح، والكتابة من اليسار إلى اليمين.
- الأصوات: بالفرنسية صوت رجل (tom) للتعليق وصوت امرأة (siwis) للخطوات؛ بالإنجليزية صوت رجل (john) وصوت امرأة (ljspeech).
- في الموقع: أزرار «العربية · Français · English» تحت الفيديو، والفيلم يتبع لغة الموقع تلقائيا.
- في «إدارة الوكالة ← فيديو الترحيب»: اختر لغة الفيلم، فتُكتب رسالة واتساب بنفس اللغة مع الرابط المناسب (`#bienvenue-fr` أو `#bienvenue-en`).

## كيف بُني كل مشهد (حسب السيناريو)
- **اللوحة**: «🎬 المشهد … · داخلي/خارجي — المكان — الوقت»، رقم المشهد، العنوان و«✦» الشعار الفرعي. لون الخلفية يتبع وقت المشهد (شروق، صباح، نهار، عصر، مساء، ليل).
- **التعليق الصوتي** (صوت رجل): نص السيناريو كاملا مع الوقفات «…»، ومكتوب أسفل الشاشة.
- **نص الشاشة** بالذهبي، و**صور التطبيق** من الملف داخل هواتف.
- **خطوة بخطوة** (صوت امرأة): كل خطوة تظهر وتُقرأ، ثم **💡 نصيحة احترافية**.
- **الموسيقى** تتبع تعليمات كل مشهد وتتصاعد حتى المشهد 18 ثم الخاتمة، و**المؤثرات** (رنين، ساعة، «ووش»، قفل، نقرات، إشعار، «بووم»…).
- مؤثرات الكاميرا الممكنة بدون تصوير: زوم بطيء، أبيض وأسود ← ألوان (المشهد 9)، وميض (11 و18)، لقطات خاطفة للشاشات في الخاتمة، ثم الشعار ورقم واتساب ثابتين 5 ثوان.

## الإرسال لكل مشترك
في التطبيق: **إدارة الوكالة ← فيديو الترحيب**
- زر **واتساب** بجانب كل زبون: رسالة جاهزة باسمه + رابط الفيلم (`https://al-wasset-777.vercel.app/#bienvenue`)، ويُسجَّل أنه توصّل.
- **مشاركة النسخة القصيرة**: يرسل ملف الفيديو نفسه (من الهاتف) — اختر واتساب ثم «قائمة البث».
- في الصفحة الرئيسية يشاهد المشترك الفيلم الكامل أو النسخة القصيرة.

## تعديل الفيلم (للمطوّر) — `tools/film/`
- `content.json`: نص السيناريو مشهدا بمشهد (النص المعروض `text` والنص المشكول للصوت `tts`)، الصور، المؤثرات، الموسيقى.
- `content.fr.json` و`content.en.json`: الترجمة الفرنسية والإنجليزية (نفس البنية، مع `lang` و`ui`، و`tts` مكتوب للنطق: الأرقام بالحروف…).
- `build.py`: يصنع الصوت (sherpa-onnx، أصوات Piper العربية) والتوقيت → `build/timeline.js` و`build/film-audio.m4a`.
- `film.html`: تصميم المشاهد (يُرسم صورة بصورة)، `render.mjs`: التصوير والترميز (ffmpeg).
- `speak.py`: تحويل النص إلى نص منطوق مشكول، `tts_check.py`: فحص النطق (الصوت ← Whisper ← مقارنة).

```bash
export TTS_MODELS=/path/to/voices   # مجلد الأصوات (انظر الأسفل)
python3 tools/film/build.py                                   # الفيلم الكامل
node tools/film/render.mjs --scale 720 --out build/film.mp4
python3 tools/film/build.py --short --only A,B,1,11,17,18,19,28,29,END --name court
node tools/film/render.mjs --tl timeline-court --audio build/court-audio.m4a --scale 720 --out build/court.mp4
node tools/film/render.mjs --preview 5,60,300                 # صور للمراجعة
# النسخة الفرنسية (نفس الشيء بالإنجليزية مع en)
python3 tools/film/build.py --content tools/film/content.fr.json --name fr
node tools/film/render.mjs --tl timeline-fr --audio build/fr-audio.m4a --scale 720 --out build/fr.mp4
python3 tools/film/build.py --content tools/film/content.fr.json --short --only A,B,1,11,17,18,19,28,29,END --name fr-court
node tools/film/render.mjs --tl timeline-fr-court --audio build/fr-court-audio.m4a --scale 720 --out build/fr-court.mp4
```
الأصوات: https://github.com/k2-fsa/sherpa-onnx/releases/tag/tts-models (`vits-piper-ar_JO-kareem-medium`، `vits-piper-ar_JO-SA_dii-high`، `vits-piper-fr_FR-tom-medium`، `vits-piper-fr_FR-siwis-medium`، `vits-piper-en_US-john-medium`، `vits-piper-en_US-ljspeech-high`) — Python: `sherpa-onnx soundfile numpy mishkal num2words`.

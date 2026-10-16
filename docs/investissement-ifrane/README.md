# ملفات الاستثمار — أرض 7 هكتارات بإفران

ثلاثة مشاريع × ثلاث لغات = 9 ملفات PDF في المجلد `pdf/`:

| المشروع | الفرنسية | الإنجليزية | العربية |
|---|---|---|---|
| A — أرز: منتجع إيكولوجي فاخر + 14 إقامة | `A-ARZ-Eco-Resort_FR.pdf` | `A-ARZ-Eco-Resort_EN.pdf` | `A-ARZ-Eco-Resort_AR.pdf` |
| B — إفران هايلاندز: قرية شاليهات وإقامات للبيع | `B-Ifrane-Highlands_FR.pdf` | `B-Ifrane-Highlands_EN.pdf` | `B-Ifrane-Highlands_AR.pdf` |
| C — صفاء: منتجع العافية وطول العمر | `C-SAFA-Longevity-Retreat_FR.pdf` | `C-SAFA-Longevity-Retreat_EN.pdf` | `C-SAFA-Longevity-Retreat_AR.pdf` |

## كيف تُصنع الملفات
- `build/model.py`: النموذج المالي الوحيد (كل الأرقام في اللغات الثلاث تأتي منه).
- `build/content_fr.py`، `content_en.py`، `content_ar.py`: النصوص.
- `build/svg.py`: الرسوم (المنظر، المخطط، المقاطع، الرسوم البيانية).
- لإعادة التوليد: `cd build && python3 build.py` (يتطلب Playwright/Chromium وخطوط Cairo وInter وPlayfair Display).

لتغيير فرضية (سعر الأرض، سعر الليلة، كلفة البناء…) عدّلها في `model.py` ثم أعد التوليد: تتغير الملفات التسعة معاً.

'use strict';
const $ = (id) => document.getElementById(id);
const AGENTS = [
  ['community', 'مسؤول التواصل (يحضّر الردود على الزبائن)'],
  ['db_manager', 'مسؤول قاعدة البيانات (يحسب العقارات والطلبات)'],
  ['auditor', 'المراقب (نسخة احتياطية يومية + المكررات)'],
  ['rnd', 'الباحث والجودة (يراقب الجودة ويبحث في GitHub)'],
  ['creatif', 'المبدع (نصوص + فيديو من صور العقار)'],
  ['media_buyer', 'مشتري الإشهار (يقترح حملات متوقفة بسقف ميزانية)'],
];

async function api(path, body) {
  const r = await fetch(path, body !== undefined
    ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bureau': '1' }, body: JSON.stringify(body) } : {});
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.detail || `خطأ ${r.status}`);
  return data;
}

function show(id, text, ok) {
  const m = $(id); if (!m) return;
  m.textContent = text; m.className = 'msg ' + (ok ? 'ok' : 'err');
}

function tag(id, on, textOn, textOff) {
  const t = $(id); t.className = 'tag ' + (on ? 'on' : 'off'); t.textContent = on ? textOn : textOff;
}

function render(s) {
  tag('t-gemini', s.gemini, '✅ مربوط', '○ غير مربوط');
  tag('t-telegram', s.telegram_lie, '✅ مربوط', s.telegram_token ? '◐ بقي الربط' : '○ غير مربوط');
  tag('t-firebase', !!s.firebase, '✅ ' + (s.firebase || ''), '○ غير مربوط');
  tag('t-meta', s.meta_page, '✅ مربوط' + (s.meta_pub ? ' + إشهار' : ''), '○ غير مربوط');
  tag('t-github', s.github, '✅ مربوط', 'اختياري');
  for (const [id, on] of [['c-gemini', s.gemini], ['c-telegram', s.telegram_lie], ['c-firebase', !!s.firebase], ['c-meta', s.meta_page]]) {
    $(id).classList.toggle('done', !!on);
  }
  const bind = $('tg-bind');
  if (s.telegram_lien) {
    const a = document.createElement('a');
    a.className = 'btn big green'; a.href = s.telegram_lien; a.target = '_blank'; a.rel = 'noopener';
    a.textContent = `🔗 ربط تيليغرام (@${s.telegram_bot})`;
    bind.replaceChildren(a);
  } else if (s.telegram_lie) {
    bind.textContent = '✅ (تم الربط)';
  }
  const done = [s.gemini, s.telegram_lie, !!s.firebase, s.meta_page].filter(Boolean).length;
  $('progress').textContent = `التقدم: ${done} من 4 خطوات أساسية — ` +
    (done === 4 ? '🎉 كل شيء مربوط!' : 'المكتب يعمل الآن، وكل خطوة تضيف له قدرة جديدة.');
  if (!$('budget').value) $('budget').value = s.budget_max;
  if (!$('heure').value) $('heure').value = s.heure;
  $('ffmpeg').textContent = s.ffmpeg ? '✅ جاهز' : '⚠️ غير متوفر (أعد تشغيل المثبّت)';
  const box = $('agents');
  if (!box.childElementCount) {
    for (const [id, label] of AGENTS) {
      const l = document.createElement('label');
      const c = document.createElement('input'); c.type = 'checkbox'; c.value = id; c.checked = s.agents_actifs.includes(id);
      l.append(c, document.createTextNode(label)); box.appendChild(l);
    }
  }
}

async function refresh() { try { render(await api('/api/reglages')); } catch (e) { $('progress').textContent = 'المكتب لا يجيب: ' + e.message; } }

document.querySelectorAll('[data-save]').forEach((b) => {
  b.onclick = async () => {
    const cle = b.dataset.save, input = $(b.dataset.input), valeur = input.value.trim();
    if (!valeur) { show('m-' + cle, 'الخانة فارغة', false); return; }
    b.disabled = true; show('m-' + cle, '… جاري التحقق', true);
    try {
      const r = await api('/api/reglages/cle', { cle, valeur });
      show('m-' + cle, r.message, true); if (input.type === 'password') input.value = ''; render(r.statut);
    } catch (e) { show('m-' + cle, e.message, false); }
    b.disabled = false;
  };
});

$('agents-save').onclick = async () => {
  const valeur = [...document.querySelectorAll('#agents input:checked')].map((c) => c.value);
  try { const r = await api('/api/reglages/cle', { cle: 'AGENTS_ACTIFS', valeur }); show('m-AGENTS_ACTIFS', r.message, true); }
  catch (e) { show('m-AGENTS_ACTIFS', e.message, false); }
};

$('tg-test').onclick = async () => {
  try { show('m-tgtest', (await api('/api/reglages/test-telegram', {})).message, true); } catch (e) { show('m-tgtest', e.message, false); }
};

$('fbfile').onchange = async (ev) => {
  const file = ev.target.files[0]; if (!file) return;
  show('m-firebase', '… جاري الربط', true);
  try { const r = await api('/api/reglages/firebase', { contenu: await file.text() }); show('m-firebase', r.message, true); render(r.statut); }
  catch (e) { show('m-firebase', e.message, false); }
  ev.target.value = '';
};

let lastMetaToken = '';
async function saveMeta(token, page_id, ad_id) {
  show('m-meta', '… جاري البحث عن صفحتك وحساباتك', true);
  try {
    const r = await api('/api/reglages/meta', { token, page_id, ad_id });
    show('m-meta', r.message, true); render(r.statut); lastMetaToken = token; $('metatoken').value = '';
    const d = r.details;
    if (d.pages.length > 1 || d.comptes_pub.length > 1) {
      $('meta-page').replaceChildren(...d.pages.map((p) => new Option('صفحة: ' + p.name, p.id, false, p.name === d.page)));
      $('meta-ad').replaceChildren(...d.comptes_pub.map((a) => new Option('إشهار: ' + a.name, a.id, false, a.name === d.pub)));
      $('meta-choose').hidden = false;
    }
  } catch (e) { show('m-meta', e.message, false); }
}
$('meta-save').onclick = () => { const t = $('metatoken').value.trim(); if (t) saveMeta(t); else show('m-meta', 'الخانة فارغة', false); };
$('meta-resave').onclick = () => lastMetaToken && saveMeta(lastMetaToken, $('meta-page').value, $('meta-ad').value || null);

$('copy-perms').onclick = async () => {
  try { await navigator.clipboard.writeText($('perms').textContent.trim()); $('copy-perms').textContent = '✅ تم النسخ'; } catch { /* rien */ }
};

refresh();
setInterval(refresh, 8000);  // le lien Telegram passe au vert tout seul dès que vous appuyez sur « Start »

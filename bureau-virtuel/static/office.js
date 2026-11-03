/* Bureau Virtuel — décor pixel art dessiné par le code (aucune image à télécharger),
   personnages animés, bulles, et panneau de validation. */
'use strict';

const W = 960, H = 620, U = 3; // U = taille d'un « pixel » du décor
const LABELS = { ceo: 'Directeur', creatif: 'Créatif', community: 'Community', media_buyer: 'Media Buyer',
  db_manager: 'DB Manager', auditor: 'Data Auditor', rnd: 'R&D / QA' };
const DESKS = {
  ceo: { x: 480, y: 165 }, creatif: { x: 150, y: 250 }, community: { x: 150, y: 440 },
  media_buyer: { x: 810, y: 250 }, db_manager: { x: 810, y: 440 }, auditor: { x: 360, y: 565 }, rnd: { x: 600, y: 565 },
};
const LOOK = {  // couleur de chemise, cheveux, peau, cravate
  ceo: ['#2b2f3a', '#1d1a17', '#e0ac69', '#c0392b'], creatif: ['#e5484d', '#7a3e1d', '#c68642', '#ffd166'],
  community: ['#3e63dd', '#111111', '#f1c27d', '#9ec5ff'], media_buyer: ['#30a46c', '#3b2a1a', '#8d5524', '#c7f0d8'],
  db_manager: ['#8e4ec6', '#2a2a2a', '#e0ac69', '#e9d5ff'], auditor: ['#12a594', '#c9a227', '#ffdbac', '#b8f2e6'],
  rnd: ['#d6409f', '#4a2c2a', '#c68642', '#ffd1ec'],
};
const TABLE = { x: 480, y: 355 };
const agents = {};
let scene = null;

/* ---------- Personnages en pixel art (12 × 18) ---------- */
const BODY_TOP = [
  '....HHHH....', '...HHHHHH...', '..HHSSSSHH..', '..HSSSSSSH..', '...SKSSKS...', '...SSSSSS...',
  '....SMMS....', '.....SS.....', '..CCCCCCCC..', '.CCCCTTCCCC.', '.CCCCTTCCCC.',
];
const ARMS_DOWN = ['.SCCCCCCCCS.', '.S.CCCCCC.S.'];
const ARMS_TYPE_A = ['..CCCCCCCC..', '..SSCCCCSS..'];
const ARMS_TYPE_B = ['..CCCCCCCC..', '...SSCCSS...'];
const LEGS_A = ['...BBBBBB...', '...PPPPPP...', '...PP..PP...', '...PP..PP...', '..OOO..OOO..'];
const LEGS_B = ['...BBBBBB...', '...PPPPPP...', '..PP....PP..', '.PP......PP.', '.OO......OO.'];

function makeSprites(s, id) {
  const [shirt, hair, skin, tie] = LOOK[id];
  const palette = { H: hair, S: skin, K: '#1b1b1b', M: '#a34a4a', C: shirt, T: tie, B: '#2a2a2a', P: '#2d3142', O: '#151515' };
  const frames = {
    idle: [...BODY_TOP, ...ARMS_DOWN, ...LEGS_A], walk: [...BODY_TOP, ...ARMS_DOWN, ...LEGS_B],
    typeA: [...BODY_TOP, ...ARMS_TYPE_A, ...LEGS_A], typeB: [...BODY_TOP, ...ARMS_TYPE_B, ...LEGS_A],
  };
  for (const [name, data] of Object.entries(frames)) {
    s.textures.generate(`${id}_${name}`, { data: data.map((r) => r.padEnd(12, '.').slice(0, 12)), pixelWidth: U, palette });
  }
  s.anims.create({ key: `${id}_walk`, frames: [{ key: `${id}_idle` }, { key: `${id}_walk` }], frameRate: 6, repeat: -1 });
  s.anims.create({ key: `${id}_type`, frames: [{ key: `${id}_typeA` }, { key: `${id}_typeB` }], frameRate: 5, repeat: -1 });
}

/* ---------- Décor ---------- */
function px(g, x, y, w, h, color) { g.fillStyle(Phaser.Display.Color.HexStringToColor(color).color, 1); g.fillRect(x * U, y * U, w * U, h * U); }

function makeDecorTextures(s) {
  let g = s.make.graphics({ add: false });  // bureau (34 × 22 pixels)
  px(g, 3, 0, 9, 7, '#30343f'); px(g, 4, 1, 7, 5, '#3c4250'); px(g, 6, 7, 3, 2, '#30343f');  // dos de l'écran
  px(g, 0, 8, 34, 1, '#5a3a22'); px(g, 0, 9, 34, 5, '#b07a4a'); px(g, 0, 13, 34, 1, '#8a5a34');
  px(g, 13, 10, 9, 2, '#e8e8e8'); px(g, 25, 10, 3, 3, '#f4f1de'); px(g, 29, 10, 2, 2, '#c0392b');
  px(g, 0, 14, 34, 6, '#7a4e2c'); px(g, 2, 15, 30, 4, '#6b4426'); px(g, 15, 16, 4, 1, '#c9a227');
  px(g, 1, 20, 2, 2, '#4a2f1b'); px(g, 31, 20, 2, 2, '#4a2f1b');
  g.generateTexture('desk', 34 * U, 22 * U); g.destroy();

  g = s.make.graphics({ add: false });  // lueur d'écran allumé
  px(g, 3, 0, 9, 7, '#30343f'); px(g, 4, 1, 7, 5, '#7fd1ff'); px(g, 5, 2, 4, 1, '#ffffff'); px(g, 5, 4, 5, 1, '#c9f0ff');
  g.generateTexture('screen_on', 15 * U, 9 * U); g.destroy();

  g = s.make.graphics({ add: false });  // plante
  px(g, 3, 0, 2, 3, '#2f9e44'); px(g, 1, 2, 3, 3, '#37b24d'); px(g, 5, 1, 3, 4, '#2b8a3e'); px(g, 2, 5, 5, 3, '#40c057');
  px(g, 2, 8, 5, 1, '#5c3d2e'); px(g, 2, 9, 5, 4, '#a0522d'); px(g, 3, 13, 3, 1, '#7a3e1d');
  g.generateTexture('plant', 9 * U, 14 * U); g.destroy();

  g = s.make.graphics({ add: false });  // table de réunion (76 × 30)
  px(g, 2, 0, 72, 2, '#5a3a22'); px(g, 0, 2, 76, 20, '#9c6b3f'); px(g, 2, 4, 72, 16, '#b07a4a');
  for (let i = 8; i < 72; i += 12) px(g, i, 9, 6, 4, '#f4f1de');  // documents
  px(g, 36, 8, 4, 4, '#2d3142'); px(g, 0, 22, 76, 4, '#7a4e2c'); px(g, 4, 26, 3, 4, '#4a2f1b'); px(g, 69, 26, 3, 4, '#4a2f1b');
  g.generateTexture('table', 76 * U, 30 * U); g.destroy();

  g = s.make.graphics({ add: false });  // fontaine à eau
  px(g, 1, 0, 6, 6, '#a5d8ff'); px(g, 2, 1, 2, 3, '#d0ebff'); px(g, 0, 6, 8, 12, '#dee2e6'); px(g, 2, 9, 2, 1, '#228be6');
  g.generateTexture('cooler', 8 * U, 18 * U); g.destroy();

  g = s.make.graphics({ add: false });  // bibliothèque
  px(g, 0, 0, 28, 20, '#5a3a22'); px(g, 1, 1, 26, 18, '#3b2716');
  const books = ['#e5484d', '#3e63dd', '#30a46c', '#f5a524', '#8e4ec6', '#12a594'];
  for (let shelf = 0; shelf < 3; shelf++) {
    for (let b = 0; b < 8; b++) px(g, 2 + b * 3, 2 + shelf * 6, 2, 5, books[(b + shelf) % books.length]);
    px(g, 1, 7 + shelf * 6, 26, 1, '#5a3a22');
  }
  g.generateTexture('shelf', 28 * U, 20 * U); g.destroy();
}

function drawRoom(s) {
  const g = s.add.graphics();
  for (let y = 84; y < H; y += 24) {  // parquet
    for (let x = -((y / 24) % 2) * 60; x < W; x += 120) {
      g.fillStyle(((x + y) / 12) % 2 ? 0xa47148 : 0x9a6a42, 1); g.fillRect(x, y, 118, 22);
      g.fillStyle(0x7d5233, 1); g.fillRect(x, y + 22, 120, 2); g.fillRect(x + 118, y, 2, 24);
    }
  }
  g.fillStyle(0x2b3245, 1); g.fillRect(0, 0, W, 84);  // mur
  g.fillStyle(0x1f2433, 1); g.fillRect(0, 78, W, 6);
  for (const wx of [60, 190, 690, 820]) {  // fenêtres
    g.fillStyle(0x15192a, 1); g.fillRect(wx - 3, 12, 86, 54);
    g.fillStyle(0x7fb8e6, 1); g.fillRect(wx, 15, 80, 48);
    g.fillStyle(0xbfe0ff, 1); g.fillRect(wx + 6, 20, 18, 6);
    g.fillStyle(0x15192a, 1); g.fillRect(wx + 39, 15, 2, 48); g.fillRect(wx, 38, 80, 2);
  }
  g.fillStyle(0x8f2b2b, 1); g.fillRect(372, 18, 216, 40);  // enseigne
  g.fillStyle(0xc9a227, 1); g.fillRect(376, 22, 208, 32);
  s.add.text(480, 38, 'AL WASSET 777', { fontFamily: 'monospace', fontSize: 20, color: '#2b1a0a', fontStyle: 'bold' }).setOrigin(0.5);
  g.fillStyle(0x6e2f3f, 1); g.fillRoundedRect(TABLE.x - 200, TABLE.y - 95, 400, 190, 18);  // tapis réunion
  g.fillStyle(0x86394c, 1); g.fillRoundedRect(TABLE.x - 190, TABLE.y - 85, 380, 170, 14);
  g.fillStyle(0x3c5a7a, 1); g.fillRoundedRect(DESKS.ceo.x - 110, DESKS.ceo.y - 70, 220, 115, 10);  // tapis Directeur
  g.setDepth(-10);
  s.add.image(290, 112, 'shelf').setDepth(1);
  s.add.image(668, 120, 'cooler').setDepth(1);
  for (const [x, y] of [[28, 118], [932, 118], [28, 600], [932, 600], [255, 600], [705, 600]]) s.add.image(x, y, 'plant').setOrigin(0.5, 1).setDepth(y);
  s.add.image(TABLE.x, TABLE.y, 'table').setDepth(TABLE.y + 20);
  s.add.text(TABLE.x, TABLE.y + 62, 'Salle de réunion', { fontFamily: 'monospace', fontSize: 12, color: '#f3d9df' }).setOrigin(0.5).setDepth(TABLE.y + 21);
}

/* ---------- Agents ---------- */
function seat(id) {
  const order = Object.keys(DESKS).indexOf(id);
  const a = -Math.PI / 2 + (order / 7) * Math.PI * 2;
  return { x: TABLE.x + Math.cos(a) * 165, y: TABLE.y + 40 + Math.sin(a) * 78 };
}
function deskSpot(id) { return { x: DESKS[id].x, y: DESKS[id].y + 12 }; }

function createAgents(s) {
  for (const [id, d] of Object.entries(DESKS)) {
    makeSprites(s, id);
    s.add.image(d.x, d.y, 'desk').setDepth(d.y + 20);
    const screen = s.add.image(d.x - 24, d.y - 20, 'screen_on').setDepth(d.y + 21).setVisible(false);
    s.add.text(d.x, d.y + 40, LABELS[id], { fontFamily: 'monospace', fontSize: 12, color: '#fff', backgroundColor: '#00000088', padding: { x: 4, y: 1 } })
      .setOrigin(0.5).setDepth(d.y + 22);
    const spot = deskSpot(id);
    const sprite = s.add.sprite(spot.x, spot.y, `${id}_idle`).setOrigin(0.5, 1).setDepth(spot.y);
    const bubble = s.add.text(spot.x, spot.y - 60, '', { fontFamily: 'system-ui, sans-serif', fontSize: 12, color: '#111',
      backgroundColor: '#ffffff', padding: { x: 6, y: 4 }, wordWrap: { width: 190 } }).setOrigin(0.5, 1).setDepth(5000).setVisible(false);
    const alert = s.add.text(spot.x + 16, spot.y - 58, '!', { fontFamily: 'monospace', fontSize: 18, color: '#fff', backgroundColor: '#e5484d',
      padding: { x: 5, y: 0 }, fontStyle: 'bold' }).setOrigin(0.5, 1).setDepth(5001).setVisible(false);
    s.tweens.add({ targets: alert, y: '-=6', yoyo: true, repeat: -1, duration: 400 });
    agents[id] = { sprite, bubble, alert, screen, timer: null, at: 'desk' };
  }
  s.events.on('update', () => {
    for (const a of Object.values(agents)) {
      a.bubble.setPosition(a.sprite.x, a.sprite.y - 58);
      a.alert.setPosition(a.sprite.x + 18, a.sprite.y - 56);
    }
  });
}

function moveTo(id, where) {
  const a = agents[id]; if (!a) return;
  const t = where === 'meeting' ? seat(id) : deskSpot(id);
  a.at = where === 'meeting' ? 'meeting' : 'desk';
  a.screen.setVisible(false);
  const dist = Phaser.Math.Distance.Between(a.sprite.x, a.sprite.y, t.x, t.y);
  if (dist < 2) return;
  a.sprite.play(`${id}_walk`, true);
  scene.tweens.killTweensOf(a.sprite);
  scene.tweens.add({
    targets: a.sprite, x: t.x, y: t.y, duration: Math.max(300, dist / 0.2), ease: 'Linear',
    onUpdate: () => a.sprite.setDepth(a.sprite.y),
    onComplete: () => { a.sprite.stop(); a.sprite.setTexture(`${id}_idle`); a.sprite.setDepth(t.y); },
  });
}

function say(id, text, ms = 6000) {
  const a = agents[id]; if (!a || !text) return;
  a.bubble.setText(text.length > 110 ? text.slice(0, 107) + '…' : text).setVisible(true);
  clearTimeout(a.timer);
  a.timer = setTimeout(() => a.bubble.setVisible(false), ms);
}

function onEvent(e) {
  const a = agents[e.agent];
  if (a) {
    if (e.status === 'walk') moveTo(e.agent, e.target);
    if (e.status === 'working') {
      if (a.at === 'desk') { a.sprite.play(`${e.agent}_type`, true); a.screen.setVisible(true); }
      say(e.agent, '⚙️ ' + (e.text || ''), 8000);
    }
    if (e.status === 'done') { stopWork(e.agent); say(e.agent, '✅ ' + (e.text || '')); }
    if (e.status === 'error') { stopWork(e.agent); say(e.agent, '⚠️ ' + (e.text || ''), 12000); }
    if (e.status === 'waiting') { say(e.agent, '⏳ ' + (e.text || ''), 8000); }
  }
  if (e.approval_id) refreshApprovals();
  if (e.report) refreshReport();
  addLog(e);
}

function stopWork(id) {
  const a = agents[id];
  if (a.sprite.anims.isPlaying && a.sprite.anims.currentAnim.key.endsWith('_type')) { a.sprite.stop(); a.sprite.setTexture(`${id}_idle`); }
  a.screen.setVisible(false);
}

function updateAlerts(pending) {
  const waiting = new Set(pending.map((p) => p.agent));
  for (const [id, a] of Object.entries(agents)) a.alert.setVisible(waiting.has(id));
}

/* ---------- Panneau ---------- */
const $ = (id) => document.getElementById(id);
const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };

function linkify(text) {  // transforme les liens https en liens cliquables (sans HTML injecté)
  const frag = document.createDocumentFragment();
  String(text).split(/(https:\/\/[^\s]+)/g).forEach((part) => {
    if (/^https:\/\/[^\s]+$/.test(part)) {
      const a = el('a', null, part.includes('wa.me') ? '📲 Ouvrir WhatsApp avec le message' : part);
      a.href = part; a.target = '_blank'; a.rel = 'noopener noreferrer'; frag.appendChild(a);
    } else frag.appendChild(document.createTextNode(part));
  });
  return frag;
}

async function api(path, body) {
  const r = await fetch(path, body ? { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Bureau': '1' }, body: JSON.stringify(body) } : {});
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return r.json();
}

function card(a, withButtons) {
  const c = el('div', 'card' + (a.status === 'pending' ? ' pending' : ''));
  const t = el('div', 't', `#${a.id} ${a.title}`);
  if (a.status !== 'pending') t.appendChild(el('span', 'badge ' + a.status, { done: 'fait', failed: 'échec', rejected: 'refusé', approved: 'en cours' }[a.status] || a.status));
  c.append(t, el('div', 'a', `${LABELS[a.agent] || a.agent} · ${new Date(a.created_at * 1000).toLocaleString()}`));
  const pre = el('pre'); pre.appendChild(linkify(a.details)); c.appendChild(pre);
  if (a.result) { const r = el('pre'); r.appendChild(linkify('➡️ ' + a.result)); c.appendChild(r); }
  if (withButtons) {
    const row = el('div', 'row');
    const ok = el('button', 'ok', '✅ Valider'), no = el('button', 'no', '❌ Refuser');
    const decide = async (yes) => {
      ok.disabled = no.disabled = true;
      try { const res = await api(`/api/approbations/${a.id}`, { decision: yes }); $('msg').replaceChildren(linkify(res.message)); }
      catch (err) { $('msg').textContent = 'Erreur : ' + err.message; }
      refreshApprovals();
    };
    ok.onclick = () => decide(true); no.onclick = () => decide(false);
    row.append(ok, no); c.appendChild(row);
  }
  return c;
}

async function refreshApprovals() {
  try {
    const all = await api('/api/approbations');
    const rank = (a) => (a.kind.startsWith('reply_') ? 0 : a.kind.startsWith('ads_') ? 1 : a.kind.startsWith('db_') ? 2 : 3);
    const pending = all.filter((a) => a.status === 'pending').sort((x, y) => rank(x) - rank(y) || x.id - y.id);
    $('pcount').textContent = pending.length;
    $('pending').replaceChildren(...(pending.length ? pending.map((a) => card(a, true)) : [el('div', 'a', 'Rien à valider pour le moment.')]));
    $('history').replaceChildren(...all.filter((a) => a.status !== 'pending').slice(0, 15).map((a) => card(a, false)));
    if (scene) updateAlerts(pending);
  } catch (err) { $('msg').textContent = 'Serveur injoignable : ' + err.message; }
}

async function refreshReport() {
  try { $('report').textContent = (await api('/api/rapport')).text; } catch { /* rien */ }
}

async function refreshStatus() {
  try {
    const s = await api('/api/statut');
    const chips = [['IA : ' + s.ia, s.ia !== 'démo (sans IA)'], ['Telegram', s.telegram], ['Firebase', s.firebase],
      ['Facebook', s.meta_page], ['Instagram', s.meta_instagram], ['Pub Meta', s.meta_pub], ['GitHub', s.github]];
    $('chips').replaceChildren(...chips.map(([t, on]) => el('span', 'chip ' + (on ? 'on' : 'off'), (on ? '● ' : '○ ') + t)));
  } catch { /* rien */ }
}

function addLog(e) {
  if (!e.agent || !LABELS[e.agent] || e.status === 'walk') return;
  const icon = { working: '⚙️', done: '✅', waiting: '⏳', error: '⚠️' }[e.status] || '•';
  const row = el('div', e.status, `${new Date((e.ts || Date.now() / 1000) * 1000).toLocaleTimeString()} · ${LABELS[e.agent]} · ${icon} ${e.text || ''}`);
  $('log').prepend(row);
  while ($('log').children.length > 80) $('log').lastChild.remove();
}

function connect() {
  const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}/ws`);
  ws.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch (err) { console.error(err); } };
  ws.onclose = () => setTimeout(connect, 2000);
}

$('send').onclick = async () => {
  const texte = $('order').value.trim();
  if (texte.length < 2) { $('msg').textContent = "Écrivez d'abord l'ordre."; return; }
  try { $('msg').textContent = (await api('/api/ordre', { texte })).message; $('order').value = ''; }
  catch (err) { $('msg').textContent = 'Erreur : ' + err.message; }
};
$('routine').onclick = async () => {
  try { $('msg').textContent = (await api('/api/routine', { ok: true })).message; }
  catch (err) { $('msg').textContent = 'Erreur : ' + err.message; }
};

new Phaser.Game({
  type: Phaser.AUTO, parent: 'game', width: W, height: H, backgroundColor: '#1a1d26', pixelArt: true,
  scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
  scene: { create() { scene = this; makeDecorTextures(this); drawRoom(this); createAgents(this); connect(); refreshApprovals(); } },
});
refreshStatus(); refreshReport();
setInterval(refreshApprovals, 15000);

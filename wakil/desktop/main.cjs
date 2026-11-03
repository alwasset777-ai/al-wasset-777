// Wakil pour Mac — fenêtre native + « moteur d'exécution » local sécurisé.
// L'interface est la même application web (dossier app/), servie par un protocole interne app://.
const { app, BrowserWindow, ipcMain, dialog, shell, protocol, net, Menu } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { spawn } = require('node:child_process');
const { pathToFileURL } = require('node:url');

const WORKSPACE = path.join(os.homedir(), 'Wakil');
const APP_DIR = path.join(__dirname, 'app');
fs.mkdirSync(WORKSPACE, { recursive: true });

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

/** Chemin sûr à l'intérieur de ~/Wakil (bloque « ../ »). */
function insideWorkspace(rel) {
  const p = path.resolve(WORKSPACE, String(rel || '').replace(/^[/\\]+/, ''));
  if (p !== WORKSPACE && !p.startsWith(WORKSPACE + path.sep)) throw new Error('Chemin hors du dossier ~/Wakil refusé.');
  return p;
}

let win;
function createWindow() {
  win = new BrowserWindow({
    width: 1320,
    height: 860,
    minWidth: 380,
    minHeight: 560,
    title: 'Wakil',
    backgroundColor: '#0d121c',
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: true },
  });
  win.loadURL('app://wakil/index.html');
  // Liens externes → navigateur par défaut.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: url === 'about:blank' ? 'allow' : 'deny' };
  });
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith('app://')) {
      e.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
}

app.whenReady().then(() => {
  protocol.handle('app', (req) => {
    const { pathname } = new URL(req.url);
    let file = path.normalize(path.join(APP_DIR, decodeURIComponent(pathname)));
    if (!file.startsWith(APP_DIR) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(APP_DIR, 'index.html');
    return net.fetch(pathToFileURL(file).toString());
  });
  // Micro (dictée) uniquement ; tout le reste refusé.
  require('electron').session.defaultSession.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'media' || permission === 'clipboard-sanitized-write'));
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      { role: 'appMenu' },
      { role: 'editMenu' },
      { label: 'Affichage', submenu: [{ role: 'reload' }, { role: 'toggleDevTools' }, { type: 'separator' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }] },
      { label: 'Wakil', submenu: [{ label: 'Ouvrir le dossier ~/Wakil', click: () => shell.openPath(WORKSPACE) }] },
      { role: 'windowMenu' },
    ]),
  );
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});
app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit());

// ---------------------------------------------------------------- pont sécurisé
ipcMain.handle('wakil:workspace', () => WORKSPACE);
ipcMain.handle('wakil:open-workspace', () => shell.openPath(WORKSPACE));

ipcMain.handle('wakil:write-file', (_e, rel, content, binary) => {
  const p = insideWorkspace(rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  if (binary && String(content).startsWith('data:')) fs.writeFileSync(p, Buffer.from(String(content).split(',')[1] || '', 'base64'));
  else fs.writeFileSync(p, String(content), 'utf8');
  return p;
});

const sessionAllowed = new Set();
ipcMain.handle('wakil:run', async (_e, command, cwdRel) => {
  command = String(command || '').slice(0, 4000);
  const cwd = insideWorkspace(cwdRel || '');
  fs.mkdirSync(cwd, { recursive: true });
  // Double sécurité : confirmation native du Mac, en plus de celle de l'interface.
  if (!sessionAllowed.has(command)) {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      buttons: ['Refuser', 'Exécuter une fois', 'Toujours pour cette commande (session)'],
      defaultId: 0,
      cancelId: 0,
      message: 'Wakil veut exécuter une commande sur votre Mac',
      detail: `Dossier : ${cwd}\n\n${command}`,
    });
    if (response === 0) return { code: -1, stdout: '', stderr: 'Refusé par l’utilisateur.' };
    if (response === 2) sessionAllowed.add(command);
  }
  return new Promise((resolve) => {
    const child = spawn('/bin/zsh', ['-lc', command], { cwd, env: { ...process.env, WAKIL_WORKSPACE: WORKSPACE } });
    let stdout = '';
    let stderr = '';
    const cap = (s, d) => (s.length > 200000 ? s : s + d);
    child.stdout.on('data', (d) => (stdout = cap(stdout, d.toString())));
    child.stderr.on('data', (d) => (stderr = cap(stderr, d.toString())));
    const timer = setTimeout(() => child.kill('SIGTERM'), 180000);
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code: code ?? -1, stdout: stdout.slice(-60000), stderr: stderr.slice(-20000) });
    });
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: String(err) }));
  });
});

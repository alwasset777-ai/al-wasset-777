// Pont minimal et contrôlé entre l'interface et le Mac (aucun accès Node direct).
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('wakilDesktop', {
  platform: process.platform,
  workspaceDir: () => ipcRenderer.invoke('wakil:workspace'),
  openWorkspace: () => ipcRenderer.invoke('wakil:open-workspace'),
  writeFile: (path, content, binary) => ipcRenderer.invoke('wakil:write-file', path, content, !!binary),
  runCommand: (command, cwd) => ipcRenderer.invoke('wakil:run', command, cwd),
});

const { contextBridge, ipcRenderer } = require('electron')

try {
  contextBridge.exposeInMainWorld('electron', {
    ipc: {
      invoke: (ch, data) => {
        console.log('[preload] Invoking:', ch)
        return ipcRenderer.invoke(ch, data)
      },
    },
  })
  console.log('[preload] Exposed electron object')
} catch (error) {
  console.error('[preload] Error:', error)
}

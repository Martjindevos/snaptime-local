import { contextBridge, ipcRenderer } from 'electron'

try {
  contextBridge.exposeInMainWorld('electron', {
    ipcRenderer: {
      invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
      on: (channel: string, listener: any) => ipcRenderer.on(channel, listener),
    },
  })
  console.log('[Preload] Context bridge exposed successfully')
} catch (error) {
  console.error('[Preload] Failed to expose context bridge:', error)
}

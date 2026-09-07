import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'

console.log('[main.tsx] Rendering app')

const rootEl = document.getElementById('root')
if (!rootEl) {
  console.error('[main.tsx] Root element not found!')
  document.body.innerHTML = '<h1>Error: Root element not found</h1>'
} else {
  ReactDOM.createRoot(rootEl).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
  console.log('[main.tsx] App rendered')
}

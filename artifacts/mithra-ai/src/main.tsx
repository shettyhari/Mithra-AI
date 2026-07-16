import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Catch module-level or runtime errors and display them in the DOM
// so a production screenshot reveals the actual crash.
window.onerror = (_msg, _src, _line, _col, error) => {
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = `<div style="color:#f87171;padding:24px;font-family:monospace;white-space:pre-wrap;background:#0f0f0f;min-height:100vh">
<b>JS Error (production debug)</b>\n${error?.stack || _msg}</div>`;
  }
};

window.addEventListener('unhandledrejection', (e) => {
  const root = document.getElementById('root');
  if (root && !root.hasChildNodes()) {
    root.innerHTML = `<div style="color:#f87171;padding:24px;font-family:monospace;white-space:pre-wrap;background:#0f0f0f;min-height:100vh">
<b>Unhandled rejection (production debug)</b>\n${e.reason?.stack || e.reason}</div>`;
  }
});

createRoot(document.getElementById('root')!).render(<App />);

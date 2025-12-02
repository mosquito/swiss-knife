import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';
import './components.css';

// Disable network primitives before anything else runs
(function blockNetwork() {
  // Disable fetch
  if (typeof window.fetch === 'function') {
    const blocked = () => Promise.reject(new Error('Network disabled'));
    try { Object.defineProperty(window, 'fetch', { value: blocked, configurable: false }); }
    catch { window.fetch = blocked; }
  }

  // Disable XMLHttpRequest
  if (typeof window.XMLHttpRequest === 'function') {
    const BlockedXHR = function() { this.readyState = 0; this.status = 0; };
    BlockedXHR.prototype.open = BlockedXHR.prototype.send = () => { throw new Error('Network disabled'); };
    BlockedXHR.prototype.setRequestHeader = BlockedXHR.prototype.abort = () => {};
    try { Object.defineProperty(window, 'XMLHttpRequest', { value: BlockedXHR, configurable: false }); }
    catch { window.XMLHttpRequest = BlockedXHR; }
  }

  // Disable form submissions
  document.addEventListener('submit', (e) => e.preventDefault(), true);
})();

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);

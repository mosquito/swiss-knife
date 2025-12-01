import React, { useState, useEffect, useRef } from 'react';
import bwipjs from 'bwip-js';
import HistoryList from './HistoryList';

const HISTORY_KEY = 'wifi_qr_history_v1';

const WifiQRTool = () => {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [security, setSecurity] = useState('WPA');
  const [hidden, setHidden] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [imgUrl, setImgUrl] = useState('');
  const [error, setError] = useState('');
  const [inverted, setInverted] = useState(false);
  const [outputFormat, setOutputFormat] = useState('svg');
  const [pngScale, setPngScale] = useState(1);
  const [printPassword, setPrintPassword] = useState(false);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const debounceRef = useRef(null);
  const [paramDecoded, setParamDecoded] = useState(false);

  // Load outputFormat preference from localStorage
  useEffect(() => {
    try {
      const savedFormat = localStorage.getItem('wifi_qr_output_format');
      if (savedFormat === 'png' || savedFormat === 'svg') {
        setOutputFormat(savedFormat);
      }
      const savedScale = localStorage.getItem('wifi_qr_png_scale');
      if (savedScale) {
        const scale = Number(savedScale);
        if (scale >= 1 && scale <= 5) {
          setPngScale(scale);
        }
      }
    } catch {}
  }, []);

  // Load from URL params or history
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const apParam = params.get('ap');
    const passphraseParam = params.get('passphrase');
    const secParam = params.get('sec');
    const hiddenParam = params.get('hidden');

    if (apParam) {
      setSsid(apParam);
      setPassword(passphraseParam || '');
      // Map sec number to security type: 1=WEP, 2=WPA, 3=nopass
      if (secParam === '1') setSecurity('WEP');
      else if (secParam === '3') setSecurity('nopass');
      else setSecurity('WPA');
      setHidden(hiddenParam === 'true' || hiddenParam === '1');
      setParamDecoded(true);
      return;
    }

    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          setSsid(items[0].value.ssid || '');
          setPassword(items[0].value.password || '');
          setSecurity(items[0].value.security || 'WPA');
          setHidden(items[0].value.hidden || false);
          return;
        }
      }
    } catch {}
    // Example default
    setSsid('MyWiFiNetwork');
    setPassword('SuperSecret123!');
    setSecurity('WPA');
    setHidden(false);
  }, []);

  // Generate WiFi QR code string according to the standard format
  // WIFI:T:<auth>;S:<ssid>;P:<password>;H:<hidden>;;
  const generateWifiString = () => {
    // Escape special characters in SSID and password
    const escapeString = (str) => {
      return str.replace(/([\\";,:])/g, '\\$1');
    };

    const parts = [
      `T:${security}`,
      `S:${escapeString(ssid)}`,
      `P:${escapeString(password)}`,
      hidden ? 'H:true' : ''
    ].filter(Boolean);

    return `WIFI:${parts.join(';')};;`;
  };

  const renderQRCode = () => {
    if (!ssid.trim()) {
      setError('SSID is required');
      setImgUrl('');
      return;
    }

    const wifiString = generateWifiString();

    try {
      if (outputFormat === 'svg') {
        const svg = bwipjs.toSVG({
          bcid: 'qrcode',
          text: wifiString,
          scale: 3,
          height: 10,
          width: 10,
          includetext: false,
        });
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        setImgUrl(url);
        if (svgRef.current) svgRef.current = svg;
      } else {
        const canvas = canvasRef.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        bwipjs.toCanvas(canvas, {
          bcid: 'qrcode',
          text: wifiString,
          scale: 3,
          height: 10,
          width: 10,
          includetext: false,
        });

        // If scale > 1, create a scaled version with sharp edges
        if (pngScale > 1) {
          const scaledCanvas = document.createElement('canvas');
          scaledCanvas.width = canvas.width * pngScale;
          scaledCanvas.height = canvas.height * pngScale;
          const scaledCtx = scaledCanvas.getContext('2d');
          
          // Disable image smoothing for sharp pixel scaling
          scaledCtx.imageSmoothingEnabled = false;
          scaledCtx.webkitImageSmoothingEnabled = false;
          scaledCtx.mozImageSmoothingEnabled = false;
          scaledCtx.msImageSmoothingEnabled = false;
          
          scaledCtx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height);
          const url = scaledCanvas.toDataURL('image/png');
          setImgUrl(url);
        } else {
          const url = canvas.toDataURL('image/png');
          setImgUrl(url);
        }
      }
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to render QR code');
      setImgUrl('');
    }
  };

  // Save outputFormat preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wifi_qr_output_format', outputFormat);
    } catch {}
  }, [outputFormat]);

  // Save pngScale preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('wifi_qr_png_scale', String(pngScale));
    } catch {}
  }, [pngScale]);

  // Update URL params when values change
  useEffect(() => {
    if (!paramDecoded && !ssid) return;
    const params = new URLSearchParams();
    if (ssid) params.set('ap', ssid);
    if (password) params.set('passphrase', password);
    // Map security to number: WEP=1, WPA=2, nopass=3
    const secNum = security === 'WEP' ? '1' : security === 'nopass' ? '3' : '2';
    params.set('sec', secNum);
    if (hidden) params.set('hidden', 'true');
    
    const newSearch = params.toString();
    const currentSearch = window.location.search.substring(1);
    if (newSearch !== currentSearch) {
      window.history.replaceState(null, '', `?${newSearch}${window.location.hash}`);
    }
  }, [ssid, password, security, hidden, paramDecoded]);

  // Debounce rendering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { renderQRCode(); }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [ssid, password, security, hidden, outputFormat, pngScale]);

  const handleDownload = () => {
    if (!imgUrl) return;
    const a = document.createElement('a');
    a.href = imgUrl;
    const ext = outputFormat === 'svg' ? 'svg' : 'png';
    a.download = `wifi-${ssid}.${ext}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  const handleCopyImage = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !navigator.clipboard || typeof ClipboardItem === 'undefined') return;
    try {
      await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
        .then(async (blob) => {
          if (blob) {
            await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': blob })]);
          }
        });
    } catch (e) {
      // ignore
    }
  };

  const handleShare = async () => {
    const shareUrl = window.location.href;
    if (navigator.share) {
      try { await navigator.share({ title: 'WiFi QR Code', url: shareUrl }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(shareUrl); } catch {}
  };

  const handleCopyWifiString = async () => {
    const wifiString = generateWifiString();
    try {
      await navigator.clipboard.writeText(wifiString);
    } catch {}
  };

  const handlePrint = () => {
    window.print();
  };

  const restoreEntry = (ent) => {
    setSsid(ent.ssid || '');
    setPassword(ent.password || '');
    setSecurity(ent.security || 'WPA');
    setHidden(ent.hidden || false);
  };

  return (
    <>
      <style>{`
        .print-content {
          display: none;
        }
        @media print {
          @page {
            margin: 0;
          }
          body, html {
            margin: 0;
            padding: 0;
            height: 100%;
          }
          #root, #root > div, .flex-1 {
            overflow: visible !important;
            height: 100% !important;
          }
          * {
            visibility: hidden;
          }
          .print-content {
            display: flex !important;
            visibility: visible !important;
            position: fixed;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
          }
          .print-content * {
            visibility: visible !important;
          }
          .print-wrapper {
            text-align: center;
            max-width: 600px;
            margin: 0 auto;
          }
          .print-qr {
            width: 400px !important;
            height: 400px !important;
            margin: 0 auto 30px !important;
            display: block !important;
          }
          .print-network-name {
            font-size: 32px !important;
            font-weight: bold !important;
            color: #000 !important;
            margin-bottom: 10px !important;
            display: block !important;
          }
          .print-security {
            font-size: 18px !important;
            color: #666 !important;
            margin-bottom: 20px !important;
            display: block !important;
          }
          .print-password {
            font-size: 24px !important;
            color: #000 !important;
            font-family: monospace !important;
            margin-bottom: 30px !important;
            display: block !important;
          }
          .print-instructions {
            font-size: 14px !important;
            color: #444 !important;
            line-height: 1.6 !important;
            text-align: left !important;
            max-width: 500px !important;
            margin: 0 auto !important;
            display: block !important;
          }
        }
      `}</style>
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
        <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar max-w-4xl mx-auto">
        <div>
          <h2 className="text-xl font-bold">WiFi QR Code Generator</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
            Generate QR codes that automatically connect to WiFi networks when scanned
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-4 items-start">
          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">
                Network Name (SSID) <span className="text-red-500">*</span>
              </label>
              <input
                value={ssid}
                onChange={(e) => setSsid(e.target.value)}
                placeholder="MyWiFiNetwork"
                className="mt-1 w-full text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtBlue"
                spellCheck="false"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">
                Password
              </label>
              <div className="relative mt-1">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Leave empty for open networks"
                  className="w-full text-sm px-3 py-2 pr-10 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtBlue"
                  spellCheck="false"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  type="button"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">
                Security Type
              </label>
              <select
                value={security}
                onChange={(e) => setSecurity(e.target.value)}
                className="mt-1 w-full text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtBlue"
              >
                <option value="WPA">WPA/WPA2/WPA3</option>
                <option value="WEP">WEP (Legacy)</option>
                <option value="nopass">None (Open Network)</option>
              </select>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={hidden}
                  onChange={(e) => setHidden(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-gray-700 dark:text-gray-300">Hidden Network</span>
              </label>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={printPassword}
                  onChange={(e) => setPrintPassword(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-gray-700 dark:text-gray-300">Print Password on Sheet</span>
              </label>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">
                Output Format
              </label>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => setOutputFormat('png')}
                  className={`flex-1 px-3 py-2 text-sm rounded border transition ${
                    outputFormat === 'png'
                      ? 'bg-jwtBlue text-white border-jwtBlue'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  PNG
                </button>
                <button
                  onClick={() => setOutputFormat('svg')}
                  className={`flex-1 px-3 py-2 text-sm rounded border transition ${
                    outputFormat === 'svg'
                      ? 'bg-jwtBlue text-white border-jwtBlue'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  SVG
                </button>
              </div>
            </div>

            {outputFormat === 'png' && (
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400">
                  PNG Scale: {pngScale}x
                </label>
                <input
                  type="range"
                  min="1"
                  max="5"
                  step="1"
                  value={pngScale}
                  onChange={(e) => setPngScale(Number(e.target.value))}
                  className="mt-1 w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  <span>1x</span>
                  <span>2x</span>
                  <span>3x</span>
                  <span>4x</span>
                  <span>5x</span>
                </div>
              </div>
            )}

            <div className="pt-2 border-t border-gray-300 dark:border-gray-700">
              <div className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">
                WiFi String
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-[10px] font-mono px-2 py-2 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded break-all">
                  {generateWifiString()}
                </code>
                <button
                  onClick={handleCopyWifiString}
                  className="px-2 py-1 text-xs rounded bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:opacity-90 whitespace-nowrap"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap text-xs pt-2">
              <button
                onClick={handleDownload}
                disabled={!imgUrl}
                className="px-3 py-1 rounded bg-jwtBlue text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download
              </button>
              <button
                onClick={handleCopyImage}
                disabled={!imgUrl}
                className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Copy
              </button>
              <button
                onClick={handlePrint}
                disabled={!imgUrl}
                className="px-3 py-1 rounded bg-green-600 text-white font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Print
              </button>
              <button
                onClick={handleShare}
                className="px-3 py-1 rounded bg-jwtPurple text-white font-semibold hover:opacity-90"
              >
                Share
              </button>
              <button
                onClick={() => setInverted(v => !v)}
                className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:opacity-90"
              >
                {inverted ? 'Normal Colors' : 'Invert Colors'}
              </button>
            </div>

            {error && (
              <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 border border-red-300 dark:border-red-700 rounded px-3 py-2">
                {error}
              </div>
            )}
          </div>

          {/* Preview */}
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-4">
            <div className="text-xs font-bold mb-2 text-gray-500 dark:text-gray-400">
              QR Code Preview ({outputFormat.toUpperCase()})
            </div>
            <div className={`flex items-center justify-center min-h-[280px] p-4 border-2 border-gray-400 dark:border-gray-500 rounded ${inverted ? 'bg-black' : 'bg-white'}`}>
              {imgUrl ? (
                <img
                  src={imgUrl}
                  alt="WiFi QR Code"
                  className={`max-w-full max-h-[400px] object-contain ${inverted ? 'invert' : ''} print-qr`}
                />
              ) : (
                <div className="text-xs text-gray-400 text-center">
                  {error ? 'Unable to generate QR code' : 'Enter SSID to generate QR code'}
                </div>
              )}
            </div>
            <canvas ref={canvasRef} className="hidden" width={600} height={600} />
          </div>
        </div>

        {/* Print-only content */}
        <div className="print-content">
          <div className="print-wrapper">
            {imgUrl && (
              <>
                <img src={imgUrl} alt="WiFi QR Code" className="print-qr" />
                <div className="print-network-name">{ssid}</div>
                {printPassword && password && (
                  <>
                    <div className="print-security">{security === 'WPA' ? 'WPA/WPA2/WPA3' : security === 'WEP' ? 'WEP' : 'Open Network'}</div>
                    <div className="print-password">Password: {password}</div>
                  </>
                )}
                {printPassword && !password && <div className="print-security">Open Network (No Password)</div>}
                {!printPassword && password && <div className="print-security">{security === 'WPA' ? 'WPA/WPA2/WPA3' : security === 'WEP' ? 'WEP' : 'Open Network'}</div>}
                <div className="print-instructions">
                  <strong>How to connect:</strong><br/>
                  1. Open your phone's camera app<br/>
                  2. Point it at the QR code above<br/>
                  3. Tap the notification that appears<br/>
                  4. Your device will connect automatically
                </div>
              </>
            )}
          </div>
        </div>

        {/* Info Section */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
            How to Use
          </h3>
          <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
            <li>• Scan the QR code with your phone's camera to automatically connect to the WiFi network</li>
            <li>• Works on iOS (11+), Android (10+), and most modern smartphones</li>
            <li>• For open networks, leave the password field empty and select "None"</li>
            <li>• WPA/WPA2/WPA3 is the most common security type for modern routers</li>
            <li>• Check "Hidden Network" if your SSID is not broadcasting</li>
            <li>• <strong>Print:</strong> Use your browser's print function (Ctrl/Cmd+P) to create a connection sheet with the QR code and network details</li>
          </ul>
        </div>

        {/* History */}
        <HistoryList
          storageKey={HISTORY_KEY}
          newItem={ssid.trim() ? { ssid, password, security, hidden } : null}
          dedupeKey={(v) => `${v.ssid}|${v.security}|${v.hidden}`}
          onRestore={(v) => restoreEntry(v)}
        >
          {({ items, clear, deleteAt, restore }) => (
            <div className="mt-6 w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-600 dark:text-gray-400">Generation History</div>
                <button
                  onClick={clear}
                  className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:opacity-90"
                >
                  Clear
                </button>
              </div>
              {items.length === 0 ? (
                <div className="text-[11px] text-gray-500">No history yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((it, idx) => (
                    <div
                      key={it.ts + '-' + idx}
                      className="group flex items-center max-w-[280px] text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded py-[4px]"
                    >
                      <button
                        aria-label="Restore"
                        onClick={() => {
                          restore(it.value, idx);
                          restoreEntry(it.value);
                        }}
                        className="text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        ♻️
                      </button>
                      <button
                        onClick={() => {
                          restore(it.value, idx);
                          restoreEntry(it.value);
                        }}
                        className="flex-1 text-left font-mono truncate mx-1 hover:opacity-80 transition"
                        title={`${it.value.ssid} (${it.value.security})`}
                      >
                        <span className="font-bold">{it.value.ssid}</span>
                        <span className="text-gray-500 dark:text-gray-400"> ({it.value.security})</span>
                      </button>
                      <button
                        aria-label="Delete"
                        onClick={() => deleteAt(idx)}
                        className="text-xs px-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-200 dark:hover:bg-red-800/60 transition"
                      >
                        ❌
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </HistoryList>
      </div>
    </div>
    </>
  );
};

export default WifiQRTool;

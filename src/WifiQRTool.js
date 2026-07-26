import React, { useState, useEffect } from 'react';
import HistoryList from './HistoryList';
import { copyText } from './browserActions';
import { readLatestHistoryValue } from './historyStorage';
import { useBwipOutput } from './useBwipOutput';
import ImageOutputControls from './ImageOutputControls';

const HISTORY_KEY = 'wifi_qr_history_v1';

const WifiQRTool = () => {
  const [ssid, setSsid] = useState('');
  const [password, setPassword] = useState('');
  const [security, setSecurity] = useState('WPA');
  const [hidden, setHidden] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [inverted, setInverted] = useState(false);
  const [printPassword, setPrintPassword] = useState(false);

  // Load from history or use defaults
  useEffect(() => {
    const latest = readLatestHistoryValue(HISTORY_KEY);
    if (latest) {
      setSsid(latest.ssid || '');
      setPassword(latest.password || '');
      setSecurity(latest.security || 'WPA');
      setHidden(latest.hidden || false);
      return;
    }
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

  const {
    canvasRef,
    copyImage: handleCopyImage,
    download: handleDownload,
    error,
    imgUrl,
    outputFormat,
    pngScale,
    setOutputFormat,
    setPngScale,
    share: handleShare,
  } = useBwipOutput({
    storagePrefix: 'wifi_qr',
    createOptions: () => {
      if (!ssid.trim()) throw new Error('SSID is required');
      return {
        bcid: 'qrcode',
        text: generateWifiString(),
        scale: 3,
        height: 10,
        width: 10,
        includetext: false,
      };
    },
    dependencies: [ssid, password, security, hidden],
    fileBaseName: () => `wifi-${ssid}`,
    shareTitle: 'WiFi QR Code',
    renderErrorMessage: 'Failed to render QR code',
  });

  const handleCopyWifiString = async () => {
    await copyText(generateWifiString());
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
      <div className="tool-container">
        <div className="tool-content">
        <div>
          <h2 className="tool-title">WiFi QR Code Generator</h2>
          <p className="tool-subtitle mt-1">
            Generate QR codes that automatically connect to WiFi networks when scanned
          </p>
        </div>

        <div className="grid-2col items-start">
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
                className="mt-1 w-full text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-hidden focus:ring-2 focus:ring-jwtBlue"
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
                  className="w-full text-sm px-3 py-2 pr-10 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-hidden focus:ring-2 focus:ring-jwtBlue"
                  spellCheck="false"
                />
                <button
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                  type="button"
                >
                  <span className={`icon ${showPassword ? 'icon-closed-eye' : 'icon-closed-eye'}`}></span>
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
                className="mt-1 w-full text-sm px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-hidden focus:ring-2 focus:ring-jwtBlue"
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

            <ImageOutputControls
              outputFormat={outputFormat}
              pngScale={pngScale}
              setOutputFormat={setOutputFormat}
              setPngScale={setPngScale}
            />

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
                className="btn-primary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Download
              </button>
              <button
                onClick={handleCopyImage}
                disabled={!imgUrl}
                className="btn-secondary btn-sm disabled:opacity-50 disabled:cursor-not-allowed"
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
                className="btn-primary btn-sm"
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
          <div className="card flex flex-col">
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
        <div className="alert-info">
          <h3 className="alert-info-title">
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
                        <span className="icon icon-ok"></span>
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
                        <span className="icon icon-cancel"></span>
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

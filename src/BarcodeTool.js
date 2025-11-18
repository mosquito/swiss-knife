import React, { useEffect, useMemo, useRef, useState } from 'react';
import Base64QuerySync from './Base64QuerySync';
import bwipjs from 'bwip-js';
import HistoryList from './HistoryList';

// Supported symbologies (value, label)
const SYMS = [
  { value: 'coop2of5', label: 'COOP 2 of 5' },
  { value: 'ean13', label: 'EAN-13' },
  { value: 'ean8', label: 'EAN-8' },
  { value: 'upca', label: 'UPC-A' },
  { value: 'upce', label: 'UPC-E' },
  { value: 'code128', label: 'Code 128' },
  { value: 'code39', label: 'Code 39' },
  { value: 'code93', label: 'Code 93' },
  { value: 'interleaved2of5', label: 'Interleaved 2 of 5 (ITF)' },
  { value: 'qrcode', label: 'QR Code' },
  { value: 'datamatrix', label: 'Data Matrix' },
  { value: 'azteccode', label: 'Aztec Code' },
  { value: 'pdf417', label: 'PDF417' },
  { value: 'micropdf417', label: 'MicroPDF417' },
  { value: 'maxicode', label: 'MaxiCode' },
  { value: 'code39ext', label: 'Code 39 Extended' },
  { value: 'code93ext', label: 'Code 93 Extended' },
  { value: 'code11', label: 'Code 11' },
  { value: 'code16k', label: 'Code 16K' },
  { value: 'code2of5', label: 'Code 25' },
  { value: 'code32', label: 'Italian Pharmacode' },
  { value: 'codablockf', label: 'Codablock F' },
  { value: 'codeone', label: 'Code One' },
  { value: 'gs1-128', label: 'GS1-128' },
  { value: 'databarexpanded', label: 'GS1 DataBar Expanded' },
  { value: 'databarlimited', label: 'GS1 DataBar Limited' },
  { value: 'databaromni', label: 'GS1 DataBar Omnidirectional' },
  { value: 'databarstacked', label: 'GS1 DataBar Stacked' },
  { value: 'databartruncated', label: 'GS1 DataBar Truncated' },
  { value: 'gs1datamatrix', label: 'GS1 Data Matrix' },
  { value: 'gs1qrcode', label: 'GS1 QR Code' },
  { value: 'microqrcode', label: 'Micro QR Code' },
  { value: 'hanxin', label: 'Han Xin Code' },
  { value: 'dotcode', label: 'DotCode' },
  { value: 'ultracode', label: 'Ultracode' },
  { value: 'isbn', label: 'ISBN' },
  { value: 'issn', label: 'ISSN' },
  { value: 'ismn', label: 'ISMN' },
  { value: 'pharmacode', label: 'Pharmaceutical Binary Code' },
  { value: 'pzn', label: 'Pharmazentralnummer (PZN)' },
  { value: 'ean14', label: 'EAN-14' },
  { value: 'sscc18', label: 'SSCC-18' },
  { value: 'itf14', label: 'ITF-14' },
  { value: 'postnet', label: 'USPS POSTNET' },
  { value: 'planet', label: 'USPS PLANET' },
  { value: 'onecode', label: 'USPS Intelligent Mail' },
  { value: 'royalmail', label: 'Royal Mail 4 State Customer Code' },
  { value: 'kix', label: 'Royal Dutch TPG Post KIX' },
  { value: 'japanpost', label: 'Japan Post 4 State Customer Code' },
  { value: 'auspost', label: 'AusPost 4 State Customer Code' },
  { value: 'canadapost', label: 'Canada Post' },
  { value: 'telepen', label: 'Telepen' },
  { value: 'telepennumeric', label: 'Telepen Numeric' },
  { value: 'msi', label: 'MSI Modified Plessey' },
  { value: 'plessey', label: 'Plessey UK' },
  { value: 'rationalizedCodabar', label: 'Codabar' },
  { value: 'channelcode', label: 'Channel Code' },
  { value: 'bc412', label: 'BC412' },
  { value: 'matrix2of5', label: 'Matrix 2 of 5' },
  { value: 'industrial2of5', label: 'Industrial 2 of 5' },
  { value: 'iata2of5', label: 'IATA 2 of 5' },
  { value: 'datalogic2of5', label: 'Datalogic 2 of 5' },
];

const HISTORY_KEY = 'barcode_history_v1';

const BarcodeTool = () => {
  const [text, setText] = useState('');
  const [type, setType] = useState('ean13');
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [inverted, setInverted] = useState(false);
  const canvasRef = useRef(null);
  const debounceRef = useRef(null);
  const [paramDecoded, setParamDecoded] = useState(false);

  // Fallback priority (runs once after potential param decode): history > example
  useEffect(() => {
    if (paramDecoded) return; // already satisfied by URL param
    // Try history
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          setType(items[0].value.type);
          setText(items[0].value.text);
          return; // Base64QuerySync will sync URL on state change
        }
      }
    } catch {}
    // Example default
    setType('ean13');
    setText('123456789012');
  }, [paramDecoded]);

  // Filtered list
  const filteredSyms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return SYMS;
    return SYMS.filter(s => s.value.toLowerCase().includes(q) || s.label.toLowerCase().includes(q));
  }, [filter]);

  // URL syncing handled via Base64QuerySync component below.

  // Render barcode to canvas and capture PNG data URL
  const renderBarcode = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      // Always ensure a solid white background
      const ctx = canvas.getContext('2d');
      ctx.save();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      bwipjs.toCanvas(canvas, {
        bcid: type,
        text: text,
        scale: 3,
        height: 12,
        includetext: true,
        textxalign: 'center',
      });

      const url = canvas.toDataURL('image/png');
      setImgUrl(url);
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to render');
    }
  };

  // Debounce rendering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { renderBarcode(); }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [text, type]);

  const handleDownload = () => {
    if (!imgUrl) return;
    const a = document.createElement('a');
    a.href = imgUrl;
    a.download = `${type}-${text}.png`;
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
      try { await navigator.share({ title: 'Barcode', url: shareUrl }); return; } catch {}
    }
    try { await navigator.clipboard.writeText(shareUrl); } catch {}
  };

  const restoreEntry = (ent) => {
    setText(ent.text); setType(ent.type);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar max-w-4xl mx-auto">
        {/* Sync combined barcode state (type+text) to base64 URL param 'value' */}
        <Base64QuerySync
          value={{ type, value: text }}
          encode={(obj) => JSON.stringify(obj)}
          decode={(s) => {
            try {
              const parsed = JSON.parse(s);
              if (parsed && typeof parsed === 'object' && typeof parsed.value === 'string' && typeof parsed.type === 'string') {
                if (SYMS.some(sym => sym.value === parsed.type)) {
                  setType(parsed.type);
                  setText(parsed.value);
                  setParamDecoded(true);
                  return parsed; // success
                }
              }
            } catch {}
            return undefined; // incompatible
          }}
          onDecoded={() => { /* state already set in decode */ }}
          queryParam="barcode"
          updateOnMount={false}
        />
        <h2 className="text-xl font-bold">Barcode Generator</h2>
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Barcode Content</label>
              <input
                value={text}
                onChange={(e)=>setText(e.target.value)}
                placeholder="Enter content (digits/text depending on type)"
                className="mt-1 w-full text-xs font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtBlue"
                spellCheck="false"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Barcode Type</label>
              <div className="mt-1 flex flex-col gap-2">
                <input
                  value={filter}
                  onChange={(e)=>setFilter(e.target.value)}
                  placeholder="Filter types (like Select2)"
                  className="w-full text-xs px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtPurple"
                />
                <select
                  value={type}
                  onChange={(e)=>setType(e.target.value)}
                  size={8}
                  className="w-full text-xs px-2 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800"
                >
                  {filteredSyms.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap text-xs">
              <button onClick={handleDownload} className="px-3 py-1 rounded bg-jwtBlue text-white font-semibold hover:opacity-90">Download PNG</button>
              <button onClick={handleCopyImage} className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:opacity-90">Copy Image</button>
              <button onClick={handleShare} className="px-3 py-1 rounded bg-jwtPurple text-white font-semibold hover:opacity-90">Share Link</button>
              <button onClick={()=>setInverted(v=>!v)} className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:opacity-90">{inverted ? 'Normal Colors' : 'Invert Colors'}</button>
            </div>
            {error && <div className="text-[10px] text-red-600 font-mono">{error}</div>}
          </div>

          {/* Preview */}
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-4">
            <div className="text-xs font-bold mb-2 text-gray-500 dark:text-gray-400">Barcode PNG</div>
            <div className={`flex items-center justify-center min-h-[220px] p-4 border-2 border-gray-400 dark:border-gray-500 rounded ${inverted ? 'bg-black' : 'bg-white'}`}>
              {imgUrl ? (
                <img src={imgUrl} alt="barcode" className={`max-w-full max-h-[360px] object-contain ${inverted ? 'invert' : ''}`} />
              ) : (
                <div className="text-[10px] text-gray-400">No image yet</div>
              )}
            </div>
            {/* Hidden canvas used for generation */}
            <canvas ref={canvasRef} className="hidden" width={600} height={280} />
          </div>
        </div>

        {/* History (headless render via HistoryList) */}
        <HistoryList
          storageKey="barcode_history_v1"
          newItem={{ text, type }}
          dedupeKey={(v)=>`${v.type}|${v.text}`}
          onRestore={(v)=>restoreEntry(v)}
        >
          {({ items, clear, deleteAt, restore }) => (
            <div className="mt-6 w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-600 dark:text-gray-400">Generation History</div>
                <button onClick={clear} className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:opacity-90">Clear</button>
              </div>
              {items.length === 0 ? (
                <div className="text-[11px] text-gray-500">No history yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((it, idx) => (
                    <div
                      key={it.ts + '-' + idx}
                      className="group flex items-center max-w-[260px] text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded py-[4px]"
                    >
                      <button
                        aria-label="Restore"
                        onClick={() => { restore(it.value, idx); setText(it.value.text); setType(it.value.type); }}
                        className="text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        ♻️
                      </button>
                      <button
                        onClick={() => { restore(it.value, idx); setText(it.value.text); setType(it.value.type); }}
                        className="flex-1 text-left font-mono truncate mx-1 hover:opacity-80 transition"
                        title={`${it.value.type}: ${it.value.text}`}
                      >
                        <span className="font-bold">{it.value.type}</span>: {it.value.text}
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
  );
};

export default BarcodeTool;

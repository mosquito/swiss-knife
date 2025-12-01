import React, { useEffect, useMemo, useRef, useState } from 'react';
import Base64QuerySync from './Base64QuerySync';
import bwipjs from 'bwip-js';
import HistoryList from './HistoryList';

// Supported symbologies (value, label, height, width, category, validate, examples)
// height: relative height for the barcode
// width: relative width (for 2D codes that need square aspect ratio)
// category: grouping for the selector
// validate: function to check if text is compatible (optional, returns true if not specified)
// examples: array of {label, value} objects for example content
const SYMS = [
  { value: 'ean13', label: 'EAN-13', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && (t.length === 12 || t.length === 13), examples: [{label: 'Example', value: '123456789012'}] },
  { value: 'ean8', label: 'EAN-8', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && (t.length === 7 || t.length === 8), examples: [{label: 'Example', value: '1234567'}] },
  { value: 'upca', label: 'UPC-A', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && (t.length === 11 || t.length === 12), examples: [{label: 'Example', value: '12345678901'}] },
  { value: 'upce', label: 'UPC-E', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && (t.length >= 6 && t.length <= 8), examples: [{label: 'Example', value: '0123456'}] },
  { value: 'ean14', label: 'EAN-14', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && (t.length === 13 || t.length === 14), examples: [{label: 'Example', value: '1234567890123'}] },
  { value: 'isbn', label: 'ISBN', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && (t.length === 10 || t.length === 13), examples: [{label: 'ISBN-10', value: '0123456789'}, {label: 'ISBN-13', value: '9780123456789'}] },
  { value: 'issn', label: 'ISSN', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && t.length === 8, examples: [{label: 'Example', value: '12345679'}] },
  { value: 'ismn', label: 'ISMN', height: 10, category: 'Retail & Product', validate: (t) => /^\d+$/.test(t) && t.length === 13, examples: [{label: 'Example', value: '9790123456785'}] },
  
  { value: 'code128', label: 'Code 128', height: 10, category: 'General Purpose', examples: [{label: 'Text', value: 'Hello World'}, {label: 'Mixed', value: 'ABC-123'}] },
  { value: 'code39', label: 'Code 39', height: 10, category: 'General Purpose', validate: (t) => /^[A-Z0-9\-. $/+%]+$/i.test(t), examples: [{label: 'Example', value: 'CODE-39'}] },
  { value: 'code93', label: 'Code 93', height: 10, category: 'General Purpose', validate: (t) => /^[A-Z0-9\-. $/+%]+$/i.test(t), examples: [{label: 'Example', value: 'CODE93'}] },
  { value: 'code39ext', label: 'Code 39 Extended', height: 10, category: 'General Purpose', validate: (t) => /^[A-Z0-9\-. $/+%]+$/i.test(t), examples: [{label: 'Example', value: 'CODE-39-EXT'}] },
  { value: 'code93ext', label: 'Code 93 Extended', height: 10, category: 'General Purpose', validate: (t) => /^[A-Z0-9\-. $/+%]+$/i.test(t), examples: [{label: 'Example', value: 'CODE93EXT'}] },
  { value: 'code11', label: 'Code 11', height: 10, category: 'General Purpose', validate: (t) => /^[\d\-]+$/.test(t), examples: [{label: 'Example', value: '12345-678'}] },
  
  { value: 'qrcode', label: 'QR Code', height: 20, width: 20, category: '2D Codes', examples: [
    {label: 'URL', value: 'https://example.com'},
    {label: 'Email', value: 'mailto:user@example.com'},
    {label: 'Phone', value: 'tel:+1234567890'},
    {label: 'SMS', value: 'sms:+1234567890?body=Hello'},
    {label: 'vCard', value: 'BEGIN:VCARD\nVERSION:3.0\nFN:John Doe\nTEL:+1234567890\nEMAIL:john@example.com\nEND:VCARD'}
  ]},
  { value: 'datamatrix', label: 'Data Matrix', height: 20, width: 20, category: '2D Codes', examples: [{label: 'Text', value: 'DataMatrix'}, {label: 'URL', value: 'https://example.com'}] },
  { value: 'azteccode', label: 'Aztec Code', height: 20, width: 20, category: '2D Codes', examples: [{label: 'Text', value: 'Aztec Code'}, {label: 'URL', value: 'https://example.com'}] },
  { value: 'pdf417', label: 'PDF417', height: 15, category: '2D Codes', examples: [{label: 'Text', value: 'PDF417 Barcode'}, {label: 'Long Text', value: 'This is a longer text that can be encoded in PDF417'}] },
  { value: 'micropdf417', label: 'MicroPDF417', height: 12, category: '2D Codes', examples: [{label: 'Text', value: 'MicroPDF417'}] },
  { value: 'maxicode', label: 'MaxiCode', height: 20, width: 20, category: '2D Codes', examples: [{label: 'Shipping', value: '[)>\\u001e01\\u001d961234567890123\\u001d1Z12345678\\u001d'}] },
  { value: 'codeone', label: 'Code One', height: 20, width: 20, category: '2D Codes', examples: [{label: 'Text', value: 'Code One'}] },
  { value: 'microqrcode', label: 'Micro QR Code', height: 18, width: 18, category: '2D Codes', examples: [{label: 'Short Text', value: '12345'}] },
  { value: 'hanxin', label: 'Han Xin Code', height: 20, width: 20, category: '2D Codes', examples: [{label: 'Chinese Text', value: '汉信码'}, {label: 'Mixed', value: 'HanXin 123'}] },
  { value: 'dotcode', label: 'DotCode', height: 14, width: 20, category: '2D Codes', examples: [{label: 'Text', value: 'DotCode'}] },
  { value: 'ultracode', label: 'Ultracode', height: 20, width: 20, category: '2D Codes', examples: [{label: 'Text', value: 'Ultracode'}] },
  
  { value: 'gs1-128', label: 'GS1-128', height: 10, category: 'GS1 System', validate: (t) => /^\(\d{2,4}\)/.test(t), examples: [{label: 'GTIN', value: '(01)12345678901231'}] },
  { value: 'databarexpanded', label: 'GS1 DataBar Expanded', height: 12, category: 'GS1 System', validate: (t) => /^\(\d{2,4}\)/.test(t), examples: [{label: 'GTIN', value: '(01)12345678901231'}] },
  { value: 'databarlimited', label: 'GS1 DataBar Limited', height: 8, category: 'GS1 System', validate: (t) => /^\d+$/.test(t) && t.length === 13, examples: [{label: 'Example', value: '1234567890123'}] },
  { value: 'databaromni', label: 'GS1 DataBar Omnidirectional', height: 10, category: 'GS1 System', validate: (t) => /^\d+$/.test(t) && t.length === 13, examples: [{label: 'Example', value: '1234567890123'}] },
  { value: 'databarstacked', label: 'GS1 DataBar Stacked', height: 12, category: 'GS1 System', validate: (t) => /^\d+$/.test(t) && t.length === 13, examples: [{label: 'Example', value: '1234567890123'}] },
  { value: 'databartruncated', label: 'GS1 DataBar Truncated', height: 8, category: 'GS1 System', validate: (t) => /^\d+$/.test(t) && t.length === 13, examples: [{label: 'Example', value: '1234567890123'}] },
  { value: 'gs1datamatrix', label: 'GS1 Data Matrix', height: 20, width: 20, category: 'GS1 System', validate: (t) => /^\(\d{2,4}\)/.test(t), examples: [{label: 'GTIN + Serial', value: '(01)12345678901231(21)ABC123'}] },
  { value: 'gs1qrcode', label: 'GS1 QR Code', height: 20, width: 20, category: 'GS1 System', validate: (t) => /^\(\d{2,4}\)/.test(t), examples: [{label: 'GTIN + Serial', value: '(01)12345678901231(21)ABC123'}, {label: 'Multi AI', value: '(01)12345678901231(17)250101(10)LOT123'}] },
  { value: 'sscc18', label: 'SSCC-18', height: 10, category: 'GS1 System', validate: (t) => /^\d+$/.test(t) && t.length === 18, examples: [{label: 'Example', value: '123456789012345678'}] },
  { value: 'itf14', label: 'ITF-14', height: 10, category: 'GS1 System', validate: (t) => /^\d+$/.test(t) && t.length === 14, examples: [{label: 'Example', value: '12345678901231'}] },
  
  { value: 'interleaved2of5', label: 'Interleaved 2 of 5 (ITF)', height: 10, category: 'Industrial', validate: (t) => /^\d+$/.test(t) && t.length % 2 === 0 },
  { value: 'code16k', label: 'Code 16K', height: 14, category: 'Industrial' },
  { value: 'codablockf', label: 'Codablock F', height: 14, category: 'Industrial' },
  { value: 'code2of5', label: 'Code 25', height: 10, category: 'Industrial', validate: (t) => /^\d+$/.test(t) },
  { value: 'coop2of5', label: 'COOP 2 of 5', height: 10, category: 'Industrial', validate: (t) => /^\d+$/.test(t) },
  { value: 'matrix2of5', label: 'Matrix 2 of 5', height: 10, category: 'Industrial', validate: (t) => /^\d+$/.test(t) },
  { value: 'industrial2of5', label: 'Industrial 2 of 5', height: 10, category: 'Industrial', validate: (t) => /^\d+$/.test(t) },
  { value: 'iata2of5', label: 'IATA 2 of 5', height: 10, category: 'Industrial', validate: (t) => /^\d+$/.test(t) },
  { value: 'datalogic2of5', label: 'Datalogic 2 of 5', height: 10, category: 'Industrial', validate: (t) => /^\d+$/.test(t) },
  
  { value: 'postnet', label: 'USPS POSTNET', height: 8, category: 'Postal', validate: (t) => /^\d+$/.test(t) && (t.length === 5 || t.length === 9 || t.length === 11) },
  { value: 'planet', label: 'USPS PLANET', height: 8, category: 'Postal', validate: (t) => /^\d+$/.test(t) && (t.length === 11 || t.length === 13) },
  { value: 'onecode', label: 'USPS Intelligent Mail', height: 10, category: 'Postal', validate: (t) => /^\d+$/.test(t) && (t.length === 20 || t.length === 25 || t.length === 29 || t.length === 31) },
  { value: 'royalmail', label: 'Royal Mail 4 State Customer Code', height: 10, category: 'Postal', validate: (t) => /^[A-Z0-9]+$/i.test(t) },
  { value: 'kix', label: 'Royal Dutch TPG Post KIX', height: 8, category: 'Postal', validate: (t) => /^[A-Z0-9]+$/i.test(t) },
  { value: 'japanpost', label: 'Japan Post 4 State Customer Code', height: 10, category: 'Postal', validate: (t) => /^[A-Z0-9\-]+$/i.test(t) },
  { value: 'auspost', label: 'AusPost 4 State Customer Code', height: 10, category: 'Postal', validate: (t) => /^[\d]+$/.test(t) },
  { value: 'canadapost', label: 'Canada Post', height: 10, category: 'Postal', validate: (t) => /^[A-Z0-9]+$/i.test(t) },
  
  { value: 'pharmacode', label: 'Pharmaceutical Binary Code', height: 8, category: 'Pharmaceutical', validate: (t) => /^\d+$/.test(t) && t.length >= 1 && t.length <= 6 },
  { value: 'code32', label: 'Italian Pharmacode', height: 10, category: 'Pharmaceutical', validate: (t) => /^\d+$/.test(t) && t.length === 9 },
  { value: 'pzn', label: 'Pharmazentralnummer (PZN)', height: 10, category: 'Pharmaceutical', validate: (t) => /^\d+$/.test(t) && (t.length === 6 || t.length === 7 || t.length === 8) },
  
  { value: 'telepen', label: 'Telepen', height: 10, category: 'Other' },
  { value: 'telepennumeric', label: 'Telepen Numeric', height: 10, category: 'Other', validate: (t) => /^\d+$/.test(t) },
  { value: 'msi', label: 'MSI Modified Plessey', height: 10, category: 'Other', validate: (t) => /^\d+$/.test(t) },
  { value: 'plessey', label: 'Plessey UK', height: 10, category: 'Other', validate: (t) => /^[A-Z0-9]+$/i.test(t) },
  { value: 'rationalizedCodabar', label: 'Codabar', height: 10, category: 'Other', validate: (t) => /^[A-D][\d\-\$:\/\.\+]+[A-D]$/i.test(t) },
  { value: 'channelcode', label: 'Channel Code', height: 10, category: 'Other', validate: (t) => /^\d+$/.test(t) && t.length >= 1 && t.length <= 7 },
  { value: 'bc412', label: 'BC412', height: 10, category: 'Other', validate: (t) => /^\d+$/.test(t) },
];

const HISTORY_KEY = 'barcode_history_v1';

const BarcodeTool = () => {
  const [text, setText] = useState('');
  const [type, setType] = useState('ean13');
  const [filter, setFilter] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [error, setError] = useState('');
  const [imgUrl, setImgUrl] = useState('');
  const [imageKey, setImageKey] = useState(0);
  const [inverted, setInverted] = useState(false);
  const [outputFormat, setOutputFormat] = useState('svg');
  const [pngScale, setPngScale] = useState(1);
  const canvasRef = useRef(null);
  const svgRef = useRef(null);
  const debounceRef = useRef(null);
  const dropdownRef = useRef(null);
  const [paramDecoded, setParamDecoded] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // Load outputFormat preference from localStorage
  useEffect(() => {
    try {
      const savedFormat = localStorage.getItem('barcode_output_format');
      if (savedFormat === 'png' || savedFormat === 'svg') {
        setOutputFormat(savedFormat);
      }
      const savedScale = localStorage.getItem('barcode_png_scale');
      if (savedScale) {
        const scale = Number(savedScale);
        if (scale >= 1 && scale <= 5) {
          setPngScale(scale);
        }
      }
    } catch {}
  }, []);

  // Fallback priority (runs once after potential param decode): history > example
  useEffect(() => {
    if (initialLoadDone) return;
    
    // Check if there's a URL param to decode first
    const url = new URL(window.location.href);
    const raw = url.searchParams.get('barcode');
    if (raw) {
      // Let Base64QuerySync handle it
      setInitialLoadDone(true);
      return;
    }
    
    // No URL param - try history
    try {
      const historyRaw = localStorage.getItem(HISTORY_KEY);
      if (historyRaw) {
        const items = JSON.parse(historyRaw);
        if (Array.isArray(items) && items.length > 0) {
          setType(items[0].value.type);
          setText(items[0].value.text);
          setInitialLoadDone(true);
          return;
        }
      }
    } catch {}
    // Example default
    setType('ean13');
    setText('123456789012');
    setInitialLoadDone(true);
  }, [initialLoadDone]);

  // Filtered list
  const filteredSyms = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return SYMS;
    return SYMS.filter(s => s.value.toLowerCase().includes(q) || s.label.toLowerCase().includes(q));
  }, [filter]);

  // Group filtered symbols by category with compatibility info
  const groupedSyms = useMemo(() => {
    const groups = {};
    filteredSyms.forEach(sym => {
      if (!groups[sym.category]) {
        groups[sym.category] = [];
      }
      // Check compatibility: if no validate function or text is empty, it's compatible
      const compatible = !text || !sym.validate || sym.validate(text);
      groups[sym.category].push({
        ...sym,
        compatible
      });
    });
    return groups;
  }, [filteredSyms, text]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // URL syncing handled via Base64QuerySync component below.

  // Render barcode to canvas/SVG and capture data URL
  const renderBarcode = () => {
    try {
      // Get the height and width for the current barcode type
      const symConfig = SYMS.find(s => s.value === type);
      const barcodeHeight = symConfig?.height || 12;
      const barcodeWidth = symConfig?.width;
      
      const options = {
        bcid: type,
        text: text,
        scale: 3,
        height: barcodeHeight,
        includetext: true,
        textxalign: 'center',
      };
      
      // Add width for 2D codes to maintain aspect ratio
      if (barcodeWidth) {
        options.width = barcodeWidth;
      }
      
      if (outputFormat === 'svg') {
        const svg = bwipjs.toSVG(options);
        const blob = new Blob([svg], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        setImgUrl(url);
        setImageKey(prev => prev + 1);
        if (svgRef.current) svgRef.current = svg;
      } else {
        const canvas = canvasRef.current;
        if (!canvas) return;
        // Always ensure a solid white background
        const ctx = canvas.getContext('2d');
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.restore();

        bwipjs.toCanvas(canvas, options);

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
          setImageKey(prev => prev + 1);
        } else {
          const url = canvas.toDataURL('image/png');
          setImgUrl(url);
          setImageKey(prev => prev + 1);
        }
      }
      setError('');
    } catch (e) {
      setError(e.message || 'Failed to render');
    }
  };

  // Save outputFormat preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('barcode_output_format', outputFormat);
    } catch {}
  }, [outputFormat]);

  // Save pngScale preference to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('barcode_png_scale', String(pngScale));
    } catch {}
  }, [pngScale]);

  // Debounce rendering
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { renderBarcode(); }, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [text, type, outputFormat, pngScale]);

  const handleDownload = () => {
    if (!imgUrl) return;
    const a = document.createElement('a');
    a.href = imgUrl;
    const ext = outputFormat === 'svg' ? 'svg' : 'png';
    a.download = `${type}-${text}.${ext}`;
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
          value={{ type, text }}
          encode={(obj) => JSON.stringify(obj)}
          decode={(s) => {
            try {
              const parsed = JSON.parse(s);
              if (parsed && typeof parsed === 'object' && typeof parsed.text === 'string' && typeof parsed.type === 'string') {
                if (SYMS.some(sym => sym.value === parsed.type)) {
                  return parsed; // success
                }
              }
            } catch {}
            return undefined; // incompatible
          }}
          onDecoded={(parsed) => {
            setType(parsed.type);
            setText(parsed.text);
            setParamDecoded(true);
            setInitialLoadDone(true);
          }}
          queryParam="barcode"
          updateOnMount={false}
        />
        <h2 className="text-xl font-bold">Barcode Generator</h2>
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {/* Controls */}
          <div className="flex flex-col gap-3">
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Barcode Content</label>
              <textarea
                value={text}
                onChange={(e)=>setText(e.target.value)}
                placeholder="Enter content (digits/text depending on type)"
                className="mt-1 w-full text-xs font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtBlue resize-none"
                spellCheck="false"
                rows={3}
              />
            </div>
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Barcode Type</label>
              <div className="mt-1 relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen(!dropdownOpen)}
                  className="w-full text-xs px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-jwtPurple text-left flex items-center justify-between"
                >
                  <span>{SYMS.find(s => s.value === type)?.label || type}</span>
                  <span className="text-gray-400">{dropdownOpen ? '▲' : '▼'}</span>
                </button>
                
                {dropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded shadow-lg max-h-96 overflow-hidden flex flex-col">
                    <div className="p-2 border-b border-gray-200 dark:border-gray-700">
                      <input
                        value={filter}
                        onChange={(e) => setFilter(e.target.value)}
                        placeholder="Search barcode types..."
                        className="w-full text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-jwtPurple"
                        autoFocus
                      />
                    </div>
                    <div className="overflow-y-auto custom-scrollbar">
                      {Object.entries(groupedSyms).map(([category, syms]) => (
                        <div key={category}>
                          <div className="px-3 py-1 text-[10px] font-bold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-900 sticky top-0">
                            {category}
                          </div>
                          {syms.map(sym => (
                            <button
                              key={sym.value}
                              onClick={() => {
                                if (sym.compatible) {
                                  setType(sym.value);
                                  setDropdownOpen(false);
                                  setFilter('');
                                }
                              }}
                              disabled={!sym.compatible}
                              className={`w-full text-left px-3 py-2 text-xs transition ${
                                !sym.compatible 
                                  ? 'opacity-40 cursor-not-allowed text-gray-400 dark:text-gray-600' 
                                  : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                              } ${
                                type === sym.value ? 'bg-jwtBlue/10 dark:bg-jwtBlue/20 font-semibold' : ''
                              }`}
                              title={!sym.compatible ? 'Input not compatible with this barcode type' : sym.label}
                            >
                              {sym.label}
                              {!sym.compatible && <span className="ml-1 text-[9px]">✗</span>}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            {SYMS.find(s => s.value === type)?.examples && SYMS.find(s => s.value === type)?.examples.length > 0 && (
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Examples</label>
                <select
                  onChange={(e) => {
                    if (e.target.value) {
                      setText(e.target.value);
                      e.target.value = ''; // Reset select
                    }
                  }}
                  className="mt-1 w-full text-xs px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtPurple cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
                  defaultValue=""
                >
                  <option value="" className="text-gray-500">Select an example...</option>
                  {SYMS.find(s => s.value === type)?.examples.map((ex, idx) => (
                    <option key={idx} value={ex.value} className="text-gray-900 dark:text-gray-100">{ex.label}</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400">Output Format</label>
              <div className="mt-1 flex gap-2">
                <button
                  onClick={() => setOutputFormat('png')}
                  className={`flex-1 px-3 py-2 text-xs rounded border transition ${
                    outputFormat === 'png'
                      ? 'bg-jwtBlue text-white border-jwtBlue'
                      : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
                  }`}
                >
                  PNG
                </button>
                <button
                  onClick={() => setOutputFormat('svg')}
                  className={`flex-1 px-3 py-2 text-xs rounded border transition ${
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
            <div className="flex gap-2 flex-wrap text-xs">
              <button onClick={handleDownload} className="px-3 py-1 rounded bg-jwtBlue text-white font-semibold hover:opacity-90">Download {outputFormat.toUpperCase()}</button>
              <button onClick={handleCopyImage} className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:opacity-90">Copy Image</button>
              <button onClick={handleShare} className="px-3 py-1 rounded bg-jwtPurple text-white font-semibold hover:opacity-90">Share</button>
              <button onClick={()=>setInverted(v=>!v)} className="px-3 py-1 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-100 hover:opacity-90">{inverted ? 'Black on White' : 'White on Black'}</button>
            </div>
            {error && <div className="text-[10px] text-red-600 font-mono">{error}</div>}
          </div>

          {/* Preview */}
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-4">
            <div className="text-xs font-bold mb-2 text-gray-500 dark:text-gray-400">Barcode Preview ({outputFormat.toUpperCase()})</div>
            <div className={`flex items-center justify-center min-h-[220px] p-4 border-2 border-gray-400 dark:border-gray-500 rounded ${inverted ? 'bg-black' : 'bg-white'}`}>
              {imgUrl ? (
                <img 
                  key={imageKey}
                  src={imgUrl} 
                  alt="barcode" 
                  className={`max-w-full max-h-[360px] object-contain ${inverted ? 'invert' : ''} animate-fade-in`} 
                />
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
          newItem={initialLoadDone && text ? { text, type } : null}
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

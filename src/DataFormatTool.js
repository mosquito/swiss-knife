import React, { useState, useRef, useEffect } from 'react';
import YAML from 'yaml';

// Two-pane JSON/YAML/TOML converter (bidirectional). Browser-only.
// Minimal TOML implementation (no dates, multiline strings, inline tables, etc.).

const initialObj = { message: 'Hello', number: 42, list: ['a','b','c'], nested: { flag: true } };

const stringifyJson = (obj) => JSON.stringify(obj, null, 2);
const stringifyYaml = (obj) => YAML.stringify(obj);
const isPlainObject = (v) => Object.prototype.toString.call(v) === '[object Object]';
const escapeTomlString = (s) => s.replace(/"/g,'\\"');
const serializeValue = (v) => {
  if (v === null) return 'null';
  if (typeof v === 'string') return '"' + escapeTomlString(v) + '"';
  if (typeof v === 'number' || typeof v === 'bigint') return String(v);
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (Array.isArray(v)) return '[' + v.map(serializeValue).join(', ') + ']';
  if (isPlainObject(v)) return ''; // handled in table recursion
  return '""';
};
const stringifyToml = (obj) => {
  if (!isPlainObject(obj)) return '';
  const lines = [];
  const walk = (o, path=[]) => {
    const scalars = Object.keys(o).filter(k => !isPlainObject(o[k]));
    const nested = Object.keys(o).filter(k => isPlainObject(o[k]));
    if (path.length) lines.push('[' + path.join('.') + ']');
    scalars.forEach(k => lines.push(k + ' = ' + serializeValue(o[k])));
    if (scalars.length && nested.length) lines.push('');
    nested.forEach(k => walk(o[k], [...path, k]));
  };
  walk(obj);
  return lines.join('\n');
};

// XML formatter - only formats, doesn't convert from objects
const formatXml = (xmlString) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(xmlString, 'text/xml');
  
  // Check for parsing errors
  const parserError = xmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid XML: ' + parserError.textContent);
  }
  
  // Format the XML with indentation
  const serializer = new XMLSerializer();
  const formatted = serializer.serializeToString(xmlDoc);
  
  // Add proper indentation
  const formatWithIndent = (xml) => {
    let formatted = '';
    let indent = 0;
    xml.split(/>\s*</).forEach((node) => {
      if (node.match(/^\/\w/)) indent--; // Closing tag
      formatted += '  '.repeat(Math.max(0, indent)) + '<' + node + '>\n';
      if (node.match(/^<?\w[^>]*[^\/]$/)) indent++; // Opening tag
    });
    return formatted.substring(1, formatted.length - 2);
  };
  
  return formatWithIndent(formatted);
};

// HTML formatter - only formats, doesn't convert from objects
const formatHtml = (htmlString) => {
  const parser = new DOMParser();
  const htmlDoc = parser.parseFromString(htmlString, 'text/html');
  
  // Check for parsing errors
  const parserError = htmlDoc.querySelector('parsererror');
  if (parserError) {
    throw new Error('Invalid HTML: ' + parserError.textContent);
  }
  
  // Get the full HTML
  const formatted = htmlDoc.documentElement.outerHTML;
  
  // Add proper indentation
  const formatWithIndent = (html) => {
    let formatted = '';
    let indent = 0;
    html.split(/>\s*</).forEach((node) => {
      if (node.match(/^\/\w/)) indent--; // Closing tag
      formatted += '  '.repeat(Math.max(0, indent)) + '<' + node + '>\n';
      if (node.match(/^<?\w[^>]*[^\/]$/)) indent++; // Opening tag
    });
    return formatted.substring(1, formatted.length - 2);
  };
  
  return formatWithIndent(formatted);
};

const parseToml = (text) => {
  const root = {}; let current = root;
  const lines = text.split(/\r?\n/);
  for (let raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('[') && line.endsWith(']')) {
      const name = line.slice(1,-1).trim();
      if (!name) throw new Error('Invalid table header');
      const parts = name.split('.');
      let ctx = root; for (const p of parts) { if (!isPlainObject(ctx[p])) ctx[p] = {}; ctx = ctx[p]; }
      current = ctx; continue;
    }
    const eq = line.indexOf('='); if (eq === -1) throw new Error('Expected =');
    const key = line.slice(0,eq).trim(); let val = line.slice(eq+1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1,-1).replace(/\\"/g,'"');
    else if (val === 'true' || val === 'false') val = val === 'true';
    else if (val.startsWith('[') && val.endsWith(']')) {
      const inner = val.slice(1,-1).trim();
      val = inner ? inner.split(',').map(x=>{
        const t=x.trim();
        if (t.startsWith('"') && t.endsWith('"')) return t.slice(1,-1).replace(/\\"/g,'"');
        if (t==='true'||t==='false') return t==='true';
        const n=Number(t); return isNaN(n)?t:n;
      }) : [];
    } else if (!isNaN(Number(val))) val = Number(val);
    current[key]=val;
  }
  return root;
};

const formatters = {
  json: stringifyJson,
  yaml: stringifyYaml,
  toml: stringifyToml,
  xml: formatXml,
  html: formatHtml
};
const parsers = {
  json: (t) => JSON.parse(t),
  yaml: (t) => YAML.parse(t),
  toml: (t) => parseToml(t),
  xml: (t) => t, // XML is only for formatting, not parsing to objects
  html: (t) => t // HTML is only for formatting, not parsing to objects
};

const DataFormatTool = () => {
  const [leftFormat, setLeftFormat] = useState('json');
  const [rightFormat, setRightFormat] = useState('yaml');
  const [leftText, setLeftText] = useState(() => formatters[leftFormat](initialObj));
  const [rightText, setRightText] = useState(() => formatters[rightFormat](initialObj));
  const [errorLeft, setErrorLeft] = useState('');
  const [errorRight, setErrorRight] = useState('');
  const [lastEdited, setLastEdited] = useState('left');
  const debounceRef = useRef(null);
  const currentObjRef = useRef(initialObj);

  // Parse edited pane and update opposite pane
  const performSync = () => {
    const editedSide = lastEdited;
    const editedFormat = editedSide === 'left' ? leftFormat : rightFormat;
    const editedText = editedSide === 'left' ? leftText : rightText;
    const otherFormat = editedSide === 'left' ? rightFormat : leftFormat;
    
    // XML can only format itself, not convert to other formats
    if (editedFormat === 'xml') {
      try {
        const formatted = formatXml(editedText);
        if (editedSide === 'left') {
          setErrorLeft('');
          if (otherFormat === 'xml') setRightText(formatted);
        } else {
          setErrorRight('');
          if (otherFormat === 'xml') setLeftText(formatted);
        }
      } catch (e) {
        const msg = e.message || 'Format error';
        if (editedSide === 'left') setErrorLeft(msg); else setErrorRight(msg);
      }
      return;
    }
    
    // HTML can only format itself, not convert to other formats
    if (editedFormat === 'html') {
      try {
        const formatted = formatHtml(editedText);
        if (editedSide === 'left') {
          setErrorLeft('');
          if (otherFormat === 'html') setRightText(formatted);
        } else {
          setErrorRight('');
          if (otherFormat === 'html') setLeftText(formatted);
        }
      } catch (e) {
        const msg = e.message || 'Format error';
        if (editedSide === 'left') setErrorLeft(msg); else setErrorRight(msg);
      }
      return;
    }
    
    // Other formats (JSON, YAML, TOML) cannot convert to XML or HTML
    if (otherFormat === 'xml' || otherFormat === 'html') return;
    
    try {
      const obj = parsers[editedFormat](editedText);
      currentObjRef.current = obj;
      if (editedSide === 'left') setErrorLeft(''); else setErrorRight('');
      const otherSerialized = formatters[otherFormat](obj);
      if (editedSide === 'left') setRightText(otherSerialized); else setLeftText(otherSerialized);
    } catch (e) {
      const msg = e.message || 'Parse error';
      if (editedSide === 'left') setErrorLeft(msg); else setErrorRight(msg);
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(performSync, 250);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [leftText, rightText]);

  // When format selector changes, reserialize current object into that pane, and resync opposite if lastEdited is other side
  useEffect(() => {
    if (leftFormat === 'xml') {
      setLeftText('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n</root>');
      setRightFormat('xml');
    } else if (leftFormat === 'html') {
      setLeftText('<!DOCTYPE html>\n<html>\n<head>\n  <title>Document</title>\n</head>\n<body>\n</body>\n</html>');
      setRightFormat('html');
    } else {
      setLeftText(formatters[leftFormat](currentObjRef.current));
      // If right was XML or HTML, change it to match left
      if (rightFormat === 'xml' || rightFormat === 'html') {
        setRightFormat(leftFormat);
      }
    }
  }, [leftFormat]);
  useEffect(() => {
    if (rightFormat === 'xml') {
      setRightText('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n</root>');
      setLeftFormat('xml');
    } else if (rightFormat === 'html') {
      setRightText('<!DOCTYPE html>\n<html>\n<head>\n  <title>Document</title>\n</head>\n<body>\n</body>\n</html>');
      setLeftFormat('html');
    } else {
      setRightText(formatters[rightFormat](currentObjRef.current));
      // If left was XML or HTML, change it to match right
      if (leftFormat === 'xml' || leftFormat === 'html') {
        setLeftFormat(rightFormat);
      }
    }
  }, [rightFormat]);

  const handleLeftChange = (e) => { setLastEdited('left'); setLeftText(e.target.value); };
  const handleRightChange = (e) => { setLastEdited('right'); setRightText(e.target.value); };

  const handleSwap = () => {
    // Swap formats while keeping semantic object
    setLeftFormat(rightFormat);
    setRightFormat(leftFormat);
    // After format changes, effects will reserialize
  };

  const handleFormatBoth = () => {
    // Only format if both sides are XML/HTML or neither is XML/HTML
    if (leftFormat === 'xml' || rightFormat === 'xml' || leftFormat === 'html' || rightFormat === 'html') {
      // Format XML side(s)
      if (leftFormat === 'xml') {
        try {
          setLeftText(formatXml(leftText));
          setErrorLeft('');
        } catch (e) {
          setErrorLeft(e.message || 'Format error');
        }
      }
      if (rightFormat === 'xml') {
        try {
          setRightText(formatXml(rightText));
          setErrorRight('');
        } catch (e) {
          setErrorRight(e.message || 'Format error');
        }
      }
      // Format HTML side(s)
      if (leftFormat === 'html') {
        try {
          setLeftText(formatHtml(leftText));
          setErrorLeft('');
        } catch (e) {
          setErrorLeft(e.message || 'Format error');
        }
      }
      if (rightFormat === 'html') {
        try {
          setRightText(formatHtml(rightText));
          setErrorRight('');
        } catch (e) {
          setErrorRight(e.message || 'Format error');
        }
      }
    } else {
      const obj = currentObjRef.current;
      setLeftText(formatters[leftFormat](obj));
      setRightText(formatters[rightFormat](obj));
      setErrorLeft(''); setErrorRight('');
    }
  };

  const handleClear = () => {
    const empty = {};
    currentObjRef.current = empty;
    if (leftFormat === 'xml') {
      setLeftText('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n</root>');
    } else if (leftFormat === 'html') {
      setLeftText('<!DOCTYPE html>\n<html>\n<head>\n  <title>Document</title>\n</head>\n<body>\n</body>\n</html>');
    } else {
      setLeftText(formatters[leftFormat](empty));
    }
    if (rightFormat === 'xml') {
      setRightText('<?xml version="1.0" encoding="UTF-8"?>\n<root>\n</root>');
    } else if (rightFormat === 'html') {
      setRightText('<!DOCTYPE html>\n<html>\n<head>\n  <title>Document</title>\n</head>\n<body>\n</body>\n</html>');
    } else {
      setRightText(formatters[rightFormat](empty));
    }
    setErrorLeft(''); setErrorRight('');
  };

  const copyToClipboard = async (text) => { try { await navigator.clipboard.writeText(text); } catch { /* ignore */ } };

  return (
    <div className="tool-container">
      <div className="tool-content">
        <h2 className="tool-title">Data Format Converter</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Bidirectional conversion between JSON, YAML, TOML. XML and HTML formatting only (no conversion). Edit either pane; the other updates. All local. TOML support is minimal.</p>
        <div className="flex gap-2 flex-wrap text-xs">
          <button onClick={handleFormatBoth} className="btn-primary btn-sm">Format</button>
          <button onClick={handleSwap} className="btn-primary btn-sm">Swap</button>
          <button onClick={handleClear} className="btn-secondary btn-sm">Clear</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          {/* LEFT PANE */}
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded h-[60vh] md:h-[70vh] min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[11px]">Source</span>
                <select value={leftFormat} onChange={e=>setLeftFormat(e.target.value)} className="text-[11px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 focus:outline-none">
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="toml">TOML</option>
                  <option value="xml">XML</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              <button onClick={()=>copyToClipboard(leftText)} className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Copy</button>
            </div>
            <textarea
              value={leftText}
              onChange={handleLeftChange}
              spellCheck="false"
              className="flex-1 p-3 font-mono text-[11px] bg-transparent resize-none focus:outline-none min-h-0"
            />
            {errorLeft && <div className="px-3 py-1 text-[10px] text-red-600 border-t border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 font-mono">{errorLeft}</div>}
          </div>
          {/* RIGHT PANE */}
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded h-[60vh] md:h-[70vh] min-h-0">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 gap-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[11px]">Target</span>
                <select value={rightFormat} onChange={e=>setRightFormat(e.target.value)} className="text-[11px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 focus:outline-none">
                  <option value="json">JSON</option>
                  <option value="yaml">YAML</option>
                  <option value="toml">TOML</option>
                  <option value="xml">XML</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              <button onClick={()=>copyToClipboard(rightText)} className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Copy</button>
            </div>
            <textarea
              value={rightText}
              onChange={handleRightChange}
              spellCheck="false"
              className="flex-1 p-3 font-mono text-[11px] bg-transparent resize-none focus:outline-none min-h-0"
            />
            {errorRight && <div className="px-3 py-1 text-[10px] text-red-600 border-t border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 font-mono">{errorRight}</div>}
          </div>
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono space-y-1">
          <div>Limitations: TOML advanced features (datetime, inline tables, multiline & literal strings, comments preservation) are not supported.</div>
          <div>XML & HTML: Formatting only (no conversion to/from other formats). Comments may not be preserved. Whitespace handling follows browser DOM parser rules.</div>
        </div>
      </div>
    </div>
  );
};

export default DataFormatTool;

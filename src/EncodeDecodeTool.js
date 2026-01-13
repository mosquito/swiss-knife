import React, { useState, useEffect, useRef, useMemo } from 'react';
import TextareaWithLineNumbers from './TextareaWithLineNumbers';
import Base64QuerySync from './Base64QuerySync';
import { encodeBase32, decodeBase32, encodeBase64, decodeBase64, encodeBase85, decodeBase85, encodeHex, decodeHex } from './utils';

// Encode / Decode utility supporting: Base64, Base32, Hex, URL
// All operations performed locally in the browser.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder('utf-8', { fatal: false });

const encodeURL = (str) => encodeURIComponent(str);
const decodeURL = (str) => decodeURIComponent(str);

// Convert bytes to hex dump format
const bytesToHex = (bytes) => {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
};

// Check if decoded text likely contains binary data (non-printable or replacement chars)
const isBinaryData = (text, bytes) => {
  // Check for replacement character (indicates invalid UTF-8)
  if (text.includes('\ufffd')) return true;
  // Check for high ratio of non-printable characters (except common whitespace)
  let nonPrintable = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code < 32 && code !== 9 && code !== 10 && code !== 13) nonPrintable++;
    if (code >= 127 && code < 160) nonPrintable++;
  }
  return text.length > 0 && (nonPrintable / text.length) > 0.1;
};

const formats = ['base64','base32','base85','hex','url'];

// Compact URL encoding: m=mode(0=encode,1=decode), f=format(0-4), i=input
const MODE_MAP = { encode: 0, decode: 1 };
const MODE_REVERSE = ['encode', 'decode'];
const FORMAT_MAP = { base64: 0, base32: 1, base85: 2, hex: 3, url: 4 };
const FORMAT_REVERSE = ['base64', 'base32', 'base85', 'hex', 'url'];
const MAX_INPUT_LENGTH = 2000;

const EncodeDecodeTool = () => {
  const [mode, setMode] = useState('encode'); // 'encode' | 'decode'
  const [format, setFormat] = useState('base64');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [outputBytes, setOutputBytes] = useState(null); // raw bytes for binary data
  const [outputMode, setOutputMode] = useState('text'); // 'text' | 'hex'
  const [isBinary, setIsBinary] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  // Compact URL encoding
  const encodeParams = useMemo(() => (val) => JSON.stringify({
    m: MODE_MAP[val.mode],
    f: FORMAT_MAP[val.format],
    i: val.input && val.input.length <= MAX_INPUT_LENGTH ? val.input : ''
  }), []);
  const decodeParams = useMemo(() => (str) => {
    try {
      const obj = JSON.parse(str);
      if (obj && typeof obj === 'object' &&
          obj.m in MODE_REVERSE && obj.f in FORMAT_REVERSE) {
        return {
          mode: MODE_REVERSE[obj.m],
          format: FORMAT_REVERSE[obj.f],
          input: obj.i || ''
        };
      }
    } catch {}
    return undefined;
  }, []);

  const handleParamsDecoded = (params) => {
    setMode(params.mode);
    setFormat(params.format);
    if (params.input !== undefined) setInput(params.input);
  };

  const compute = () => {
    let result = '';
    let bytes = null;
    let binary = false;
    let errorMsg = '';

    if (mode === 'encode') {
      try {
        if (format === 'url') result = encodeURL(input);
        else {
          const inputBytes = textEncoder.encode(input);
          switch (format) {
            case 'base64': result = encodeBase64(inputBytes); break;
            case 'base32': result = encodeBase32(inputBytes); break;
            case 'base85': result = encodeBase85(inputBytes); break;
            case 'hex': result = encodeHex(inputBytes); break;
            default: result = '';
          }
        }
      } catch (e) {
        errorMsg = e.message || 'Encoding failed';
      }
      setOutputBytes(null);
      setIsBinary(false);
    } else { // decode
      if (format === 'url') {
        try {
          result = decodeURL(input);
        } catch (e) {
          errorMsg = e.message || 'URL decode failed';
          // Show raw input as partial result
          result = input;
        }
        setOutputBytes(null);
        setIsBinary(false);
      } else {
        // Remove all whitespace (spaces, newlines, tabs) for base encodings
        const stripped = input.replace(/\s+/g, '');
        try {
          switch (format) {
            case 'base64': bytes = decodeBase64(stripped); break;
            case 'base32': bytes = decodeBase32(stripped); break;
            case 'base85': bytes = decodeBase85(stripped); break;
            case 'hex': bytes = decodeHex(stripped); break;
            default: bytes = new Uint8Array();
          }
          const textResult = textDecoder.decode(bytes);
          binary = isBinaryData(textResult, bytes);
          setOutputBytes(bytes);
          setIsBinary(binary);
          result = (binary && outputMode === 'hex') ? bytesToHex(bytes) : textResult;
        } catch (e) {
          errorMsg = e.message || 'Decoding failed';
          // Try to show partial decode - attempt to decode what we can
          try {
            let validStr = '';
            if (format === 'base64') {
              // Strip invalid chars and fix padding
              validStr = stripped.replace(/[^A-Za-z0-9+/]/g, '');
              // Fix padding - base64 needs length divisible by 4
              const pad = validStr.length % 4;
              if (pad === 2) validStr += '==';
              else if (pad === 3) validStr += '=';
              else if (pad === 1) validStr = validStr.slice(0, -1); // remove incomplete
            } else if (format === 'base32') {
              validStr = stripped.replace(/[^A-Z2-7]/gi, '').toUpperCase();
              // Fix padding for base32 - needs length divisible by 8
              const pad = validStr.length % 8;
              if (pad > 0) validStr = validStr.slice(0, -(pad)); // truncate to valid length
            } else if (format === 'base85') {
              validStr = stripped.replace(/[^0-9A-Za-z!#$%&()*+;<=>?@^_`{|}~-]/g, '');
            } else if (format === 'hex') {
              validStr = stripped.replace(/[^0-9A-Fa-f]/g, '');
              if (validStr.length % 2 !== 0) validStr = validStr.slice(0, -1);
            }

            if (validStr) {
              switch (format) {
                case 'base64': bytes = decodeBase64(validStr); break;
                case 'base32': bytes = decodeBase32(validStr); break;
                case 'base85': bytes = decodeBase85(validStr); break;
                case 'hex': bytes = decodeHex(validStr); break;
                default: bytes = new Uint8Array();
              }
              if (bytes && bytes.length > 0) {
                result = textDecoder.decode(bytes);
                binary = isBinaryData(result, bytes);
                setOutputBytes(bytes);
                setIsBinary(binary);
                if (binary && outputMode === 'hex') result = bytesToHex(bytes);
              }
            }
          } catch {
            // Keep empty result if partial decode also fails
            setOutputBytes(null);
            setIsBinary(false);
          }
        }
      }
    }
    setOutput(result);
    setError(errorMsg);
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(compute, 200);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [input, mode, format]);

  const handleCopy = async (text) => { try { await navigator.clipboard.writeText(text); } catch {/* ignore */} };
  const handleClear = () => { setInput(''); setOutput(''); setError(''); setOutputBytes(null); setIsBinary(false); setOutputMode('text'); };

  const handleDownload = () => {
    if (!outputBytes) return;
    const blob = new Blob([outputBytes], { type: 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'decoded-data.bin';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleOutputMode = () => {
    const newMode = outputMode === 'text' ? 'hex' : 'text';
    setOutputMode(newMode);
    if (outputBytes) {
      setOutput(newMode === 'hex' ? bytesToHex(outputBytes) : textDecoder.decode(outputBytes));
    }
  };
  const handleSwap = () => {
    // Use current output as new input and toggle mode.
    // If output empty, just toggle mode keeping existing input.
    const nextMode = mode === 'encode' ? 'decode' : 'encode';
    if (output) {
      setInput(output);
      setOutput('');
    }
    setMode(nextMode);
    setOutputBytes(null);
    setIsBinary(false);
    setOutputMode('text');
    // Force immediate recompute after swap
    setTimeout(compute, 0);
  };

  const syncValue = useMemo(() => ({ mode, format, input }), [mode, format, input]);

  return (
    <div className="tool-container">
      <Base64QuerySync
        value={syncValue}
        encode={encodeParams}
        decode={decodeParams}
        onDecoded={handleParamsDecoded}
        queryParam="enc"
        toolHash="#encode"
      />
      <div className="tool-content">
        <h2 className="tool-title">Encode / Decode</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Transform text between Base64, Base32, Hex and URL encodings. All operations stay in your browser.</p>
        <div className="flex flex-wrap gap-2 text-xs items-center">
          <label className="flex items-center gap-1">Mode:
            <select value={mode} onChange={e=>setMode(e.target.value)} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
              <option value="encode">Encode</option>
              <option value="decode">Decode</option>
            </select>
          </label>
          <label className="flex items-center gap-1">Format:
            <select value={format} onChange={e=>setFormat(e.target.value)} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
              {formats.map(f=> <option key={f} value={f}>{f.toUpperCase()}</option>)}
            </select>
          </label>
          <button onClick={handleSwap} className="btn-primary btn-sm">Swap</button>
          <button onClick={handleClear} className="btn-secondary btn-sm">Clear</button>
          <button onClick={()=>handleCopy(output)} className="btn-primary btn-sm">Copy Output</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded h-[55vh] md:h-[60vh] min-h-0">
            <div className="px-3 py-2 text-[11px] font-bold border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
              <span>Input ({mode === 'encode' ? 'raw text' : 'encoded text'})</span>
              <button onClick={()=>handleCopy(input)} className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Copy</button>
            </div>
            <TextareaWithLineNumbers
              value={input}
              onChange={e=>setInput(e.target.value)}
              spellCheck="false"
              placeholder={mode==='encode'? 'Type text to encode' : 'Paste encoded text to decode'}
              className="flex-1 font-mono text-[11px] bg-transparent min-h-0"
              gutterClassName="bg-gray-50 dark:bg-gray-900/50 text-gray-400 border-r border-gray-200 dark:border-gray-700 p-3 min-w-[2.5rem]"
              textareaClassName="bg-transparent p-3 border-none w-full h-full"
            />
          </div>
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded h-[55vh] md:h-[60vh] min-h-0">
            <div className="px-3 py-2 text-[11px] font-bold border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
              <span>Output ({mode === 'encode' ? 'encoded text' : 'decoded text'}){isBinary && ' (binary detected)'}</span>
              {mode === 'decode' && isBinary && (
                <div className="flex gap-1">
                  <button onClick={toggleOutputMode} className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">
                    {outputMode === 'text' ? 'Hex' : 'Text'}
                  </button>
                  <button onClick={handleDownload} className="text-[10px] px-2 py-1 rounded bg-blue-500 text-white hover:bg-blue-600">
                    Download
                  </button>
                </div>
              )}
            </div>
            <TextareaWithLineNumbers
              value={output}
              readOnly
              spellCheck="false"
              className="flex-1 font-mono text-[11px] bg-transparent min-h-0"
              gutterClassName="bg-gray-50 dark:bg-gray-900/50 text-gray-400 border-r border-gray-200 dark:border-gray-700 p-3 min-w-[2.5rem]"
              textareaClassName="bg-transparent p-3 border-none w-full h-full"
            />
            {error && <div className="px-3 py-1 text-[10px] text-red-600 border-t border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 font-mono">{error}</div>}
          </div>
        </div>
        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">Unicode via UTF-8. Base32: RFC4648 alphabet (base-x library). Base85: Ascii85 variant (ascii85 library). URL uses encodeURIComponent/decodeURIComponent.</div>
      </div>
    </div>
  );
};

export default EncodeDecodeTool;
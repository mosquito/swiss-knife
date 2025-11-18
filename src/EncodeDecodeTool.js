import React, { useState, useEffect, useRef } from 'react';
import { encodeBase32, decodeBase32, encodeBase64, decodeBase64, encodeBase85, decodeBase85, encodeHex, decodeHex } from './utils';

// Encode / Decode utility supporting: Base64, Base32, Hex, URL
// All operations performed locally in the browser.

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const encodeURL = (str) => encodeURIComponent(str);
const decodeURL = (str) => decodeURIComponent(str);

const formats = ['base64','base32','base85','hex','url'];

const EncodeDecodeTool = () => {
  const [mode, setMode] = useState('encode'); // 'encode' | 'decode'
  const [format, setFormat] = useState('base64');
  const [input, setInput] = useState('Hello World');
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const compute = () => {
    try {
      let result='';
      if (mode === 'encode') {
        if (format === 'url') result = encodeURL(input);
        else {
          const bytes = textEncoder.encode(input);
          switch (format) {
            case 'base64': result = encodeBase64(bytes); break;
            case 'base32': result = encodeBase32(bytes); break;
            case 'base85': result = encodeBase85(bytes); break;
            case 'hex': result = encodeHex(bytes); break;
            default: result='';
          }
        }
      } else { // decode
        if (format === 'url') result = decodeURL(input);
        else {
          let bytes;
            switch (format) {
              case 'base64': bytes = decodeBase64(input.trim()); break;
              case 'base32': bytes = decodeBase32(input.trim()); break;
              case 'base85': bytes = decodeBase85(input.trim()); break;
              case 'hex': bytes = decodeHex(input.trim()); break;
              default: bytes = new Uint8Array();
            }
          result = textDecoder.decode(bytes);
        }
      }
      setOutput(result); setError('');
    } catch (e) {
      setError(e.message || 'Conversion failed'); setOutput('');
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(compute, 200);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [input, mode, format]);

  const handleCopy = async (text) => { try { await navigator.clipboard.writeText(text); } catch {/* ignore */} };
  const handleClear = () => { setInput(''); setOutput(''); setError(''); };
  const handleSwap = () => {
    // Use current output as new input and toggle mode.
    // If output empty, just toggle mode keeping existing input.
    const nextMode = mode === 'encode' ? 'decode' : 'encode';
    if (output) {
      setInput(output);
      setOutput('');
    }
    setMode(nextMode);
    // Force immediate recompute after swap
    setTimeout(compute, 0);
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
      <div className="flex-1 overflow-auto p-6 space-y-4 custom-scrollbar">
        <h2 className="text-xl font-bold">Encode / Decode</h2>
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
          <button onClick={handleSwap} className="px-3 py-1 rounded bg-jwtPurple text-white font-semibold hover:opacity-90">Swap</button>
          <button onClick={handleClear} className="px-3 py-1 rounded bg-gray-300 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:opacity-90">Clear</button>
          <button onClick={()=>handleCopy(output)} className="px-3 py-1 rounded bg-jwtBlue text-white hover:opacity-90">Copy Output</button>
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded h-[55vh] md:h-[60vh] min-h-0">
            <div className="px-3 py-2 text-[11px] font-bold border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
              <span>Input ({mode === 'encode' ? 'raw text' : 'encoded text'})</span>
              <button onClick={()=>handleCopy(input)} className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500">Copy</button>
            </div>
            <textarea
              value={input}
              onChange={e=>setInput(e.target.value)}
              spellCheck="false"
              placeholder={mode==='encode'? 'Type text to encode' : 'Paste encoded text to decode'}
              className="flex-1 p-3 font-mono text-[11px] bg-transparent resize-none focus:outline-none min-h-0"
            />
          </div>
          <div className="flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded h-[55vh] md:h-[60vh] min-h-0">
            <div className="px-3 py-2 text-[11px] font-bold border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
              <span>Output ({mode === 'encode' ? 'encoded text' : 'decoded text'})</span>
            </div>
            <textarea
              value={output}
              readOnly
              spellCheck="false"
              className="flex-1 p-3 font-mono text-[11px] bg-transparent resize-none focus:outline-none min-h-0"
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
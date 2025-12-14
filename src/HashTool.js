import React, { useState, useEffect, useRef } from 'react';
import TextareaWithLineNumbers from './TextareaWithLineNumbers';
import MD5 from 'crypto-js/md5';
import SHA256 from 'crypto-js/sha256';
import SHA512 from 'crypto-js/sha512';
import encHex from 'crypto-js/enc-hex';
import bcrypt from 'bcryptjs';
import { blake2bHex, blake2sHex } from 'blakejs';
import { encodeBase32, encodeBase64, encodeBase85, decodeHex } from './utils';

// Full algorithm list we compute concurrently
const algorithms = ['MD5','SHA-256','SHA-512','BLAKE2b','BLAKE2s','bcrypt'];

const HashTool = () => {
  const [input, setInput] = useState('');
  const [results, setResults] = useState({}); // { alg: { hex, base64, base32, base85 } }
  const [isComputing, setIsComputing] = useState(false);
  const [error, setError] = useState('');
  const debounceRef = useRef(null);

  const computeAll = async (text) => {
    if (!text) { setResults({}); return; }
    setIsComputing(true);
    setError('');
    try {
      // Compute synchronously but wrapped in a microtask chain for asynchronicity
      const nextResults = {};
      for (const alg of algorithms) {
        let hex = '';
        let base64 = '';
        let base32 = '';
        let base85 = '';
        
        if (alg === 'bcrypt') {
          // bcrypt produces a full hash string, not raw bytes
          const salt = await bcrypt.genSalt(10);
          const hash = await bcrypt.hash(text, salt);
          nextResults[alg] = { hex: hash, base64: '(see hex)', base32: '(see hex)', base85: '(see hex)' };
        } else {
          switch (alg) {
            case 'MD5': hex = MD5(text).toString(encHex); break;
            case 'SHA-256': hex = SHA256(text).toString(encHex); break;
            case 'SHA-512': hex = SHA512(text).toString(encHex); break;
            case 'BLAKE2b': hex = blake2bHex(text); break;
            case 'BLAKE2s': hex = blake2sHex(text); break;
            default: hex = ''; break;
          }
          const bytes = decodeHex(hex);
          base64 = encodeBase64(bytes);
          base32 = encodeBase32(bytes);
          base85 = encodeBase85(bytes);
          nextResults[alg] = { hex, base64, base32, base85 };
        }
        // Yield back to event loop to avoid blocking on large input
        // eslint-disable-next-line no-await-in-loop
        await new Promise(r => setTimeout(r, 0));
      }
      setResults(nextResults);
    } catch (e) {
      setError('Failed to compute hashes: ' + e.message);
    } finally {
      setIsComputing(false);
    }
  };

  // Debounce input changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { computeAll(input); }, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [input]);

  const clearAll = () => { setInput(''); setResults({}); setError(''); };

  return (
    <div className="tool-container">
      <div className="tool-content">
        <h2 className="tool-title">Hashes</h2>
        <p className="text-xs mb-4 text-gray-600 dark:text-gray-400">All operations are local; no data leaves your browser. MD5 is insecure—use only for legacy checks.</p>
        <TextareaWithLineNumbers
          value={input}
          onChange={e=>setInput(e.target.value)}
          placeholder="Type text to hash (auto-computes after 300ms)"
          className="w-full flex font-mono text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded overflow-hidden focus-within:ring-2 focus-within:ring-jwtBlue h-40"
          gutterClassName="bg-gray-50 dark:bg-gray-900/50 text-gray-400 border-r border-gray-200 dark:border-gray-700 p-3 min-w-[2.5rem]"
          textareaClassName="bg-transparent p-3 border-none w-full h-full outline-none"
          spellCheck="false"
        />
        <div className="mt-3 flex items-center gap-2">
          <button onClick={clearAll} className="btn-secondary btn-sm">Clear</button>
          {isComputing && <span className="text-[10px] font-mono text-jwtBlue animate-pulse">computing...</span>}
        </div>
        <div className="mt-4 grid-cards auto-rows-fr">
          {algorithms.map(alg => {
            const r = results[alg];
            return (
              <div key={alg} className="card flex flex-col">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-gray-600 dark:text-gray-300">{alg}</span>
                  {!r && isComputing && <span className="text-[10px] text-gray-400">pending…</span>}
                </div>
                {r ? (
                  <div className="space-y-2 text-[11px] font-mono break-all">
                    <div><span className="font-bold text-gray-500">HEX:</span> {r.hex}</div>
                    <div><span className="font-bold text-gray-500">BASE64:</span> {r.base64}</div>
                    <div><span className="font-bold text-gray-500">BASE32:</span> {r.base32}</div>
                    <div><span className="font-bold text-gray-500">BASE85:</span> {r.base85}</div>
                  </div>
                ) : (
                  <div className="text-[10px] text-gray-400 italic">No data</div>
                )}
              </div>
            );
          })}
        </div>
        {error && <div className="mt-4 p-2 bg-red-100 text-red-700 text-xs rounded font-mono">{error}</div>}
      </div>
    </div>
  );
};

export default HashTool;

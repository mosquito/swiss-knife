import React, { useState, useEffect } from 'react';
import { generateKeysAsync, extractPublicFromPrivateAsync, isPrivateKey } from './utils';

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const b64encode = (bytes) => {
  let bin = ''; for (let i=0;i<bytes.length;i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
};
const b64decode = (str) => {
  const clean = str.replace(/\s+/g,'');
  const bin = atob(clean); const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i);
  return out;
};

const pemToArrayBuffer = (pem) => {
  const b64 = pem.replace(/-----[^-]+-----/g,'').replace(/\s+/g,'');
  const bin = atob(b64); const bytes = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
};

const deriveAesKey = async (passphrase, salt) => {
  const baseKey = await crypto.subtle.importKey('raw', textEncoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name:'PBKDF2', salt, iterations:100000, hash:'SHA-256' }, baseKey, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']);
};

const CryptoTool = () => {
  const [rsaPrivate, setRsaPrivate] = useState('');
  const [rsaPublic, setRsaPublic] = useState('');
  const [rsaMessage, setRsaMessage] = useState('hello');
  const [rsaSignature, setRsaSignature] = useState('');
  const [rsaAlg, setRsaAlg] = useState('RS256'); // RS256 | PS256
  const [rsaResult, setRsaResult] = useState('');
  const [rsaError, setRsaError] = useState('');
  const [rsaGenBusy, setRsaGenBusy] = useState(false);
  const [rsaDerivedStatus, setRsaDerivedStatus] = useState('');

  const [aesMode, setAesMode] = useState('encrypt'); // encrypt | decrypt
  const [aesPass, setAesPass] = useState('password');
  const [aesInput, setAesInput] = useState('Secret message');
  const [aesOutput, setAesOutput] = useState('');
  const [aesError, setAesError] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const rsaMessageRef = React.useRef(rsaMessage);

  const verifySignature = async () => {
    setRsaError(''); setRsaResult('');
    try {
      const algo = rsaAlg === 'PS256' ? { name:'RSA-PSS', hash:'SHA-256' } : { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' };
      const keyBuf = pemToArrayBuffer(rsaPublic);
      const pubKey = await crypto.subtle.importKey('spki', keyBuf, algo, false, ['verify']);
      const sigBytes = b64decode(rsaSignature.trim());
      const dataBytes = textEncoder.encode(rsaMessage);
      const verifyParams = algo.name === 'RSA-PSS' ? { name:'RSA-PSS', saltLength:32 } : algo.name;
      const valid = await crypto.subtle.verify(verifyParams, pubKey, sigBytes, dataBytes);
      setRsaResult(valid ? 'Signature VALID' : 'Signature INVALID');
    } catch (e) { 
      console.error('Verify error:', e);
      setRsaError(e.message || 'Verification failed'); 
    }
  };

  const signMessage = async () => {
    setRsaError(''); setRsaResult('');
    try {
      if (!rsaPrivate || !isPrivateKey(rsaPrivate)) throw new Error('Private key required');
      const algo = rsaAlg === 'PS256' ? { name:'RSA-PSS', hash:'SHA-256' } : { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' };
      const privBuf = pemToArrayBuffer(rsaPrivate);
      const privateKey = await crypto.subtle.importKey('pkcs8', privBuf, algo, false, ['sign']);
      const dataBytes = textEncoder.encode(rsaMessage);
      const signParams = algo.name === 'RSA-PSS' ? { name:'RSA-PSS', saltLength:32 } : algo.name;
      const sigBuf = await crypto.subtle.sign(signParams, privateKey, dataBytes);
      const sigBytes = new Uint8Array(sigBuf);
      setRsaSignature(b64encode(sigBytes));
      setRsaResult('Signature GENERATED');
    } catch (e) { 
      console.error('Sign error:', e);
      setRsaError(e.message || 'Signing failed'); 
    }
  };

  const generateKeyPair = async () => {
    setRsaGenBusy(true); setRsaDerivedStatus('');
    try {
      let privPem;
      if (rsaAlg === 'PS256') {
        // Generate RSA-PSS key directly (WebCrypto does not convert algorithms post-generation)
        const keyPair = await crypto.subtle.generateKey({
          name: 'RSA-PSS',
          modulusLength: 2048,
          publicExponent: new Uint8Array([1,0,1]),
          hash: 'SHA-256'
        }, true, ['sign','verify']);
        const privBuf = await crypto.subtle.exportKey('pkcs8', keyPair.privateKey);
        const pubBuf = await crypto.subtle.exportKey('spki', keyPair.publicKey);
        const toB64 = (buf) => b64encode(new Uint8Array(buf));
        const wrapPem = (b64, type) => {
          let pem = `-----BEGIN ${type}-----\n`; let i=0; while (i < b64.length) { pem += b64.slice(i,i+64) + '\n'; i+=64; } pem += `-----END ${type}-----`; return pem;
        };
        privPem = wrapPem(toB64(privBuf), 'PRIVATE KEY');
        setRsaPrivate(privPem);
        setRsaPublic(wrapPem(toB64(pubBuf), 'PUBLIC KEY'));
        setRsaDerivedStatus('Generated RSA-PSS key pair');
      } else {
        privPem = await generateKeysAsync('RS256');
        setRsaPrivate(privPem);
        const pub = await extractPublicFromPrivateAsync(privPem);
        if (pub) { setRsaPublic(pub); setRsaDerivedStatus('Generated RSA PKCS#1 key pair'); }
      }
    } catch (e) { setRsaError(e.message || 'Generation failed'); }
    setRsaGenBusy(false);
  };

  const derivePublicFromPrivate = async () => {
    if (!rsaPrivate) return;
    if (!isPrivateKey(rsaPrivate)) { setRsaDerivedStatus('Not a private key'); return; }
    setRsaDerivedStatus('Deriving...');
    try {
      const pub = await extractPublicFromPrivateAsync(rsaPrivate);
      if (pub) { setRsaPublic(pub); setRsaDerivedStatus('Public key extracted'); }
      else setRsaDerivedStatus('Extraction failed');
    } catch (e) { setRsaDerivedStatus(e.message || 'Extraction error'); }
  };

  useEffect(() => {
    const t = setTimeout(() => { if (rsaPrivate && isPrivateKey(rsaPrivate)) derivePublicFromPrivate(); }, 400);
    return () => clearTimeout(t);
  }, [rsaPrivate]);

  // Auto-sign after 1s delay when message changes
  useEffect(() => {
    if (rsaMessageRef.current !== rsaMessage) {
      setRsaSignature('');
      setRsaResult('');
      setRsaError('');
    }
    rsaMessageRef.current = rsaMessage;
    
    if (!rsaMessage) return;
    
    // Generate key if not present
    if (!rsaPrivate || !isPrivateKey(rsaPrivate)) {
      generateKeyPair();
      return;
    }
    
    const timer = setTimeout(() => {
      signMessage();
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [rsaMessage, rsaPrivate]);

  const runAes = async () => {
    setAesError(''); setAesOutput('');
    try {
      if (aesMode === 'encrypt') {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const key = await deriveAesKey(aesPass, salt);
        const cipherBuf = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, textEncoder.encode(aesInput));
        const cipherBytes = new Uint8Array(cipherBuf);
        const out = b64encode(salt) + ':' + b64encode(iv) + ':' + b64encode(cipherBytes);
        setAesOutput(out);
      } else {
        const parts = aesInput.trim().split(':');
        if (parts.length !== 3) throw new Error('Expected salt:iv:cipher format');
        const salt = b64decode(parts[0]);
        const iv = b64decode(parts[1]);
        const cipher = b64decode(parts[2]);
        const key = await deriveAesKey(aesPass, salt);
        const plainBuf = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, cipher);
        setAesOutput(textDecoder.decode(plainBuf));
      }
    } catch (e) { setAesError(e.message || 'AES error'); }
  };

  const handleCopy = async (t) => { try { await navigator.clipboard.writeText(t); } catch {} };
  const clearRsa = () => { setRsaSignature(''); setRsaResult(''); setRsaError(''); };
  const clearAes = () => { setAesInput(''); setAesOutput(''); setAesError(''); };

  return (
    <div className="tool-container">
      <div className="tool-content">
          <h2 className="tool-title">Crypto Utils</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Client-side cryptographic operations using Web Crypto API. All operations execute in-browser with no server transmission. Keys are ephemeral unless explicitly exported.
          </p>
          <div className="space-y-3">
          <h3 className="text-sm font-semibold">RSA Sign</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            RSA digital signatures with RSASSA-PKCS1-v1_5 (RS256) and RSA-PSS (PS256) using SHA-256. Supports 2048-bit key generation, public key extraction from private keys, and signature verification.
          </p>
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-sm divide-y divide-gray-200 dark:divide-gray-700">
            <button onClick={()=>setShowKeys(!showKeys)} className="w-full flex items-center justify-between px-3 py-2 text-[11px] font-bold bg-gray-50 dark:bg-gray-700">
              <span>Keys</span>
              <span className="text-[10px] font-mono">{showKeys ? '▲' : '▼'}</span>
            </button>
            {showKeys && (
              <div className="p-3 space-y-2">
                <div className="flex gap-2 mb-1">
                  <button disabled={rsaGenBusy} onClick={generateKeyPair} className="btn-primary btn-sm disabled:opacity-50">{rsaGenBusy ? 'Generating…' : 'Generate Pair'}</button>
                  <button onClick={clearRsa} className="btn-secondary btn-sm">Clear Sig</button>
                </div>
                <textarea value={rsaPrivate} onChange={e=>setRsaPrivate(e.target.value)} spellCheck="false" placeholder="PRIVATE KEY (PKCS#8)" className="w-full h-28 p-2 font-mono text-[11px] bg-transparent border border-gray-200 dark:border-gray-700 rounded resize-none focus:outline-none" />
                <textarea value={rsaPublic} onChange={e=>setRsaPublic(e.target.value)} spellCheck="false" placeholder="PUBLIC KEY" className="w-full h-28 p-2 font-mono text-[11px] bg-transparent border border-gray-200 dark:border-gray-700 rounded resize-none focus:outline-none" />
                {rsaDerivedStatus && <div className="text-[10px] text-gray-500 dark:text-gray-400">{rsaDerivedStatus}</div>}
              </div>
            )}
            <div className="p-3 space-y-3">
              <textarea value={rsaMessage} onChange={e=>setRsaMessage(e.target.value)} spellCheck="false" placeholder="Message to sign / verify" className="w-full h-24 p-2 font-mono text-[11px] bg-transparent border border-gray-200 dark:border-gray-700 rounded resize-none focus:outline-none" />
              <textarea value={rsaSignature} onChange={e=>setRsaSignature(e.target.value)} spellCheck="false" placeholder="Base64 signature" className="w-full h-24 p-2 font-mono text-[11px] bg-transparent border border-gray-200 dark:border-gray-700 rounded resize-none focus:outline-none" />
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <label className="flex items-center gap-1">Alg:
                  <select value={rsaAlg} onChange={e=>setRsaAlg(e.target.value)} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
                    <option value="RS256">RS256</option>
                    <option value="PS256">PS256</option>
                  </select>
                </label>
                {isPrivateKey(rsaPrivate) && <button onClick={signMessage} className="px-3 py-1 rounded bg-green-500 text-white font-semibold hover:opacity-90">Sign</button>}
                <button onClick={verifySignature} className="btn-primary btn-sm">Verify</button>
                <button onClick={()=>handleCopy(rsaSignature)} className="btn-secondary btn-sm">Copy Sig</button>
                {rsaError && <span className="px-2 py-1 rounded bg-red-100 text-red-600 font-semibold">Error</span>}
                {!rsaError && rsaResult && (
                  <span className={`px-2 py-1 rounded font-semibold ${rsaResult.includes('VALID') ? 'bg-green-100 text-green-700' : rsaResult.includes('INVALID') ? 'bg-red-100 text-red-700' : 'bg-gray-200 text-gray-600'}`}>{rsaResult.replace('Signature ','')}</span>
                )}
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-3">
          <h3 className="text-sm font-semibold">AES</h3>
          <p className="text-xs text-gray-600 dark:text-gray-400 mb-2">
            AES-256-GCM authenticated encryption with PBKDF2-HMAC-SHA256 key derivation (100k iterations). Generates cryptographically secure random salts and IVs for each encryption.
          </p>
          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-sm p-3 space-y-3">
            <div className="flex flex-wrap gap-2 text-xs items-center">
              <label className="flex items-center gap-1">Mode:
                <select value={aesMode} onChange={e=>setAesMode(e.target.value)} className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700">
                  <option value="encrypt">Encrypt</option>
                  <option value="decrypt">Decrypt</option>
                </select>
              </label>
              <input type="text" value={aesPass} onChange={e=>setAesPass(e.target.value)} placeholder="Passphrase" className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 text-xs" />
              <button onClick={runAes} className="btn-primary btn-sm">Run</button>
              <button onClick={clearAes} className="btn-secondary btn-sm">Clear</button>
              <button onClick={()=>handleCopy(aesOutput)} className="btn-primary btn-sm">Copy Output</button>
              {aesError && <span className="px-2 py-1 rounded bg-red-100 text-red-600 font-semibold">Error</span>}
              {!aesError && aesOutput && <span className="px-2 py-1 rounded bg-green-100 text-green-700 font-semibold">Done</span>}
            </div>
            <textarea value={aesInput} onChange={e=>setAesInput(e.target.value)} spellCheck="false" placeholder={aesMode==='encrypt'? 'Plaintext to encrypt' : 'salt:iv:cipher'} className="w-full h-28 p-2 font-mono text-[11px] bg-transparent border border-gray-200 dark:border-gray-700 rounded resize-none focus:outline-none" />
            <textarea value={aesOutput} readOnly spellCheck="false" placeholder={aesMode==='encrypt'? 'salt:iv:cipher output here' : 'Decrypted plaintext'} className="w-full h-28 p-2 font-mono text-[11px] bg-transparent border border-gray-200 dark:border-gray-700 rounded resize-none focus:outline-none" />
            <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">Output format: base64(salt):base64(iv):base64(ciphertext)</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CryptoTool;
import React, { useState, useEffect, useRef } from 'react';
import { decodeJWT, signJWT, verifyJWT, generateKeysAsync, isPrivateKey, extractPublicFromPrivateAsync } from './utils';

const CopyIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
);
const CheckIcon = () => (
  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"/></svg>
);

const DEFAULT_HEADER = { alg: 'HS256', typ: 'JWT' };
const DEFAULT_PAYLOAD = { sub: '1234567890', name: 'John Doe', iat: 1516239022 };
const ALGORITHMS = ['HS256','HS384','HS512','RS256','RS384','RS512'];

const JwtTool = () => {
  const [token, setToken] = useState('');
  const [header, setHeader] = useState(DEFAULT_HEADER);
  const [payload, setPayload] = useState(DEFAULT_PAYLOAD);
  const [isVerified, setIsVerified] = useState(false);
  const [keyInput, setKeyInput] = useState('');
  const [derivedPublicKey, setDerivedPublicKey] = useState('');
  const [isGenerating, setIsGenerating] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const isUpdatingJson = useRef(false);
  const isUpdatingToken = useRef(false);
  const currentAlg = header.alg || 'HS256';
  const isHmac = currentAlg.startsWith('HS');
  const isRsa = currentAlg.startsWith('RS');
  const isKeyPrivate = isPrivateKey(keyInput);
  const isEditable = isHmac || (isRsa && isKeyPrivate);

  const applyNewKeys = async (alg) => {
    setIsGenerating(true);
    await new Promise(r => setTimeout(r, 10));
    const newKey = await generateKeysAsync(alg);
    setKeyInput(newKey);
    setIsGenerating(false);
    return newKey;
  };

  const handleCopyPublic = async () => {
    if(!derivedPublicKey) return;
    try { await navigator.clipboard.writeText(derivedPublicKey); setIsCopied(true); setTimeout(()=>setIsCopied(false),2000); } catch { /* ignore copy errors */ }
  };

  useEffect(() => {
    const init = async () => {
      const alg = header.alg || 'HS256';
      const key = await applyNewKeys(alg);
      const initialToken = signJWT(DEFAULT_HEADER, DEFAULT_PAYLOAD, key);
      if(initialToken) setToken(initialToken);
      setIsVerified(true);
    };
    init();
  }, []);

  const handleAlgChange = async (newAlg) => {
    const newHeader = { ...header, alg: newAlg };
    setHeader(newHeader);
    isUpdatingJson.current = true;
    const newKey = await applyNewKeys(newAlg);
    const newToken = signJWT(newHeader, payload, newKey);
    if(newToken) setToken(newToken);
    isUpdatingJson.current = false;
    setIsVerified(true);
  };

  useEffect(() => {
    const runExtraction = async () => {
      if(isRsa && isKeyPrivate){
        const pub = await extractPublicFromPrivateAsync(keyInput);
        setDerivedPublicKey(pub || '');
      } else { setDerivedPublicKey(''); }
    };
    runExtraction();
  }, [keyInput, isRsa, isKeyPrivate]);

  const handleTokenChange = (val) => {
    setToken(val);
    if(isUpdatingJson.current) return;
    isUpdatingToken.current = true;
    const result = decodeJWT(val);
    if(result.valid){
      setHeader(result.header);
      setPayload(result.payload);
      setIsVerified(verifyJWT(val, keyInput, result.header.alg || 'HS256'));
    }
    isUpdatingToken.current = false;
  };

  const handleJsonChange = (type, val) => {
    if(!isEditable) return;
    try {
      const obj = JSON.parse(val);
      if(type==='header') setHeader(obj); else setPayload(obj);
      if(isUpdatingToken.current) return;
      isUpdatingJson.current = true;
      const currentHeader = type==='header'? obj : header;
      const currentPayload = type==='payload'? obj : payload;
      const newToken = signJWT(currentHeader, currentPayload, keyInput);
      if(newToken){ setToken(newToken); setIsVerified(true); }
      isUpdatingJson.current = false;
    } catch(e){}
  };

  useEffect(() => {
    if(!isUpdatingToken.current && token && !isGenerating){
      const newToken = signJWT(header, payload, keyInput);
      if(newToken){ setToken(newToken); setIsVerified(true); }
      else { setIsVerified(verifyJWT(token, keyInput, currentAlg)); }
    }
  }, [keyInput]);

  return (
    <div className="flex flex-col md:flex-row overflow-hidden relative flex-1">
      {isGenerating && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg flex items-center gap-4">
            <div className="w-6 h-6 border-4 border-jwtRed border-t-transparent rounded-full animate-spin"/>
            <span className="font-bold">Generating Keys...</span>
          </div>
        </div>
      )}
      <div className="w-full md:w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
        <div className="p-6 flex flex-col h-full">
          <h2 className="text-lg font-bold mb-4 shrink-0">Encoded</h2>
          <textarea className="flex-1 w-full p-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-inner text-gray-600 dark:text-gray-300 break-all focus:ring-2 focus:ring-jwtRed focus:border-transparent resize-none font-mono text-base" value={token} onChange={(e)=>handleTokenChange(e.target.value)} placeholder="Token will appear here..." spellCheck="false" />
          <div className={`mt-4 p-3 text-center font-bold rounded ${isVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isVerified ? 'Signature Verified' : 'Invalid Signature'}</div>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-900 overflow-y-auto h-full custom-scrollbar">
        <div className="p-6">
          <h2 className="text-lg font-bold mb-4">Decoded</h2>
          <div className="mb-6">
            <div className="text-xs text-gray-500 font-bold mb-2">ALGORITHM:</div>
            <div className="flex flex-wrap gap-2 mb-4">
              {ALGORITHMS.map(alg => (
                <button key={alg} onClick={() => handleAlgChange(alg)} disabled={isGenerating} className={`px-3 py-1.5 text-xs font-bold rounded transition-colors ${currentAlg === alg ? 'bg-jwtRed text-white' : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'} disabled:opacity-50 disabled:cursor-not-allowed border border-gray-300 dark:border-gray-600`}>
                  {alg}
                </button>
              ))}
            </div>
          </div>
          <div className="mb-6">
            <div className="flex justify-between mb-1"><div className="text-xs text-gray-500 font-bold">HEADER:</div>{!isEditable && <span className="text-[10px] text-gray-400 font-bold uppercase">Read Only</span>}</div>
            <textarea readOnly={!isEditable} className={`w-full h-24 bg-white dark:bg-gray-800 border-l-4 border-jwtRed rounded shadow-sm text-jwtRed font-mono text-sm resize-none ${!isEditable ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : ''}`} value={JSON.stringify(header,null,2)} onChange={(e)=>handleJsonChange('header', e.target.value)} spellCheck="false" />
          </div>
          <div className="mb-6">
            <div className="flex justify-between mb-1"><div className="text-xs text-gray-500 font-bold">PAYLOAD:</div>{!isEditable && <span className="text-[10px] text-gray-400 font-bold uppercase">Read Only</span>}</div>
            <textarea readOnly={!isEditable} className={`w-full h-48 bg-white dark:bg-gray-800 border-l-4 border-jwtPurple rounded shadow-sm text-jwtPurple font-mono text-sm resize-none ${!isEditable ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : ''}`} value={JSON.stringify(payload,null,2)} onChange={(e)=>handleJsonChange('payload', e.target.value)} spellCheck="false" />
          </div>
          <div className="mb-6">
            <div className="flex justify-between items-end mb-1"><div className="text-xs text-gray-500 font-bold">VERIFY SIGNATURE</div><button disabled={isGenerating} onClick={async()=>{ const k = await applyNewKeys(currentAlg); const t = signJWT(header,payload,k); if(t) setToken(t); }} className="text-[10px] bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">Generate New Keys</button></div>
            <div className="bg-white dark:bg-gray-800 border-l-4 border-jwtBlue rounded shadow-sm p-4 font-mono text-sm break-all">
              <div className="text-jwtBlue mb-4 select-none">{currentAlg} (<br/>base64UrlEncode(header)+'.'+base64UrlEncode(payload),<br/><span className="text-gray-500 dark:text-gray-400">{isHmac ? 'your-256-bit-secret' : 'your-private-or-public-key'}</span><br/>)</div>
              <div className={`flex flex-col ${derivedPublicKey ? 'xl:flex-row' : ''} w-full bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 overflow-hidden`}>
                <div className={`relative ${derivedPublicKey ? 'w-full xl:w-1/2' : 'w-full'}`}>
                  <textarea rows={derivedPublicKey ? 6 : 4} value={keyInput} onChange={(e)=>setKeyInput(e.target.value)} placeholder={isHmac ? 'Enter your secret here' : '-----BEGIN PRIVATE OR PUBLIC KEY-----'} className="w-full h-full bg-transparent p-3 text-black dark:text-white focus:outline-none focus:bg-white dark:focus:bg-gray-800 focus:ring-2 focus:ring-jwtBlue font-mono text-xs resize-y" spellCheck="false" />
                </div>
                {derivedPublicKey && (
                  <div className="w-full xl:w-1/2 bg-gray-200 dark:bg-gray-600/50 border-t xl:border-t-0 xl:border-l border-gray-200 dark:border-gray-600 flex flex-col">
                    <div className="flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-500/50 bg-gray-200/50 dark:bg-gray-700/50"><div className="text-[9px] text-gray-500 dark:text-gray-300 uppercase tracking-wider font-bold">Extracted Public Key</div><button onClick={handleCopyPublic} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded hover:bg-blue-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-500" title="Copy Public Key">{isCopied ? <CheckIcon/> : <CopyIcon/>}<span className="text-[9px] font-bold text-gray-700 dark:text-gray-200">{isCopied ? 'Copied' : 'Copy'}</span></button></div>
                    <div className="p-3 text-xs text-gray-600 dark:text-gray-300 font-mono break-all whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-700/30 flex-1">{derivedPublicKey}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JwtTool;

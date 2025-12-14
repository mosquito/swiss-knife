import React, { useState, useEffect, useRef } from 'react';
import TextareaWithLineNumbers from './TextareaWithLineNumbers';
import { decodeJWT, signJWT, verifyJWT, generateKeysAsync, isPrivateKey, extractPublicFromPrivateAsync } from './utils';
import HistoryList from './HistoryList';

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
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedHeader, setCopiedHeader] = useState(false);
  const [copiedPayload, setCopiedPayload] = useState(false);
  const [headerText, setHeaderText] = useState(JSON.stringify(DEFAULT_HEADER, null, 2));
  const [payloadText, setPayloadText] = useState(JSON.stringify(DEFAULT_PAYLOAD, null, 2));
  const [decodeResult, setDecodeResult] = useState({ headerError: null, payloadError: null, headerRaw: null, payloadRaw: null });
  const [tokenUpdating, setTokenUpdating] = useState(false);
  const [showPayloadHistory, setShowPayloadHistory] = useState(false);
  const [payloadForHistory, setPayloadForHistory] = useState(null);
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

  const handleCopyToken = async () => {
    try { await navigator.clipboard.writeText(token); setCopiedToken(true); setTimeout(()=>setCopiedToken(false),2000); } catch { /* ignore copy errors */ }
  };

  const handleCopyHeader = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(header, null, 2)); setCopiedHeader(true); setTimeout(()=>setCopiedHeader(false),2000); } catch { /* ignore copy errors */ }
  };

  const handleCopyPayload = async () => {
    try { await navigator.clipboard.writeText(JSON.stringify(payload, null, 2)); setCopiedPayload(true); setTimeout(()=>setCopiedPayload(false),2000); } catch { /* ignore copy errors */ }
  };

  useEffect(() => {
    const init = async () => {
      const alg = header.alg || 'HS256';
      const key = await applyNewKeys(alg);
      
      // Try to load last payload from history
      let initialPayload = DEFAULT_PAYLOAD;
      try {
        const historyRaw = localStorage.getItem('jwt-payload-history');
        if (historyRaw) {
          const historyArray = JSON.parse(historyRaw);
          if (Array.isArray(historyArray) && historyArray.length > 0) {
            // Use the most recent payload (first item)
            initialPayload = historyArray[0].value;
            setPayload(initialPayload);
            setPayloadText(JSON.stringify(initialPayload, null, 2));
          } else {
            // History is empty, add default payload
            setPayloadForHistory(DEFAULT_PAYLOAD);
          }
        } else {
          // No history exists, add default payload
          setPayloadForHistory(DEFAULT_PAYLOAD);
        }
      } catch {
        // On error, use default and save it
        setPayloadForHistory(DEFAULT_PAYLOAD);
      }
      
      const initialToken = signJWT(DEFAULT_HEADER, initialPayload, key);
      if(initialToken) setToken(initialToken);
      setIsVerified(true);
    };
    init();
  }, []);

  const handleAlgChange = async (newAlg) => {
    const newHeader = { ...header, alg: newAlg };
    setHeader(newHeader);
    setHeaderText(JSON.stringify(newHeader, null, 2));
    isUpdatingJson.current = true;
    const newKey = await applyNewKeys(newAlg);
    const newToken = signJWT(newHeader, payload, newKey);
    if(newToken) {
      setToken(newToken);
      setTokenUpdating(true);
      setTimeout(() => setTokenUpdating(false), 300);
    }
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
    
    // Store decode result for error/raw display
    setDecodeResult({
      headerError: result.headerError,
      payloadError: result.payloadError,
      headerRaw: result.headerRaw,
      payloadRaw: result.payloadRaw
    });
    
    // Always update header and payload, even if partially decoded
    setHeader(result.header || {});
    setPayload(result.payload || {});
    
    // Update text - show raw if available, otherwise reformat valid JSON
    if(result.headerRaw) {
      setHeaderText(result.headerRaw);
    } else {
      setHeaderText(JSON.stringify(result.header || {}, null, 2));
    }
    
    if(result.payloadRaw) {
      setPayloadText(result.payloadRaw);
    } else {
      setPayloadText(JSON.stringify(result.payload || {}, null, 2));
    }
    
    // Verify signature only if token structure is valid
    if(result.valid){
      setIsVerified(verifyJWT(val, keyInput, result.header.alg || 'HS256'));
    } else {
      setIsVerified(false);
    }
    
    isUpdatingToken.current = false;
  };

  const handleJsonTextChange = (type, val) => {
    if(!isEditable) return;
    if(type === 'header') setHeaderText(val);
    else setPayloadText(val);
  };

  const handleJsonBlur = (type) => {
    if(!isEditable) return;
    const val = type === 'header' ? headerText : payloadText;
    try {
      const obj = JSON.parse(val);
      
      if(type==='header') {
        setHeader(obj);
        // Reformat the JSON
        setHeaderText(JSON.stringify(obj, null, 2));
        // Clear header error on successful parse
        setDecodeResult(prev => ({ ...prev, headerError: null, headerRaw: null }));
      } else {
        setPayload(obj);
        // Reformat the JSON
        setPayloadText(JSON.stringify(obj, null, 2));
        // Clear payload error on successful parse
        setDecodeResult(prev => ({ ...prev, payloadError: null, payloadRaw: null }));
        // Save to history
        setPayloadForHistory(obj);
      }
      
      if(isUpdatingToken.current) return;
      isUpdatingJson.current = true;
      const currentHeader = type==='header'? obj : header;
      const currentPayload = type==='payload'? obj : payload;
      const newToken = signJWT(currentHeader, currentPayload, keyInput);
      if(newToken){ 
        setToken(newToken); 
        setIsVerified(true);
        // Trigger animation
        setTokenUpdating(true);
        setTimeout(() => setTokenUpdating(false), 300);
      }
      isUpdatingJson.current = false;
    } catch(e){
      // Invalid JSON - revert to last valid state and reformat
      if(type === 'header') setHeaderText(JSON.stringify(header, null, 2));
      else setPayloadText(JSON.stringify(payload, null, 2));
    }
  };

  const handleRestorePayload = (restoredPayload) => {
    setPayload(restoredPayload);
    setPayloadText(JSON.stringify(restoredPayload, null, 2));
    setDecodeResult(prev => ({ ...prev, payloadError: null, payloadRaw: null }));
    setShowPayloadHistory(false);
    
    if(isUpdatingToken.current) return;
    isUpdatingJson.current = true;
    const newToken = signJWT(header, restoredPayload, keyInput);
    if(newToken){ 
      setToken(newToken); 
      setIsVerified(true);
      setTokenUpdating(true);
      setTimeout(() => setTokenUpdating(false), 300);
    }
    isUpdatingJson.current = false;
  };

  useEffect(() => {
    if(!isUpdatingToken.current && token && !isGenerating){
      const newToken = signJWT(header, payload, keyInput);
      if(newToken){ 
        setToken(newToken); 
        setIsVerified(true);
        setTokenUpdating(true);
        setTimeout(() => setTokenUpdating(false), 300);
      }
      else { setIsVerified(verifyJWT(token, keyInput, currentAlg)); }
    }
  }, [keyInput]);

  return (
    <div className="flex flex-col md:flex-row overflow-hidden relative flex-1 min-h-0">
      {isGenerating && (
        <div className="absolute inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 p-6 rounded shadow-lg flex items-center gap-4">
            <div className="w-6 h-6 border-4 border-jwtRed border-t-transparent rounded-full animate-spin"/>
            <span className="font-bold">Generating Keys...</span>
          </div>
        </div>
      )}
      <div className="w-full md:w-1/2 border-r border-gray-200 dark:border-gray-700 flex flex-col min-h-0">
        <div className="p-6 flex flex-col flex-1 min-h-0">
          <div className="flex justify-between items-center mb-4 shrink-0">
            <h2 className="text-lg font-bold">Encoded</h2>
            <button onClick={handleCopyToken} disabled={!token} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-[10px] font-bold disabled:opacity-50 disabled:cursor-not-allowed" title="Copy Token">
              <span>{copiedToken ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <TextareaWithLineNumbers className={`flex-1 w-full flex bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-inner text-gray-600 dark:text-gray-300 break-all focus-within:ring-2 focus-within:ring-jwtRed focus-within:border-transparent font-mono text-base transition-all min-h-0 overflow-hidden ${tokenUpdating ? 'ring-2 ring-jwtRed scale-[1.01]' : ''}`} gutterClassName="bg-gray-50 dark:bg-gray-900/50 text-gray-400 border-r border-gray-200 dark:border-gray-700 p-4 min-w-[2.5rem]" textareaClassName="bg-transparent p-4 border-none w-full h-full outline-none break-all" value={token} onChange={(e)=>handleTokenChange(e.target.value)} placeholder="Token will appear here..." spellCheck="false" />
          <div className={`mt-4 p-3 text-center font-bold rounded shrink-0 ${isVerified ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{isVerified ? 'Signature Verified' : 'Invalid Signature'}</div>
        </div>
      </div>
      <div className="w-full md:w-1/2 bg-gray-100 dark:bg-gray-900 overflow-y-auto custom-scrollbar min-h-0">
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
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-500 font-bold">HEADER:</div>
              <div className="flex items-center gap-2">
                <button onClick={handleCopyHeader} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-[10px] font-bold" title="Copy Header">
                  <span>{copiedHeader ? 'Copied' : 'Copy'}</span>
                </button>
                {!isEditable && <span className="text-[10px] text-gray-400 font-bold uppercase">Read Only</span>}
              </div>
            </div>
            <TextareaWithLineNumbers readOnly={!isEditable} className={`w-full h-24 flex bg-white dark:bg-gray-800 border-l-4 border-jwtRed rounded shadow-sm text-jwtRed font-mono text-sm overflow-hidden ${!isEditable ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : ''}`} gutterClassName="bg-gray-50 dark:bg-gray-900/50 text-gray-400 border-r border-gray-200 dark:border-gray-700 p-2 min-w-[2.5rem]" textareaClassName="bg-transparent p-2 border-none w-full h-full outline-none" value={headerText} onChange={(e)=>handleJsonTextChange('header', e.target.value)} onBlur={()=>handleJsonBlur('header')} spellCheck="false" />
            {decodeResult.headerError && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-bold">
                ⚠ {decodeResult.headerError}
              </div>
            )}
          </div>
          <div className="mb-6">
            <div className="flex justify-between items-center mb-1">
              <div className="text-xs text-gray-500 font-bold">PAYLOAD:</div>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPayloadHistory(true)} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-[10px] font-bold" title="View History">
                  <span>History</span>
                </button>
                <button onClick={handleCopyPayload} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded hover:bg-gray-200 dark:hover:bg-gray-600 border border-gray-300 dark:border-gray-600 text-[10px] font-bold" title="Copy Payload">
                  <span>{copiedPayload ? 'Copied' : 'Copy'}</span>
                </button>
                {!isEditable && <span className="text-[10px] text-gray-400 font-bold uppercase">Read Only</span>}
              </div>
            </div>
            <TextareaWithLineNumbers readOnly={!isEditable} className={`w-full h-48 flex bg-white dark:bg-gray-800 border-l-4 border-jwtPurple rounded shadow-sm text-jwtPurple font-mono text-sm overflow-hidden ${!isEditable ? 'opacity-50 cursor-not-allowed bg-gray-50 dark:bg-gray-800/50' : ''}`} gutterClassName="bg-gray-50 dark:bg-gray-900/50 text-gray-400 border-r border-gray-200 dark:border-gray-700 p-2 min-w-[2.5rem]" textareaClassName="bg-transparent p-2 border-none w-full h-full outline-none" value={payloadText} onChange={(e)=>handleJsonTextChange('payload', e.target.value)} onBlur={()=>handleJsonBlur('payload')} spellCheck="false" />
            {decodeResult.payloadError && (
              <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-bold">
                ⚠ {decodeResult.payloadError}
              </div>
            )}
          </div>
          <div className="mb-6">
            <div className="flex justify-between items-end mb-1"><div className="text-xs text-gray-500 font-bold">VERIFY SIGNATURE</div><button disabled={isGenerating} onClick={async()=>{ const k = await applyNewKeys(currentAlg); const t = signJWT(header,payload,k); if(t) setToken(t); }} className="text-[10px] bg-gray-200 dark:bg-gray-700 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50">Generate New Keys</button></div>
            <div className="bg-white dark:bg-gray-800 border-l-4 border-jwtBlue rounded shadow-sm p-4 font-mono text-sm break-all">
              <div className="text-jwtBlue mb-4 select-none">{currentAlg} (<br/>base64UrlEncode(header)+'.'+base64UrlEncode(payload),<br/><span className="text-gray-500 dark:text-gray-400">{isHmac ? 'your-256-bit-secret' : 'your-private-or-public-key'}</span><br/>)</div>
              <div className={`flex flex-col ${derivedPublicKey ? 'xl:flex-row' : ''} w-full bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 overflow-hidden`}>
                <div className={`relative ${derivedPublicKey ? 'w-full xl:w-1/2' : 'w-full'}`}>
                  <TextareaWithLineNumbers rows={derivedPublicKey ? 6 : 4} value={keyInput} onChange={(e)=>setKeyInput(e.target.value)} placeholder={isHmac ? 'Enter your secret here' : '-----BEGIN PRIVATE OR PUBLIC KEY-----'} className="w-full h-full flex bg-transparent text-black dark:text-white focus-within:bg-white dark:focus-within:bg-gray-800 focus-within:ring-2 focus-within:ring-jwtBlue font-mono text-xs overflow-hidden" gutterClassName="bg-gray-50 dark:bg-gray-900/50 text-gray-400 border-r border-gray-200 dark:border-gray-700 p-3 min-w-[2.5rem]" textareaClassName="bg-transparent p-3 border-none w-full h-full outline-none" spellCheck="false" />
                </div>
                {derivedPublicKey && (
                  <div className="w-full xl:w-1/2 bg-gray-200 dark:bg-gray-600/50 border-t xl:border-t-0 xl:border-l border-gray-200 dark:border-gray-600 flex flex-col">
                    <div className="flex justify-between items-center p-2 border-b border-gray-300 dark:border-gray-500/50 bg-gray-200/50 dark:bg-gray-700/50">
                      <div className="text-[9px] text-gray-500 dark:text-gray-300 uppercase tracking-wider font-bold">Extracted Public Key</div>
                      <button onClick={handleCopyPublic} className="flex items-center gap-1 px-2 py-1 bg-white dark:bg-gray-700 rounded hover:bg-blue-50 dark:hover:bg-gray-600 border border-gray-200 dark:border-gray-500" title="Copy Public Key">
                        <span className="text-[9px] font-bold text-gray-700 dark:text-gray-200">{isCopied ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                    <div className="p-3 text-xs text-gray-600 dark:text-gray-300 font-mono break-all whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar bg-gray-50 dark:bg-gray-700/30 flex-1">{derivedPublicKey}</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {showPayloadHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center backdrop-blur-sm" onClick={() => setShowPayloadHistory(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-bold">Payload History</h3>
              <button onClick={() => setShowPayloadHistory(false)} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(80vh-80px)] custom-scrollbar">
              <HistoryList
                storageKey="jwt-payload-history"
                title="Recent Payloads"
                newItem={payloadForHistory}
                max={20}
                dedupeKey={(item) => JSON.stringify(item)}
                renderLabel={(item) => (
                  <span className="font-mono text-xs text-gray-700 dark:text-gray-300">
                    {JSON.stringify(item).length > 100 
                      ? JSON.stringify(item).substring(0, 100) + '...' 
                      : JSON.stringify(item)}
                  </span>
                )}
                onRestore={handleRestorePayload}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default JwtTool;

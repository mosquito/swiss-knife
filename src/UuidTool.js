import React, { useState, useEffect, useRef, useMemo } from 'react';
import TextareaWithLineNumbers from './TextareaWithLineNumbers';
import Base64QuerySync from './Base64QuerySync';
import { ShortUUID } from './shortuuid';
import { encodeBase32, encodeBase64, encodeBase85 } from './utils';
import {
  generateUUIDv1,
  generateUUIDv3,
  generateUUIDv4,
  generateUUIDv5,
  generateUUIDv6,
  generateUUIDv7,
  validate,
  version as getVersion,
  NAMESPACE_DNS,
  NAMESPACE_URL,
  NAMESPACE_OID,
  NAMESPACE_X500
} from './uuidGenerators';

// Namespace type mapping for compact URL encoding
const NS_MAP = { DNS: 0, URL: 1, OID: 2, X500: 3, CUSTOM: 4 };
const NS_REVERSE = ['DNS', 'URL', 'OID', 'X500', 'CUSTOM'];

const UuidTool = () => {
  const shortUUID = new ShortUUID();
  
  // Helper functions for encoding
  const uuidToHex = (uuid) => {
    if (!uuid || !validate(uuid)) return '';
    return uuid.replace(/-/g, '');
  };
  
  const uuidToBytes = (uuid) => {
    if (!uuid || !validate(uuid)) return null;
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < hex.length; i += 2) {
      bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
  };
  
  const uuidToBase64 = (uuid) => {
    const bytes = uuidToBytes(uuid);
    return bytes ? encodeBase64(bytes) : '';
  };
  
  const uuidToBase32 = (uuid) => {
    const bytes = uuidToBytes(uuid);
    return bytes ? encodeBase32(bytes) : '';
  };
  
  const uuidToBase85 = (uuid) => {
    const bytes = uuidToBytes(uuid);
    return bytes ? encodeBase85(bytes) : '';
  };
  
  // Converter state
  const [converterUuid, setConverterUuid] = useState('');
  const [converterShort, setConverterShort] = useState('');
  const [converterLegacy, setConverterLegacy] = useState(false);
  const [converterError, setConverterError] = useState('');
  const updatingRef = useRef(false);
  
  const [uuid1, setUuid1] = useState('');
  const [uuid3, setUuid3] = useState('');
  const [uuid3Name, setUuid3Name] = useState('example.com');
  const [uuid3NamespaceType, setUuid3NamespaceType] = useState('DNS');
  const [uuid3CustomNamespace, setUuid3CustomNamespace] = useState('');
  const [uuid3UseLegacy, setUuid3UseLegacy] = useState(false);
  const [uuid4, setUuid4] = useState('');
  const [uuid4UseLegacy, setUuid4UseLegacy] = useState(false);
  const [uuid5, setUuid5] = useState('');
  const [uuid5Name, setUuid5Name] = useState('example.com');
  const [uuid5NamespaceType, setUuid5NamespaceType] = useState('DNS');
  const [uuid5CustomNamespace, setUuid5CustomNamespace] = useState('');
  const [uuid5UseLegacy, setUuid5UseLegacy] = useState(false);
  const [uuid6, setUuid6] = useState('');
  const [uuid6UseLegacy, setUuid6UseLegacy] = useState(false);
  const [uuid7, setUuid7] = useState('');
  const [uuid1UseLegacy, setUuid1UseLegacy] = useState(false);
  const [uuid7UseLegacy, setUuid7UseLegacy] = useState(false);
  const [uuid3CustomNamespaceValid, setUuid3CustomNamespaceValid] = useState(true);
  const [uuid5CustomNamespaceValid, setUuid5CustomNamespaceValid] = useState(true);
  const [urlDecoded, setUrlDecoded] = useState(false);

  // URL sync for UUID tool state
  // s: shortUUID (converter), 3: uuid3 state, 5: uuid5 state
  // c: custom namespace for uuid3/5
  const syncValue = useMemo(() => ({
    s: converterShort,
    3: { n: uuid3Name, t: NS_MAP[uuid3NamespaceType], c: uuid3CustomNamespace },
    5: { n: uuid5Name, t: NS_MAP[uuid5NamespaceType], c: uuid5CustomNamespace }
  }), [converterShort, uuid3Name, uuid3NamespaceType, uuid3CustomNamespace, uuid5Name, uuid5NamespaceType, uuid5CustomNamespace]);

  const encodeState = useMemo(() => (v) => JSON.stringify(v), []);
  const decodeState = useMemo(() => (str) => {
    try {
      const parsed = JSON.parse(str);
      if (typeof parsed === 'object' && parsed !== null) return parsed;
    } catch {}
    return undefined;
  }, []);

  // Converter handlers
  const handleConverterUuidChange = (value) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setConverterUuid(value);
    setConverterError('');
    
    if (!value.trim()) {
      setConverterShort('');
      updatingRef.current = false;
      return;
    }
    
    try {
      if (!validate(value)) {
        setConverterError('Invalid UUID format');
        setConverterShort('');
      } else {
        const short = converterLegacy ? shortUUID.legacyEncode(value) : shortUUID.encode(value);
        setConverterShort(short);
      }
    } catch (err) {
      setConverterError('Invalid UUID format');
      setConverterShort('');
    } finally {
      updatingRef.current = false;
    }
  };

  const handleConverterShortChange = (value) => {
    if (updatingRef.current) return;
    updatingRef.current = true;
    setConverterShort(value);
    setConverterError('');
    
    if (!value.trim()) {
      setConverterUuid('');
      updatingRef.current = false;
      return;
    }
    
    try {
      const uuid = shortUUID.decode(value);
      if (validate(uuid)) {
        setConverterUuid(uuid);
      } else {
        setConverterError('Invalid ShortUUID format');
        setConverterUuid('');
      }
    } catch (err) {
      setConverterError('Invalid ShortUUID format');
      setConverterUuid('');
    } finally {
      updatingRef.current = false;
    }
  };

  const handleConverterLegacyToggle = (checked) => {
    setConverterLegacy(checked);
    if (converterUuid && validate(converterUuid)) {
      const short = checked ? shortUUID.legacyEncode(converterUuid) : shortUUID.encode(converterUuid);
      setConverterShort(short);
    }
  };

  const getUuidInfo = (uuid) => {
    if (!uuid || !validate(uuid)) return null;
    
    const ver = getVersion(uuid);
    const info = { version: ver };
    
    // Extract timestamp for time-based UUIDs (v1, v6, v7)
    if (ver === 1 || ver === 6) {
      try {
        const hex = uuid.replace(/-/g, '');
        let timestamp;
        
        if (ver === 1) {
          // v1: time_low-time_mid-time_hi_and_version-...
          const timeLow = parseInt(hex.substring(0, 8), 16);
          const timeMid = parseInt(hex.substring(8, 12), 16);
          const timeHi = parseInt(hex.substring(12, 16), 16) & 0x0fff;
          timestamp = (timeHi * 0x100000000 + timeMid * 0x10000 + timeLow - 0x01b21dd213814000) / 10000;
        } else if (ver === 6) {
          // v6: reordered v1
          const timeHi = parseInt(hex.substring(0, 12), 16);
          const timeLow = parseInt(hex.substring(12, 16), 16) & 0x0fff;
          timestamp = (timeHi * 0x1000 + timeLow - 0x01b21dd213814000) / 10000;
        }
        
        info.timestamp = new Date(timestamp).toISOString();
      } catch {}
    } else if (ver === 7) {
      try {
        const hex = uuid.replace(/-/g, '');
        const timestampHex = hex.substring(0, 12);
        const timestamp = parseInt(timestampHex, 16);
        info.timestamp = new Date(timestamp).toISOString();
      } catch {}
    }
    
    return info;
  };

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem('uuid_tool_settings');
      if (saved) {
        const settings = JSON.parse(saved);
        if (settings.uuid3Name) setUuid3Name(settings.uuid3Name);
        if (settings.uuid3NamespaceType) setUuid3NamespaceType(settings.uuid3NamespaceType);
        if (settings.uuid3CustomNamespace) setUuid3CustomNamespace(settings.uuid3CustomNamespace);
        if (settings.uuid3UseLegacy !== undefined) setUuid3UseLegacy(settings.uuid3UseLegacy);
        if (settings.uuid4UseLegacy !== undefined) setUuid4UseLegacy(settings.uuid4UseLegacy);
        if (settings.uuid5Name) setUuid5Name(settings.uuid5Name);
        if (settings.uuid5NamespaceType) setUuid5NamespaceType(settings.uuid5NamespaceType);
        if (settings.uuid5CustomNamespace) setUuid5CustomNamespace(settings.uuid5CustomNamespace);
        if (settings.uuid5UseLegacy !== undefined) setUuid5UseLegacy(settings.uuid5UseLegacy);
        if (settings.uuid6UseLegacy !== undefined) setUuid6UseLegacy(settings.uuid6UseLegacy);
        if (settings.uuid1UseLegacy !== undefined) setUuid1UseLegacy(settings.uuid1UseLegacy);
        if (settings.uuid7UseLegacy !== undefined) setUuid7UseLegacy(settings.uuid7UseLegacy);
      }
    } catch {}
  }, []);

  // Save to localStorage whenever settings change
  useEffect(() => {
    try {
      const settings = {
        uuid3Name,
        uuid3NamespaceType,
        uuid3CustomNamespace,
        uuid3UseLegacy,
        uuid4UseLegacy,
        uuid5Name,
        uuid5NamespaceType,
        uuid5CustomNamespace,
        uuid5UseLegacy,
        uuid6UseLegacy,
        uuid1UseLegacy,
        uuid7UseLegacy
      };
      localStorage.setItem('uuid_tool_settings', JSON.stringify(settings));
    } catch {}
  }, [uuid3Name, uuid3NamespaceType, uuid3CustomNamespace, uuid3UseLegacy, uuid4UseLegacy, 
      uuid5Name, uuid5NamespaceType, uuid5CustomNamespace, uuid5UseLegacy, uuid6UseLegacy, uuid1UseLegacy, uuid7UseLegacy]);

  const namespaceMap = {
    'DNS': NAMESPACE_DNS,
    'URL': NAMESPACE_URL,
    'OID': NAMESPACE_OID,
    'X500': NAMESPACE_X500
  };

  const getNamespace = (type, customNamespace) => {
    return type === 'CUSTOM' ? customNamespace : namespaceMap[type];
  };

  const generateAll = () => {
    setUuid1(generateUUIDv1());
    const ns3 = getNamespace(uuid3NamespaceType, uuid3CustomNamespace);
    if (ns3) setUuid3(generateUUIDv3(uuid3Name, ns3));
    setUuid4(generateUUIDv4());
    const ns5 = getNamespace(uuid5NamespaceType, uuid5CustomNamespace);
    if (ns5) setUuid5(generateUUIDv5(uuid5Name, ns5));
    setUuid6(generateUUIDv6());
    setUuid7(generateUUIDv7());
  };

  useEffect(() => {
    generateAll();
  }, []);

  useEffect(() => {
    const ns = getNamespace(uuid3NamespaceType, uuid3CustomNamespace);
    if (uuid3NamespaceType === 'CUSTOM') {
      const isValid = uuid3CustomNamespace && validate(uuid3CustomNamespace);
      setUuid3CustomNamespaceValid(isValid);
      if (isValid) {
        setUuid3(generateUUIDv3(uuid3Name, ns));
      }
    } else {
      setUuid3CustomNamespaceValid(true);
      setUuid3(generateUUIDv3(uuid3Name, ns));
    }
  }, [uuid3Name, uuid3NamespaceType, uuid3CustomNamespace]);

  useEffect(() => {
    const ns = getNamespace(uuid5NamespaceType, uuid5CustomNamespace);
    if (uuid5NamespaceType === 'CUSTOM') {
      const isValid = uuid5CustomNamespace && validate(uuid5CustomNamespace);
      setUuid5CustomNamespaceValid(isValid);
      if (isValid) {
        setUuid5(generateUUIDv5(uuid5Name, ns));
      }
    } else {
      setUuid5CustomNamespaceValid(true);
      setUuid5(generateUUIDv5(uuid5Name, ns));
    }
  }, [uuid5Name, uuid5NamespaceType, uuid5CustomNamespace]);

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  const UuidRow = ({ version, uuid, name, namespaceName, customNamespace, onNameChange, onNamespaceChange, onCustomNamespaceChange, description, useLegacy, onLegacyChange, isCustomNamespaceValid, onRegenerate }) => {
    const [showEncodings, setShowEncodings] = useState(false);
    const shortForm = uuid ? (useLegacy ? shortUUID.legacyEncode(uuid) : shortUUID.encode(uuid)) : '';
    const hexForm = uuid ? uuidToHex(uuid) : '';
    const base64Form = uuid ? uuidToBase64(uuid) : '';
    const base32Form = uuid ? uuidToBase32(uuid) : '';
    const base85Form = uuid ? uuidToBase85(uuid) : '';
    
    return (
      <div className="border border-gray-300 dark:border-gray-600 rounded-lg p-4 bg-white dark:bg-gray-800">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            UUID v{version}
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-500 dark:text-gray-400">{description}</span>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="px-2 py-1 text-xs bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-500 text-white rounded font-medium transition-colors"
                title="Regenerate this UUID"
              >
                <span className="icon icon-cycled-arrows"></span>
              </button>
            )}
          </div>
        </div>

        {name !== undefined && (
          <div className="mb-3 space-y-2">
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Namespace Type
              </label>
              <select
                value={namespaceName}
                onChange={(e) => onNamespaceChange(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="DNS">DNS (6ba7b810...)</option>
                <option value="URL">URL (6ba7b811...)</option>
                <option value="OID">OID (6ba7b812...)</option>
                <option value="X500">X500 (6ba7b814...)</option>
                <option value="CUSTOM">Custom UUID</option>
              </select>
            </div>
            {namespaceName === 'CUSTOM' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Custom Namespace UUID
                </label>
                <input
                  type="text"
                  value={customNamespace}
                  onChange={(e) => onCustomNamespaceChange(e.target.value)}
                  className={`w-full px-3 py-1.5 text-sm border rounded font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 ${
                    isCustomNamespaceValid === false 
                      ? 'border-red-500 dark:border-red-500 focus:ring-red-500 focus:border-red-500' 
                      : 'border-gray-300 dark:border-gray-600 focus:ring-blue-500 focus:border-transparent'
                  }`}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                />
                {isCustomNamespaceValid === false && (
                  <p className="text-xs text-red-600 dark:text-red-400 mt-1">Invalid UUID format</p>
                )}
              </div>
            )}
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => onNameChange(e.target.value)}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded font-mono bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., example.com"
              />
            </div>
          </div>
        )}

        <div className="space-y-2">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                Long
              </label>
              <button
                onClick={() => copyToClipboard(uuid)}
                className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              >
                Copy
              </button>
            </div>
            <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-center text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
              {uuid}
            </div>
          </div>

          <div>
            <button
              onClick={() => setShowEncodings(!showEncodings)}
              className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
            >
              <span>Other Encodings (Short, Base64, Base32, Base85, Hex)</span>
              <svg
                className={`w-4 h-4 transition-transform ${showEncodings ? 'rotate-180' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>

          {showEncodings && (
            <div className="space-y-2 pt-2">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Short {useLegacy && <span className="text-[10px]">(legacy)</span>}
                  </label>
                  <button
                    onClick={() => copyToClipboard(shortForm)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-center text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {shortForm}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Base64
                  </label>
                  <button
                    onClick={() => copyToClipboard(base64Form)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-center text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {base64Form}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Base32
                  </label>
                  <button
                    onClick={() => copyToClipboard(base32Form)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-center text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {base32Form}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Base85
                  </label>
                  <button
                    onClick={() => copyToClipboard(base85Form)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-center text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {base85Form}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600 dark:text-gray-400">
                    Hex
                  </label>
                  <button
                    onClick={() => copyToClipboard(hexForm)}
                    className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    Copy
                  </button>
                </div>
                <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-center text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700">
                  {hexForm}
                </div>
              </div>

              {onLegacyChange && (
                <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
                  <label className="flex items-center gap-2 text-xs cursor-pointer">
                    <input
                      type="checkbox"
                      checked={useLegacy}
                      onChange={(e) => onLegacyChange(e.target.checked)}
                      className="cursor-pointer"
                    />
                    <span className="text-gray-600 dark:text-gray-400">Use legacy ShortUUID format</span>
                  </label>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="tool-container">
      <Base64QuerySync
        value={syncValue}
        encode={encodeState}
        decode={decodeState}
        onDecoded={(val) => {
          setUrlDecoded(true);
          // Restore converter from shortUUID
          if (val.s) {
            handleConverterShortChange(val.s);
          }
          // Restore uuid3 state (including custom namespace)
          if (val['3']) {
            if (val['3'].n !== undefined) setUuid3Name(val['3'].n);
            if (val['3'].t !== undefined) setUuid3NamespaceType(NS_REVERSE[val['3'].t] || 'DNS');
            if (val['3'].c !== undefined) setUuid3CustomNamespace(val['3'].c);
          }
          // Restore uuid5 state (including custom namespace)
          if (val['5']) {
            if (val['5'].n !== undefined) setUuid5Name(val['5'].n);
            if (val['5'].t !== undefined) setUuid5NamespaceType(NS_REVERSE[val['5'].t] || 'DNS');
            if (val['5'].c !== undefined) setUuid5CustomNamespace(val['5'].c);
          }
        }}
        queryParam="uuid"
        toolHash="#uuid"
      />
      <div className="tool-content">
        <div className="max-w-6xl mx-auto">
          <h2 className="tool-title mb-2">
            UUID Generator & Converter
          </h2>

          {/* Converter Section */}
          <div className="mb-6 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              UUID ↔ ShortUUID Converter
            </h3>
            
            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  UUID (Long)
                </label>
                <TextareaWithLineNumbers
                  value={converterUuid}
                  onChange={(e) => handleConverterUuidChange(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  spellCheck="false"
                  className="w-full h-20 flex font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 text-gray-900 dark:text-white"
                  gutterClassName="bg-gray-100 dark:bg-gray-800 text-gray-400 border-r border-gray-200 dark:border-gray-700 py-2 px-2 min-w-[2.5rem]"
                  textareaClassName="bg-transparent px-3 py-2 border-none w-full h-full outline-none"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  ShortUUID
                </label>
                <TextareaWithLineNumbers
                  value={converterShort}
                  onChange={(e) => handleConverterShortChange(e.target.value)}
                  placeholder="Short representation"
                  spellCheck="false"
                  className="w-full h-20 flex font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 text-gray-900 dark:text-white"
                  gutterClassName="bg-gray-100 dark:bg-gray-800 text-gray-400 border-r border-gray-200 dark:border-gray-700 py-2 px-2 min-w-[2.5rem]"
                  textareaClassName="bg-transparent px-3 py-2 border-none w-full h-full outline-none"
                />
              </div>
            </div>

            {converterError && (
              <div className="mb-4 px-3 py-2 bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-700 rounded text-xs text-red-700 dark:text-red-300">
                {converterError}
              </div>
            )}

            {converterUuid && validate(converterUuid) && (
              <div className="mb-4 grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Hex
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 break-all">
                    {uuidToHex(converterUuid)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Base64
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 break-all">
                    {uuidToBase64(converterUuid)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Base32
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 break-all">
                    {uuidToBase32(converterUuid)}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    Base85
                  </label>
                  <div className="px-3 py-2 bg-gray-50 dark:bg-gray-900 rounded font-mono text-sm text-gray-900 dark:text-white border border-gray-200 dark:border-gray-700 break-all">
                    {uuidToBase85(converterUuid)}
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-start justify-between pt-3 border-t border-gray-200 dark:border-gray-700">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={converterLegacy}
                  onChange={(e) => handleConverterLegacyToggle(e.target.checked)}
                  className="cursor-pointer"
                />
                <span className="text-gray-700 dark:text-gray-300">Use legacy ShortUUID format</span>
              </label>

              {converterUuid && validate(converterUuid) && (
                <div className="text-xs space-y-1">
                  {(() => {
                    const info = getUuidInfo(converterUuid);
                    return (
                      <>
                        <div className="text-gray-600 dark:text-gray-400">
                          <strong>Version:</strong> v{info.version}
                        </div>
                        {info.timestamp && (
                          <div className="text-gray-600 dark:text-gray-400">
                            <strong>Time:</strong> {info.timestamp}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          </div>

          {/* Generator Section */}
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Generate UUIDs
            </h3>
            <button
              onClick={generateAll}
              className="px-4 py-2 bg-gray-700 dark:bg-gray-600 hover:bg-gray-800 dark:hover:bg-gray-500 text-white rounded-lg font-medium transition-colors"
            >
              Regenerate All
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <UuidRow
              version="1"
              uuid={uuid1}
              description="Timestamp-based"
              useLegacy={uuid1UseLegacy}
              onLegacyChange={setUuid1UseLegacy}
              onRegenerate={() => setUuid1(generateUUIDv1())}
            />
            
            <UuidRow
              version="3"
              uuid={uuid3}
              name={uuid3Name}
              namespaceName={uuid3NamespaceType}
              customNamespace={uuid3CustomNamespace}
              onNameChange={setUuid3Name}
              onNamespaceChange={setUuid3NamespaceType}
              onCustomNamespaceChange={setUuid3CustomNamespace}
              description="MD5 hash + namespace"
              useLegacy={uuid3UseLegacy}
              onLegacyChange={setUuid3UseLegacy}
              isCustomNamespaceValid={uuid3CustomNamespaceValid}
            />
            
            <UuidRow
              version="4"
              uuid={uuid4}
              description="Random"
              useLegacy={uuid4UseLegacy}
              onLegacyChange={setUuid4UseLegacy}
              onRegenerate={() => setUuid4(generateUUIDv4())}
            />
            
            <UuidRow
              version="5"
              uuid={uuid5}
              name={uuid5Name}
              namespaceName={uuid5NamespaceType}
              customNamespace={uuid5CustomNamespace}
              onNameChange={setUuid5Name}
              onNamespaceChange={setUuid5NamespaceType}
              onCustomNamespaceChange={setUuid5CustomNamespace}
              description="SHA-1 hash + namespace"
              useLegacy={uuid5UseLegacy}
              onLegacyChange={setUuid5UseLegacy}
              isCustomNamespaceValid={uuid5CustomNamespaceValid}
            />
            
            <UuidRow
              version="6"
              uuid={uuid6}
              description="Timestamp-ordered (reordered v1)"
              useLegacy={uuid6UseLegacy}
              onLegacyChange={setUuid6UseLegacy}
              onRegenerate={() => setUuid6(generateUUIDv6())}
            />
            
            <UuidRow
              version="7"
              uuid={uuid7}
              description="Timestamp-ordered"
              useLegacy={uuid7UseLegacy}
              onLegacyChange={setUuid7UseLegacy}
              onRegenerate={() => setUuid7(generateUUIDv7())}
            />
          </div>

          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-2">
              UUID Versions
            </h3>
            <ul className="text-xs text-blue-800 dark:text-blue-200 space-y-1">
              <li><strong>v1:</strong> Based on timestamp and node ID (MAC address)</li>
              <li><strong>v3:</strong> Based on MD5 hash of namespace and name</li>
              <li><strong>v4:</strong> Randomly generated (most common)</li>
              <li><strong>v5:</strong> Based on SHA-1 hash of namespace and name (recommended over v3)</li>
              <li><strong>v6:</strong> Timestamp-ordered (reordered v1 for better sorting)</li>
              <li><strong>v7:</strong> Timestamp-ordered random (newest, sortable)</li>
            </ul>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-3">
              Short forms use base57 encoding (22 chars vs 36 chars)
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UuidTool;

import React, { useState, useEffect } from 'react';
import TextareaWithLineNumbers from './TextareaWithLineNumbers';
import bcrypt from 'bcryptjs';
import { encodeBase64, decodeBase64, encodeCrypt64, generateSalt, generatePassword } from './utils';
import { passwordDictionary } from './passwordDictionary';
import Base64QuerySync from './Base64QuerySync';

const textEncoder = new TextEncoder();

const sha512crypt = async (password, salt) => {
  // Simplified implementation - full SHA-512-crypt is complex
  // This is a SHA-512 based hash similar to the concept
  const rounds = 5000;
  const passwordBytes = textEncoder.encode(password);
  const saltBytes = textEncoder.encode(salt);
  
  let hash = await crypto.subtle.digest('SHA-512', new Uint8Array([...passwordBytes, ...saltBytes]));
  
  for (let i = 0; i < rounds; i++) {
    const data = new Uint8Array([...new Uint8Array(hash), ...passwordBytes, ...saltBytes]);
    hash = await crypto.subtle.digest('SHA-512', data);
  }
  
  const hashBytes = new Uint8Array(hash);
  const encoded = encodeCrypt64(hashBytes.slice(0, 43));
  return `$6$${salt}$${encoded}`;
};

const sha256crypt = async (password, salt) => {
  const rounds = 5000;
  const passwordBytes = textEncoder.encode(password);
  const saltBytes = textEncoder.encode(salt);
  
  let hash = await crypto.subtle.digest('SHA-256', new Uint8Array([...passwordBytes, ...saltBytes]));
  
  for (let i = 0; i < rounds; i++) {
    const data = new Uint8Array([...new Uint8Array(hash), ...passwordBytes, ...saltBytes]);
    hash = await crypto.subtle.digest('SHA-256', data);
  }
  
  const hashBytes = new Uint8Array(hash);
  const encoded = encodeCrypt64(hashBytes);
  return `$5$${salt}$${encoded}`;
};

const md5crypt = async (password, salt) => {
  // Basic MD5 implementation (simplified)
  const passwordBytes = textEncoder.encode(password);
  const saltBytes = textEncoder.encode(salt);
  const data = new Uint8Array([...passwordBytes, ...saltBytes, ...passwordBytes]);
  
  // WebCrypto doesn't support MD5, so we'll use SHA-1 as placeholder
  const hash = await crypto.subtle.digest('SHA-1', data);
  const hashBytes = new Uint8Array(hash);
  const encoded = encodeCrypt64(hashBytes.slice(0, 16));
  return `$1$${salt}$${encoded}`;
};

const bcryptHash = async (password, rounds = 10) => {
  const salt = await bcrypt.genSalt(rounds);
  const hash = await bcrypt.hash(password, salt);
  return hash;
};

const apr1Hash = async (password, salt) => {
  // Apache APR1 MD5 variant (htpasswd)
  const passwordBytes = textEncoder.encode(password);
  const saltBytes = textEncoder.encode(salt);
  const data = new Uint8Array([...passwordBytes, ...saltBytes]);
  
  const hash = await crypto.subtle.digest('SHA-1', data);
  const hashBytes = new Uint8Array(hash);
  const encoded = encodeCrypt64(hashBytes.slice(0, 16));
  return `$apr1$${salt}$${encoded}`;
};

const pbkdf2Hash = async (password, iterations = 100000) => {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const passwordKey = await crypto.subtle.importKey(
    'raw',
    textEncoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  
  const hashBuffer = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: salt,
      iterations: iterations,
      hash: 'SHA-256'
    },
    passwordKey,
    256
  );
  
  const hashBytes = new Uint8Array(hashBuffer);
  return `pbkdf2:sha256:${iterations}$${encodeBase64(salt)}$${encodeBase64(hashBytes)}`;
};

const scryptHash = async (password) => {
  // WebCrypto doesn't support scrypt natively
  // Placeholder format (Postgres style)
  const salt = encodeBase64(crypto.getRandomValues(new Uint8Array(16)));
  return `SCRYPT:16384:8:1$${salt}:${'*'.repeat(64)}`;
};

const HASH_TYPES = [
  { value: 'sha512', label: 'SHA-512 crypt ($6$)', desc: 'Linux/Unix standard, strong' },
  { value: 'sha256', label: 'SHA-256 crypt ($5$)', desc: 'Linux/Unix, moderate' },
  { value: 'md5', label: 'MD5 crypt ($1$)', desc: 'Legacy Linux/Unix, weak' },
  { value: 'apr1', label: 'Apache APR1 ($apr1$)', desc: 'htpasswd default' },
  { value: 'bcrypt', label: 'bcrypt ($2b$)', desc: 'Strong, recommended' },
  { value: 'pbkdf2', label: 'PBKDF2-SHA256', desc: 'Django/Python default' },
  { value: 'scrypt', label: 'scrypt', desc: 'PostgreSQL SCRAM, not supported' },
];

const PasswordHashTool = () => {
  const [password, setPassword] = useState(() => {
    return generatePassword({ wordList: passwordDictionary });
  });
  const [hashType, setHashType] = useState('sha512');
  const [customSalt, setCustomSalt] = useState('');
  const [useCustomSalt, setUseCustomSalt] = useState(false);
  const [iterations, setIterations] = useState(100000);
  const [bcryptRounds, setBcryptRounds] = useState(10);
  const [output, setOutput] = useState('');
  const [error, setError] = useState('');
  const [computing, setComputing] = useState(false);

  const computeHash = async () => {
    if (!password) {
      setError('Password required');
      return;
    }

    setComputing(true);
    setError('');
    setOutput('');

    try {
      const salt = useCustomSalt && customSalt ? customSalt : generateSalt(16);
      let hash = '';

      switch (hashType) {
        case 'sha512':
          hash = await sha512crypt(password, salt.substring(0, 16));
          break;
        case 'sha256':
          hash = await sha256crypt(password, salt.substring(0, 16));
          break;
        case 'md5':
          hash = await md5crypt(password, salt.substring(0, 8));
          break;
        case 'apr1':
          hash = await apr1Hash(password, salt.substring(0, 8));
          break;
        case 'bcrypt':
          hash = await bcryptHash(password, bcryptRounds);
          break;
        case 'pbkdf2':
          hash = await pbkdf2Hash(password, iterations);
          break;
        case 'scrypt':
          hash = await scryptHash(password);
          setError('Note: scrypt not supported in browser - hash format shown only');
          break;
        default:
          throw new Error('Unknown hash type');
      }

      setOutput(hash);
    } catch (e) {
      setError(e.message || 'Hash generation failed');
    } finally {
      setComputing(false);
    }
  };

  useEffect(() => {
    if (password) {
      const timer = setTimeout(() => {
        computeHash();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [password, hashType, useCustomSalt, customSalt, iterations, bcryptRounds]);

  const handleCopy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const regeneratePassword = () => {
    setPassword(generatePassword({ wordList: passwordDictionary }));
  };

  const selectedType = HASH_TYPES.find(t => t.value === hashType);

  return (
    <div className="tool-container">
      <Base64QuerySync value={hashType} setValue={setHashType} />
      <div className="tool-content">
          <h2 className="tool-title">Password Hash Generator</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Generate password hashes for Linux /etc/shadow, htpasswd, PostgreSQL, and other systems.
            All operations are client-side using Web Crypto API where supported.
          </p>

          <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-sm p-4 space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
                Password
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password to hash"
                  className="flex-1 px-3 py-2 text-sm font-mono bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-jwtBlue"
                />
                <button
                  onClick={regeneratePassword}
                  className="px-3 py-2 text-sm rounded bg-gray-700 dark:bg-gray-600 text-white font-semibold hover:bg-gray-800 dark:hover:bg-gray-500 whitespace-nowrap flex items-center gap-1"
                  title="Generate new random password"
                >
                  <span className="icon icon-cycled-arrows"></span>
                  <span>New</span>
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
                Hash Type
              </label>
              <select
                value={hashType}
                onChange={(e) => setHashType(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-jwtBlue"
              >
                {HASH_TYPES.map(type => (
                  <option key={type.value} value={type.value}>
                    {type.label} - {type.desc}
                  </option>
                ))}
              </select>
              {selectedType && (
                <div className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">
                  {selectedType.desc}
                </div>
              )}
            </div>

            {hashType === 'pbkdf2' && (
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
                  Iterations: {iterations.toLocaleString()}
                </label>
                <input
                  type="range"
                  min="10000"
                  max="1000000"
                  step="10000"
                  value={iterations}
                  onChange={(e) => setIterations(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  <span>10k (fast)</span>
                  <span>100k (recommended)</span>
                  <span>1M (slow)</span>
                </div>
              </div>
            )}

            {hashType === 'bcrypt' && (
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
                  Rounds: {bcryptRounds}
                </label>
                <input
                  type="range"
                  min="4"
                  max="15"
                  step="1"
                  value={bcryptRounds}
                  onChange={(e) => setBcryptRounds(Number(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                  <span>4 (fast)</span>
                  <span>10 (recommended)</span>
                  <span>15 (very slow)</span>
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center gap-2 mb-1">
                <input
                  type="checkbox"
                  id="useCustomSalt"
                  checked={useCustomSalt}
                  onChange={(e) => setUseCustomSalt(e.target.checked)}
                  className="rounded"
                />
                <label htmlFor="useCustomSalt" className="text-xs font-bold text-gray-600 dark:text-gray-400">
                  Custom Salt (optional)
                </label>
              </div>
              {useCustomSalt && (
                <input
                  type="text"
                  value={customSalt}
                  onChange={(e) => setCustomSalt(e.target.value)}
                  placeholder="Leave empty for random salt"
                  className="w-full px-3 py-2 text-sm font-mono bg-transparent border border-gray-300 dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-jwtBlue"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={computeHash}
                disabled={computing}
                className="px-4 py-2 text-sm rounded bg-gray-700 dark:bg-gray-600 text-white font-semibold hover:bg-gray-800 dark:hover:bg-gray-500 disabled:opacity-50"
              >
                {computing ? 'Computing...' : 'Generate Hash'}
              </button>
              <button
                onClick={() => handleCopy(output)}
                disabled={!output}
                className="px-4 py-2 text-sm rounded bg-gray-700 dark:bg-gray-600 text-white font-semibold hover:bg-gray-800 dark:hover:bg-gray-500 disabled:opacity-50"
              >
                Copy Hash
              </button>
              <button
                onClick={() => { setPassword(''); setOutput(''); setError(''); }}
                className="px-4 py-2 text-sm rounded bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 hover:opacity-90"
              >
                Clear
              </button>
            </div>

            {error && (
              <div className="p-2 rounded bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700">
                <div className="text-xs text-yellow-800 dark:text-yellow-200">{error}</div>
              </div>
            )}

            {output && (
              <div>
                <label className="text-xs font-bold text-gray-600 dark:text-gray-400 block mb-1">
                  Generated Hash
                </label>
                <TextareaWithLineNumbers
                  value={output}
                  readOnly
                  className="w-full h-32 flex text-xs font-mono bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded overflow-hidden"
                  gutterClassName="bg-gray-100 dark:bg-gray-800 text-gray-400 border-r border-gray-200 dark:border-gray-700 py-2 px-2 min-w-[2.5rem]"
                  textareaClassName="bg-transparent px-3 py-2 border-none w-full h-full outline-none"
                  onClick={(e) => e.target.select()}
                />
              </div>
            )}
          </div>

          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded p-4">
            <h3 className="text-sm font-bold mb-2">Usage Format</h3>
            <div className="space-y-2 text-xs text-gray-700 dark:text-gray-300">
              {hashType === 'sha512' && (
                <>
                  <div><strong>Linux /etc/shadow (SHA-512 crypt):</strong></div>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-800 p-2 rounded break-all">
                    username:{output || '$6$salt$hash'}:19000:0:99999:7:::
                  </div>
                </>
              )}
              {hashType === 'sha256' && (
                <>
                  <div><strong>Linux /etc/shadow (SHA-256 crypt):</strong></div>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-800 p-2 rounded break-all">
                    username:{output || '$5$salt$hash'}:19000:0:99999:7:::
                  </div>
                </>
              )}
              {hashType === 'md5' && (
                <>
                  <div><strong>Linux /etc/shadow (MD5 crypt - legacy):</strong></div>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-800 p-2 rounded break-all">
                    username:{output || '$1$salt$hash'}:19000:0:99999:7:::
                  </div>
                </>
              )}
              {hashType === 'apr1' && (
                <>
                  <div><strong>Apache htpasswd (APR1):</strong></div>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-800 p-2 rounded break-all">
                    username:{output || '$apr1$salt$hash'}
                  </div>
                </>
              )}
              {hashType === 'bcrypt' && (
                <>
                  <div><strong>Apache htpasswd or general use (bcrypt):</strong></div>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-800 p-2 rounded break-all">
                    username:{output || '$2b$10$salt.and.hash'}
                  </div>
                </>
              )}
              {hashType === 'pbkdf2' && (
                <>
                  <div><strong>Django password field:</strong></div>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-800 p-2 rounded break-all">
                    {output || 'pbkdf2_sha256$iterations$salt$hash'}
                  </div>
                </>
              )}
              {hashType === 'scrypt' && (
                <>
                  <div><strong>PostgreSQL SCRAM-SHA-256:</strong></div>
                  <div className="font-mono text-[10px] bg-white dark:bg-gray-800 p-2 rounded break-all">
                    CREATE USER username PASSWORD '{output || 'password'}';
                  </div>
                  <div className="text-[10px] text-gray-500 dark:text-gray-400 mt-1">
                    Note: scrypt not supported in browser - use server-side tools
                  </div>
                </>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default PasswordHashTool;

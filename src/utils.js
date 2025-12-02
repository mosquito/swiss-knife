import KJUR, { KEYUTIL } from 'jsrsasign';
import baseX from 'base-x';

// --- Base Encoding/Decoding ---
export const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export const BASE85_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!#$%&()*+-;<=>?@^_`{|}~';

const base32Encoder = baseX(BASE32_ALPHABET);
const base85Encoder = baseX(BASE85_ALPHABET);

export const encodeBase32 = (bytes) => base32Encoder.encode(bytes);
export const decodeBase32 = (str) => base32Encoder.decode(str.replace(/=+$/,'').toUpperCase());

export const encodeBase85 = (bytes) => base85Encoder.encode(bytes);
export const decodeBase85 = (str) => base85Encoder.decode(str.trim());

export const encodeBase64 = (bytes) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};
export const decodeBase64 = (b64) => {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
};

export const encodeHex = (bytes) => {
  let out = '';
  for (let i = 0; i < bytes.length; i++) out += bytes[i].toString(16).padStart(2, '0');
  return out;
};
export const decodeHex = (hex) => {
  const clean = hex.trim();
  if (clean.length % 2 !== 0) throw new Error('Invalid hex length');
  const bytes = new Uint8Array(clean.length / 2);
  for (let i = 0; i < clean.length; i += 2) {
    const byte = parseInt(clean.slice(i, i + 2), 16);
    if (isNaN(byte)) throw new Error('Invalid hex character');
    bytes[i / 2] = byte;
  }
  return bytes;
};

// --- Crypt-style Base64 (for password hashing) ---
export const CRYPT64_ALPHABET = './0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export const encodeCrypt64 = (bytes) => {
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const val = (b1 << 16) | (b2 << 8) | b3;
    result += CRYPT64_ALPHABET[(val >> 18) & 0x3f];
    result += CRYPT64_ALPHABET[(val >> 12) & 0x3f];
    result += CRYPT64_ALPHABET[(val >> 6) & 0x3f];
    result += CRYPT64_ALPHABET[val & 0x3f];
  }
  return result.substring(0, Math.ceil(bytes.length * 4 / 3));
};

export const generateSalt = (length = 16) => {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return encodeCrypt64(bytes).substring(0, length);
};

export const generatePassword = (options = {}) => {
  // Load config from localStorage if not explicitly provided
  let config = { ...options };
  if (!options.wordList) {
    try {
      const raw = localStorage.getItem('password_generator_toggles');
      const stored = raw ? JSON.parse(raw) : {};
      config = {
        minWords: options.minWords ?? stored.minWords ?? 3,
        maxWords: options.maxWords ?? stored.maxWords ?? 4,
        useNumbers: options.useNumbers ?? stored.useNumbers ?? true,
        useSymbols: options.useSymbols ?? stored.useSymbols ?? true,
        useUpperCase: options.useUpperCase ?? stored.useUpperCase ?? true,
        onlyLowerCase: options.onlyLowerCase ?? stored.onlyLowerCase ?? false,
        urlSafe: options.urlSafe ?? stored.urlSafe ?? false,
        minNumber: options.minNumber ?? stored.minNumber ?? 10,
        maxNumber: options.maxNumber ?? stored.maxNumber ?? 9999,
        separatorsInput: options.separatorsInput ?? stored.separatorsInput ?? '-_.,+@$',
        useMixedSeparators: options.useMixedSeparators ?? stored.useMixedSeparators ?? false,
        wordList: options.wordList
      };
    } catch {
      // If localStorage fails, use defaults
    }
  }

  const {
    wordList,
    minWords = 3,
    maxWords = 4,
    useNumbers = true,
    useSymbols = true,
    useUpperCase = true,
    onlyLowerCase = false,
    urlSafe = false,
    minNumber = 10,
    maxNumber = 9999,
    separatorsInput = '-_.,+@$',
    useMixedSeparators = false
  } = config;

  if (!wordList || wordList.length === 0) {
    throw new Error('wordList is required for password generation');
  }

  const minW = Math.max(2, Math.min(10, minWords));
  const maxW = Math.max(2, Math.min(10, Math.max(minW, maxWords)));
  const numWords = minW + Math.floor(Math.random() * (maxW - minW + 1));
  const words = [];
  
  const separators = [''];
  for (let i = 0; i < separatorsInput.length; i++) {
    const ch = separatorsInput[i];
    if (!separators.includes(ch)) separators.push(ch);
  }
  
  let chosenSeparators = [];
  if (useMixedSeparators && numWords > 1) {
    for (let i = 0; i < numWords - 1; i++) {
      chosenSeparators.push(separators[Math.floor(Math.random() * separators.length)]);
    }
  } else {
    const sep = separators[Math.floor(Math.random() * separators.length)];
    for (let i = 0; i < numWords - 1; i++) {
      chosenSeparators.push(sep);
    }
  }
  
  for (let i = 0; i < numWords; i++) {
    let word = wordList[Math.floor(Math.random() * wordList.length)];
    
    const prevSepIsEmpty = i > 0 && chosenSeparators[i - 1] === '';
    const shouldCapitalize = !onlyLowerCase && (
      (useUpperCase && Math.random() > 0.5) || 
      prevSepIsEmpty
    );
    
    if (shouldCapitalize) {
      word = word.charAt(0).toUpperCase() + word.slice(1);
    }
    
    words.push(word);
  }
  
  const separatorPositions = [];
  let password = '';
  if (useMixedSeparators && words.length > 0) {
    password = words[0];
    for (let i = 1; i < words.length; i++) {
      const sepEach = chosenSeparators[i - 1];
      separatorPositions.push({ index: password.length, sep: sepEach });
      password += sepEach + words[i];
    }
  } else {
    const sep = chosenSeparators.length > 0 ? chosenSeparators[0] : '';
    password = words.join(sep);
    if (sep && words.length > 1) {
      let pos = words[0].length;
      for (let i = 1; i < words.length; i++) {
        separatorPositions.push({ index: pos, sep: sep });
        pos += sep.length + words[i].length;
      }
    }
  }
  
  if (useNumbers && separatorPositions.length > 0) {
    const numMin = Math.max(0, minNumber);
    const numMax = Math.max(numMin, maxNumber);
    const randomNum = numMin + Math.floor(Math.random() * (numMax - numMin + 1));
    const posToReplace = separatorPositions[Math.floor(Math.random() * separatorPositions.length)];
    
    const beforeSep = password.substring(0, posToReplace.index);
    const afterSep = password.substring(posToReplace.index + posToReplace.sep.length);
    password = beforeSep + randomNum + afterSep;
  }
  
  if (useSymbols) {
    const specialChars = urlSafe 
      ? ['-', '_', '.', '~', '+'] 
      : ['!', '@', '#', '$', '%', '&', '*', '+', '=', '?', '-', '_', '.', '~', '^'];
    const specialChar = specialChars[Math.floor(Math.random() * specialChars.length)];
    password += specialChar;
  }
  
  return password;
};

// --- BigInt Base Encoding (for IP addresses) ---
export const encodeBigIntToBase = (bigInt, alphabet) => {
  if (bigInt === 0n) return alphabet[0];
  const base = BigInt(alphabet.length);
  let int = bigInt;
  let result = '';
  while (int > 0n) {
    result = alphabet[Number(int % base)] + result;
    int = int / base;
  }
  return result;
};

export const encodeBigIntToBase32 = (bigInt) => encodeBigIntToBase(bigInt, BASE32_ALPHABET);
export const encodeBigIntToBase64 = (bigInt) => encodeBigIntToBase(bigInt, BASE64_ALPHABET);
export const encodeBigIntToBase85 = (bigInt) => encodeBigIntToBase(bigInt, BASE85_ALPHABET);

// --- Helper: Check if PEM is a Private Key ---
export const isPrivateKey = (pem) => {
    if (!pem || typeof pem !== 'string') return false;
    return pem.includes("PRIVATE KEY");
};

// --- Internal Helper: Convert String to ArrayBuffer ---
const pemToArrayBuffer = (pem) => {
    const b64 = pem.replace(/(-+BEGIN[\s\S]+?-+|-+END[\s\S]+?-+|\s)/g, '');
    const binary = window.atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
};

// --- Internal Helper: ArrayBuffer to Base64 ---
const toBase64 = (buffer) => {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
};

// --- Internal Helper: Base64 to PEM ---
const formatPEM = (b64, type) => {
  const typeStr = type.toUpperCase();
  let pem = `-----BEGIN ${typeStr}-----\n`;
  while (b64.length > 0) {
    pem += b64.substring(0, 64) + '\n';
    b64 = b64.substring(64);
  }
  pem += `-----END ${typeStr}-----`;
  return pem;
};

// --- NEW: Async Public Key Extraction (Web Crypto API) ---
export const extractPublicFromPrivateAsync = async (privateKeyPem) => {
    try {
        // 1. Import the Private Key
        const privKeyBuf = pemToArrayBuffer(privateKeyPem);
        const privKey = await window.crypto.subtle.importKey(
            "pkcs8", 
            privKeyBuf, 
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, 
            true, 
            ["sign"]
        );

        // 2. Export to JWK to get public components (n, e) safely
        const jwk = await window.crypto.subtle.exportKey("jwk", privKey);

        // 3. Re-import as Public Key (Strip private parts)
        const pubKey = await window.crypto.subtle.importKey(
            "jwk",
            { kty: jwk.kty, n: jwk.n, e: jwk.e },
            { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
            true,
            ["verify"]
        );

        // 4. Export as SPKI (Standard Public Key PEM format)
        const spkiBuf = await window.crypto.subtle.exportKey("spki", pubKey);
        return formatPEM(toBase64(spkiBuf), "PUBLIC KEY");
    } catch (e) {
        // This will fail while user is typing an incomplete key, which is expected
        return null;
    }
};

// --- Encoding/Decoding Logic with Lazy Evaluation ---
export const decodeJWT = (token) => {
  // Default result structure
  const result = {
    header: {},
    payload: {},
    valid: false,
    headerError: null,
    payloadError: null,
    formatError: null
  };

  if (!token || typeof token !== 'string' || token.trim() === '') {
    result.formatError = 'Empty token';
    return result;
  }

  // Split by dots - always try to extract parts
  const parts = token.split('.');
  
  // Check format but don't fail completely
  if (parts.length !== 3) {
    result.formatError = `Expected 3 parts (header.payload.signature), found ${parts.length}`;
  }

  // Try to decode header (part 0) if exists
  if (parts[0]) {
    try {
      const decoded = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
      result.header = JSON.parse(decoded);
    } catch (e) {
      // Try to at least show the raw base64 attempt
      try {
        const decoded = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'));
        result.headerError = 'JSON parse failed';
        result.headerRaw = decoded;
        result.header = {};
      } catch {
        result.headerError = 'Base64 decode failed';
        result.header = {};
      }
    }
  }

  // Try to decode payload (part 1) if exists
  if (parts[1]) {
    try {
      const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      result.payload = JSON.parse(decoded);
    } catch (e) {
      // Try to at least show the raw base64 attempt
      try {
        const decoded = atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
        result.payloadError = 'JSON parse failed';
        result.payloadRaw = decoded;
        result.payload = {};
      } catch {
        result.payloadError = 'Base64 decode failed';
        result.payload = {};
      }
    }
  }

  // Token is valid only if we have all 3 parts and both header and payload decoded successfully
  result.valid = parts.length === 3 && 
                 !result.headerError && 
                 !result.payloadError && 
                 !result.formatError;

  return result;
};

export const verifyJWT = (token, secretOrPublicKey, alg) => {
    try {
        if(alg.startsWith('HS')) {
             return KJUR.jws.JWS.verify(token, { utf8: secretOrPublicKey }, [alg]);
        } else {
             return KJUR.jws.JWS.verify(token, secretOrPublicKey, [alg]);
        }
    } catch (e) {
        return false;
    }
};

export const signJWT = (header, payload, secretOrKey) => {
  try {
    const alg = header.alg || 'HS256';
    if (alg.startsWith('RS') && !isPrivateKey(secretOrKey)) return null; 

    const sHeader = JSON.stringify(header);
    const sPayload = JSON.stringify(payload);
    let key;
    
    if (alg.startsWith('HS')) {
        key = { utf8: secretOrKey };
    } else {
        key = secretOrKey; 
    }

    return KJUR.jws.JWS.sign(alg, sHeader, sPayload, key);
  } catch (e) {
    return null;
  }
};

// --- Async Key Generation (Unchanged) ---
export const generateKeysAsync = async (alg) => {
  if (alg.startsWith('HS')) {
    const randomSecret = Array.from(window.crypto.getRandomValues(new Uint8Array(32)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
    return randomSecret; 
  } 
  else if (alg.startsWith('RS')) {
    const keyPair = await window.crypto.subtle.generateKey(
      {
        name: "RSASSA-PKCS1-v1_5",
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: "SHA-256",
      },
      true,
      ["sign", "verify"]
    );
    const privBuf = await window.crypto.subtle.exportKey("pkcs8", keyPair.privateKey);
    return formatPEM(toBase64(privBuf), "PRIVATE KEY");
  }
  return "";
};
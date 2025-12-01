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
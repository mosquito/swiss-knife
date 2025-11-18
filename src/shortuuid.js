/**
 * ShortUUID JavaScript Library
 * A generator library for concise, unambiguous and URL-safe UUIDs.
 *
 * JavaScript port of the Python library shortuuid:
 * https://github.com/skorokithakis/shortuuid
 * this code is a standalone version without dependencies.
 * It provides functions to generate, encode, decode UUIDs,
 *
 * This code is available under the MIT License.
 */

/*
 * MIT License
 *
 * Copyright (c) 2025 Dmitry Orlov
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */


/**
 * Generate a UUID v4 string
 */
function generateUUIDv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Convert UUID string to bytes array
 */
function uuidToBytes(uuid) {
    const hex = uuid.replace(/-/g, '');
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
        bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
    }
    return bytes;
}

/**
 * Convert bytes array to UUID string
 */
function bytesToUuid(bytes) {
    const hex = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
    return [
        hex.substring(0, 8),
        hex.substring(8, 12),
        hex.substring(12, 16),
        hex.substring(16, 20),
        hex.substring(20, 32)
    ].join('-');
}

/**
 * Convert bytes to big integer
 */
function bytesToInt(bytes) {
    let result = 0n;
    for (let i = 0; i < bytes.length; i++) {
        result = (result << 8n) + BigInt(bytes[i]);
    }
    return result;
}

/**
 * Convert big integer to bytes
 */
function intToBytes(num, length = 16) {
    const bytes = new Uint8Array(length);
    let n = num;
    for (let i = length - 1; i >= 0; i--) {
        bytes[i] = Number(n & 0xffn);
        n >>= 8n;
    }
    return bytes;
}

/**
 * Convert integer to string using given alphabet
 */
function intToString(num, alphabet) {
    if (num === 0n) {
        return alphabet[0];
    }

    const base = BigInt(alphabet.length);
    let result = '';
    let n = num;

    while (n > 0n) {
        const remainder = Number(n % base);
        result = alphabet[remainder] + result;
        n = n / base;
    }

    return result;
}

/**
 * Convert string to integer using given alphabet
 */
function stringToInt(str, alphabet) {
    const base = BigInt(alphabet.length);
    let result = 0n;

    for (let i = 0; i < str.length; i++) {
        const char = str[i];
        const value = alphabet.indexOf(char);
        if (value === -1) {
            throw new Error(`Character '${char}' not found in alphabet`);
        }
        result = result * base + BigInt(value);
    }

    return result;
}

/**
 * Generate cryptographically secure random bytes
 */
function getRandomBytes(length) {
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        return crypto.getRandomValues(new Uint8Array(length));
    }

    // Fallback using Math.random (not cryptographically secure)
    const bytes = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
}

/**
 * Default alphabet excluding similar-looking characters
 */
const DEFAULT_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/**
 * Global alphabet for legacy functions
 */
let globalAlphabet = DEFAULT_ALPHABET;

/**
 * ShortUUID class for generating short UUIDs
 */
export class ShortUUID {
    constructor(alphabet = DEFAULT_ALPHABET) {
        this._alphabet = alphabet;
    }

    getAlphabet() {
        return this._alphabet;
    }

    setAlphabet(alphabet) {
        this._alphabet = alphabet;
    }

    uuid() {
        return this.encode(generateUUIDv4());
    }

    encode(uuid) {
        const bytes = uuidToBytes(uuid);
        const num = bytesToInt(bytes);
        return intToString(num, this._alphabet);
    }

    decode(str, legacy = false) {
        let decodeString = str;

        if (legacy) {
            // Legacy format: reverse the string before decoding
            decodeString = str.split('').reverse().join('');
        }

        const num = stringToInt(decodeString, this._alphabet);
        const bytes = intToBytes(num, 16);
        return bytesToUuid(bytes);
    }

    legacyEncode(uuid) {
        // First encode normally, then reverse the string
        const normalEncoded = this.encode(uuid);
        return normalEncoded.split('').reverse().join('');
    }

    random(length = 22) {
        const alphabetLength = this._alphabet.length;
        const bytes = Math.ceil(length * Math.log(alphabetLength) / Math.log(256)) + 1;
        const randomBytes = getRandomBytes(bytes);
        const num = bytesToInt(randomBytes);
        const result = intToString(num, this._alphabet);
        return result.substring(0, length).padStart(length, this._alphabet[0]);
    }
}

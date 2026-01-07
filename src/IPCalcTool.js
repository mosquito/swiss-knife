import React, { useState, useEffect, useRef } from 'react';
import Base64QuerySync from './Base64QuerySync';
import HistoryList from './HistoryList';
import { encodeBigIntToBase32, encodeBigIntToBase64, encodeBigIntToBase85 } from './utils';

// IPv4 and IPv6 Address calculator
// Supports CIDR notation, network/broadcast calculation, NAT64, type detection, etc.

class Address {
  constructor(ip, prefixLength) {
    switch (typeof ip) {
      case 'string':
        this.address = this.toInteger(ip);
        break;
      case 'bigint':
        this.address = ip;
        break;
      case 'number':
        this.address = BigInt(ip);
        break;
      default:
        throw new Error('Invalid IP address format');
    }
    this.prefixLength = BigInt(prefixLength);
  }

  toBinary() {
    return this.address.toString(2).padStart(Number(this.totalBits), '0');
  }

  get broadcastAddress() {
    if (this.prefixLength === this.totalBits) return this;
    return new this.constructor(
      this.address | (~this.prefixToMask(this.prefixLength, this.totalBits) & this.prefixToMask(this.totalBits, this.totalBits)),
      this.prefixLength
    );
  }

  get networkAddress() {
    const mask = this.prefixToMask(this.prefixLength, this.totalBits);
    const networkAddr = this.address & mask;
    return new this.constructor(networkAddr, this.prefixLength);
  }

  get firstAddress() {
    if (this.prefixLength === this.totalBits) return this;
    return new this.constructor(this.networkAddress.address + 1n, this.prefixLength);
  }

  get lastAddress() {
    if (this.prefixLength === this.totalBits) return this;
    return new this.constructor(this.broadcastAddress.address - 1n, this.prefixLength);
  }

  toInteger(ip) {
    throw new Error("Method 'toInteger(ip)' must be implemented.");
  }

  toString() {
    throw new Error("Method 'toString(int)' must be implemented.");
  }

  prefixToMask(prefixLength, totalBits) {
    if (prefixLength === 0) return 0n;
    if (prefixLength === totalBits) return (1n << BigInt(totalBits)) - 1n;
    const shift = BigInt(totalBits - prefixLength);
    return ((1n << BigInt(totalBits)) - 1n) ^ ((1n << shift) - 1n);
  }

  get length() {
    return 1n << (this.totalBits - this.prefixLength);
  }

  get hexId() {
    return '0x' + this.address.toString(16).padStart(Number(this.totalBits / 4n), '0');
  }

  get base85Id() {
    return encodeBigIntToBase85(this.address);
  }

  get base64Id() {
    return encodeBigIntToBase64(this.address);
  }

  get base32Id() {
    return encodeBigIntToBase32(this.address);
  }

  get totalBits() {
    throw new Error("Getter 'totalBits' must be implemented.");
  }

  get arpaFormat() {
    throw new Error("Getter 'getArpaFormat()' must be implemented.");
  }

  get addressTypes() {
    throw new Error("Getter 'addressTypes' must be implemented.");
  }

  get type() {
    for (const [type, start, end] of this.addressTypes) {
      if (start <= this.address && end >= this.address) return type;
    }
    return 'Unknown';
  }

  nat64() {
    throw new Error("Method 'nat64' must be implemented.");
  }
}

class IPv4 extends Address {
  static TYPE_LIST = [
    ['Private', '10.0.0.0', '10.255.255.255'],
    ['Private', '172.16.0.0', '172.31.255.255'],
    ['Private', '192.168.0.0', '192.168.255.255'],
    ['Loopback', '127.0.0.0', '127.255.255.255'],
    ['Link-local', '169.254.0.0', '169.254.255.255'],
    ['Multicast', '224.0.0.0', '239.255.255.255'],
    ['Broadcast', '255.255.255.255', '255.255.255.255'],
    ['Shared Address Space', '100.64.0.0', '100.127.255.255'],
    ['Global Unicast', '0.0.0.0', '223.255.255.255'],
  ].map(([type, start, end]) => [type, IPv4.toBigInt(start), IPv4.toBigInt(end)]);

  get addressTypes() {
    return IPv4.TYPE_LIST;
  }

  get totalBits() {
    return 32n;
  }

  toInteger(ip) {
    return ip.split('.').reduce((int, octet) => int * 256n + BigInt(octet), 0n);
  }

  toString() {
    return [
      Number((this.address >> 24n) & 255n),
      Number((this.address >> 16n) & 255n),
      Number((this.address >> 8n) & 255n),
      Number(this.address & 255n),
    ].join('.');
  }

  get arpaFormat() {
    return this.toString().split('.').reverse().join('.') + '.in-addr.arpa';
  }

  static toBigInt(ip) {
    return ip.split('.').reduce((int, octet) => int * 256n + BigInt(octet), 0n);
  }

  nat64(prefix) {
    const prefixObj = prefix || nat64Prefix;
    const nat64 = new IPv6(prefixObj.address + this.address, prefixObj.prefixLength);
    return `${nat64.toString()}/${nat64.prefixLength}`;
  }

  toBinary() {
    let binary = super.toBinary();
    return binary.match(/.{8}/g).join(' ');
  }
}

class IPv6 extends Address {
  static TYPE_LIST = [
    ['NAT64', '64:ff9b::', '64:ff9b::ffff:ffff'],
    ['Global Unicast', '2000::', '3fff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
    ['Link-local', 'fe80::', 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
    ['Unique Local', 'fc00::', 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
    ['Multicast', 'ff00::', 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
    ['Loopback', '::1', '::1'],
    ['Reserved', '::', '::'],
    ['Reserved', '::ffff:0:0', '::ffff:ffff:ffff'],
    ['Reserved', '4000::', 'ffff:ffff:ffff:ffff:ffff:ffff:ffff:ffff'],
  ].map(([type, start, end]) => [type, IPv6.toBigInt(start), IPv6.toBigInt(end)]);

  get addressTypes() {
    return IPv6.TYPE_LIST;
  }

  get totalBits() {
    return 128n;
  }

  expand(ip) {
    const parts = ip.split('::');
    let head = parts[0].split(':').map((part) => part || '0');
    let tail = parts[1] ? parts[1].split(':').map((part) => part || '0') : [];
    let middle = Array(8 - head.length - tail.length).fill('0');
    return [...head, ...middle, ...tail].join(':');
  }

  compact() {
    let ip = this.toString();
    let parts = ip.split(':');
    let zeroGroups = [];
    let currentGroup = [];

    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '0') {
        currentGroup.push(i);
      } else {
        if (currentGroup.length > 0) {
          zeroGroups.push(currentGroup);
          currentGroup = [];
        }
      }
    }
    if (currentGroup.length > 0) {
      zeroGroups.push(currentGroup);
    }

    let longestGroup = zeroGroups.reduce((longest, group) => (group.length > longest.length ? group : longest), []);

    if (longestGroup.length > 0) {
      parts.splice(longestGroup[0], longestGroup.length, '');
    }

    parts = parts.map((part) => part.replace(/^0{1,3}/, ''));

    let compactedIp = parts.join(':').replace(/:{2,}/, '::');

    if (compactedIp.endsWith(':')) {
      compactedIp += ':';
    }
    return compactedIp;
  }

  toInteger(ip) {
    ip = this.expand(ip);
    return ip.split(':').reduce((int, hextet) => int * 65536n + BigInt(parseInt(hextet, 16)), 0n);
  }

  toString() {
    let hexString = this.address.toString(16).padStart(32, '0');
    let hextets = [];
    for (let i = 0; i < 32; i += 4) {
      hextets.push(hexString.slice(i, i + 4).replace(/^0{1,3}/, '') || '0');
    }
    return hextets.join(':');
  }

  get arpaFormat() {
    let hexString = this.address.toString(16).padStart(32, '0');
    let reversed = hexString.split('').reverse().join('.');
    return `${reversed}.ip6.arpa`;
  }

  get type() {
    const networkAddress = this.networkAddress.address;
    const broadcastAddress = this.broadcastAddress.address;
    for (const [type, start, end] of IPv6.TYPE_LIST) {
      if (networkAddress >= start && broadcastAddress <= end) {
        return type;
      }
    }
    return 'Unknown';
  }

  static toBigInt(ip) {
    const expand = (i) => {
      const parts = i.split('::');
      let head = parts[0].split(':').map((part) => part || '0');
      let tail = parts[1] ? parts[1].split(':').map((part) => part || '0') : [];
      let middle = Array(8 - head.length - tail.length).fill('0');
      return [...head, ...middle, ...tail].join(':');
    };
    ip = expand(ip);
    return ip.split(':').reduce((int, hextet) => int * 65536n + BigInt(parseInt(hextet, 16)), 0n);
  }

  nat64(prefix) {
    const prefixObj = prefix || nat64Prefix;
    if (this.address < prefixObj.address || this.address > prefixObj.broadcastAddress.address) {
      return 'Not applicable';
    }
    const ipv4Address = this.address - prefixObj.address;
    return new IPv4(ipv4Address, 32).toString();
  }

  toBinary() {
    let binary = super.toBinary();
    return binary.match(/.{16}/g).join(' ');
  }
}

const nat64Prefix = new IPv6('64:ff9b::', 96);

function parseIp(input) {
  let [ip, prefixLength] = input.split('/');
  if (!prefixLength) {
    prefixLength = ip.includes(':') ? 64 : 24;
  } else {
    prefixLength = parseInt(prefixLength, 10);
  }

  if (ip.includes(':')) {
    return new IPv6(ip, prefixLength);
  } else if (ip.includes('.')) {
    return new IPv4(ip, prefixLength);
  } else {
    throw new Error('Invalid IP address format');
  }
}

// Base64 query param syncing now handled via Base64QuerySync component.

const IPCalcTool = () => {
  const [input, setInput] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [checkIp, setCheckIp] = useState('');
  const [checkResult, setCheckResult] = useState('');
  const [nat64PrefixInput, setNat64PrefixInput] = useState('64:ff9b::/96');
  const debounceRef = useRef(null);
  const historyAddRef = useRef(null);
  const [copiedField, setCopiedField] = useState('');
  const [hoveredField, setHoveredField] = useState('');
  const paramDecodedRef = useRef(false);
  const [paramDecoded, setParamDecoded] = useState(false);
  const [paramChecked, setParamChecked] = useState(false);
  const [showEncodings, setShowEncodings] = useState(false);

  // Early attempt to decode URL param before any fallback runs
  useEffect(() => {
    try {
      const raw = new URL(window.location.href).searchParams.get('value');
      if (raw) {
        try {
          const decoded = atob(raw);
          if (decoded && /[.:]/.test(decoded)) {
            setInput(decoded);
            setParamDecoded(true);
          }
        } catch {}
      }
    } catch {}
    setParamChecked(true);
  }, []);

  // Fallback to history or default if param absent/invalid
  useEffect(() => {
    if (!paramChecked || paramDecoded) return;
    try {
      const raw = localStorage.getItem('ipcalc_history_v1');
      if (raw) {
        const items = JSON.parse(raw);
        if (Array.isArray(items) && items.length > 0) {
          setInput(items[0].value);
          return;
        }
      }
    } catch {}
    setInput('192.168.1.0/24');
  }, [paramChecked, paramDecoded]);

  const calculate = () => {
    let success = false;
    try {
      const ipObj = parseIp(input.trim());
      
      // Parse NAT64 prefix
      let nat64PrefixObj;
      try {
        nat64PrefixObj = parseIp(nat64PrefixInput.trim());
      } catch {
        nat64PrefixObj = new IPv6('64:ff9b::', 96);
      }

      // Generate colored IP parts
      const coloredAddress = getColoredIP(ipObj);
      const coloredNetwork = getColoredIP(ipObj.networkAddress);
      const coloredBroadcast = getColoredIP(ipObj.broadcastAddress);
      const coloredFirst = getColoredIP(ipObj.firstAddress);
      const coloredLast = getColoredIP(ipObj.lastAddress);

      setResult({
        address: ipObj.toString() + '/' + ipObj.prefixLength,
        coloredAddress,
        type: ipObj.type,
        network: ipObj.networkAddress.toString() + '/' + ipObj.prefixLength,
        coloredNetwork,
        broadcast: ipObj.broadcastAddress.toString() + '/' + ipObj.prefixLength,
        coloredBroadcast,
        networkRange: `${ipObj.networkAddress.toString()} - ${ipObj.broadcastAddress.toString()}`,
        hostRange: `${ipObj.firstAddress.toString()} - ${ipObj.lastAddress.toString()}`,
        coloredHostRange: { first: coloredFirst, last: coloredLast },
        totalIPs: ipObj.length.toString(),
        intId: ipObj.address.toString(),
        hexId: ipObj.hexId,
        base32Id: ipObj.base32Id,
        base64Id: ipObj.base64Id,
        base85Id: ipObj.base85Id,
        arpa: ipObj.arpaFormat,
        nat64: ipObj instanceof IPv4 ? ipObj.nat64(nat64PrefixObj) : ipObj.nat64(nat64PrefixObj),
        binary: ipObj.toBinary(),
        ipObj, // keep reference for subnet check
      });
      setError('');
      success = true;
    } catch (e) {
      setError(e.message || 'Invalid input');
      setResult(null);
    }
    
    // Save to history only after successful validation
    const willSave = success && paramChecked && input.trim() && historyAddRef.current;
    if (willSave) {
      historyAddRef.current(input.trim());
    }
  };

  // Helper to split IP into network (blue) and host (orange) parts
  const getColoredIP = (ipObj) => {
    const prefixLen = Number(ipObj.prefixLength);
    const str = ipObj.toString();
    
    if (ipObj instanceof IPv4) {
      // IPv4: use exact split position logic from old ipcalc
      const octets = [
        (ipObj.address >> 24n & 255n).toString().padStart(3, '0'),
        (ipObj.address >> 16n & 255n).toString().padStart(3, '0'),
        (ipObj.address >> 8n & 255n).toString().padStart(3, '0'),
        (ipObj.address & 255n).toString().padStart(3, '0')
      ];
      const fullStr = octets.join('.');
      
      let splitPos;
      switch (prefixLen) {
        case 32: splitPos = 15; break;
        case 31: splitPos = 14; break;
        case 30: splitPos = 13; break;
        case 29: splitPos = 13; break;
        case 28: splitPos = 13; break;
        case 27: splitPos = 13; break;
        case 26: splitPos = 13; break;
        case 25: splitPos = 11; break;
        case 24: splitPos = 11; break;
        case 23: splitPos = 10; break;
        case 22: splitPos = 10; break;
        case 21: splitPos = 9; break;
        case 20: splitPos = 9; break;
        case 19: splitPos = 9; break;
        case 18: splitPos = 8; break;
        case 17: splitPos = 8; break;
        case 16: splitPos = 8; break;
        case 15: splitPos = 6; break;
        case 14: splitPos = 5; break;
        case 13: splitPos = 5; break;
        case 12: splitPos = 5; break;
        case 11: splitPos = 5; break;
        case 10: splitPos = 5; break;
        case 9: splitPos = 4; break;
        case 8: splitPos = 4; break;
        case 7: splitPos = 2; break;
        case 6: splitPos = 2; break;
        case 5: splitPos = 2; break;
        default: splitPos = 0; break;
      }
      
      return {
        network: fullStr.slice(0, splitPos),
        host: fullStr.slice(splitPos),
        prefix: ipObj.prefixLength.toString()
      };
    } else {
      // IPv6: split by hextets based on prefix
      const hextets = [];
      let hexStr = ipObj.address.toString(16).padStart(32, '0');
      for (let i = 0; i < 32; i += 4) {
        hextets.push(hexStr.slice(i, i + 4));
      }
      
      const networkHextets = Math.floor(prefixLen / 16);
      const bitsInPartialHextet = prefixLen % 16;
      
      let network = '';
      let host = '';
      
      for (let i = 0; i < 8; i++) {
        if (i > 0) {
          if (i <= networkHextets || (i === networkHextets && bitsInPartialHextet === 0)) network += ':';
          else host += ':';
        }
        
        if (i < networkHextets) {
          network += hextets[i];
        } else if (i === networkHextets && bitsInPartialHextet > 0) {
          const chars = Math.ceil(bitsInPartialHextet / 4);
          network += hextets[i].slice(0, chars);
          host += hextets[i].slice(chars);
        } else {
          host += hextets[i];
        }
      }
      
      return {
        network,
        host,
        prefix: ipObj.prefixLength.toString()
      };
    }
  };

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(calculate, 300);
    return () => debounceRef.current && clearTimeout(debounceRef.current);
  }, [input]);

  const handleCheckIp = () => {
    if (!checkIp.trim() || !result) {
      setCheckResult('');
      return;
    }
    try {
      const testIpObj = parseIp(checkIp.trim());
      if (result.ipObj.constructor !== testIpObj.constructor) {
        setCheckResult(<><span className="icon icon-cancel"></span> IP version mismatch</>);
        return;
      }
      const isIn =
        testIpObj.address >= result.ipObj.networkAddress.address &&
        testIpObj.address <= result.ipObj.broadcastAddress.address;
      setCheckResult(isIn ? <><span className="icon icon-ok"></span> {checkIp.trim()} is in the subnet</> : <><span className="icon icon-cancel"></span> {checkIp.trim()} is not in the subnet</>);
    } catch (e) {
      setCheckResult(<><span className="icon icon-cancel"></span> {e.message}</>);
    }
  };

  const copyText = async (text, fieldLabel) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldLabel);
      setTimeout(() => setCopiedField(''), 1500);
    } catch {}
  };

  return (
    <div className="tool-container">
      {/* Constrain width on wide screens */}
      <div className="tool-content">
        {/* Sync IP input with base64 URL query param */}
        <Base64QuerySync
          value={input}
          encode={(v) => (typeof v === 'string' ? v : '')}
          decode={(s) => {
            // Accept plain string for IP (/CIDR) only
            if (typeof s === 'string' && /[.:]/.test(s)) {
              paramDecodedRef.current = true;
              setParamDecoded(true);
              return s;
            }
            return undefined;
          }}
          onDecoded={(v) => setInput(v)}
          queryParam="ip"
          updateOnMount={true}
        />
        <h2 className="tool-title">IP Calculator</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">
          Calculate IPv4 and IPv6 network information. Supports CIDR notation, default prefix lengths (/24 for IPv4, /64
          for IPv6).
        </p>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400">IP Address / CIDR</label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g., 192.168.1.0/24 or 2001:db8::/32"
              className="w-full text-sm font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtBlue"
              spellCheck="false"
            />
            {error && <div className="text-xs text-red-600 font-mono">{error}</div>}
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold text-gray-600 dark:text-gray-400">NAT64 Prefix</label>
            <input
              value={nat64PrefixInput}
              onChange={(e) => setNat64PrefixInput(e.target.value)}
              placeholder="e.g., 64:ff9b::/96"
              className="w-full text-sm font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtPurple"
              spellCheck="false"
            />
          </div>
        </div>

        {result && (
          <div className="card">
            <table className="w-full text-xs font-mono">
              <tbody>
                {[
                  ['Address', result.address, result.coloredAddress],
                  ['Type', result.type, null],
                  ['Network', result.network, result.coloredNetwork],
                  ['Broadcast', result.broadcast, result.coloredBroadcast],
                  ['Total IP Addresses', result.totalIPs],
                  ['Network Range', `${result.ipObj.networkAddress.toString()} - ${result.ipObj.broadcastAddress.toString()}`, null],
                  ['Hosts Range', result.hostRange, result.coloredHostRange],
                  ['ARPA Format', result.arpa, null],
                  ['NAT64', result.nat64, null],
                  ['Binary', result.binary, null],
                ].map(([label, value, colored]) => (
                  <tr key={label} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-4 font-bold text-gray-600 dark:text-gray-400 align-top">{label}</td>
                    <td className="py-2 break-all relative">
                      <button
                        onClick={() => copyText(value, label)}
                        onMouseEnter={() => setHoveredField(label)}
                        onMouseLeave={() => setHoveredField('')}
                        className="text-left w-full hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition relative"
                      >
                        {colored && colored.network !== undefined ? (
                          <>
                            <span className="text-blue-600 dark:text-blue-400">{colored.network}</span>
                            <span className="text-orange-600 dark:text-orange-400">{colored.host}</span>
                            <span className="text-gray-500">/{colored.prefix}</span>
                          </>
                        ) : colored && colored.first ? (
                          <>
                            <span className="text-blue-600 dark:text-blue-400">{colored.first.network}</span>
                            <span className="text-orange-600 dark:text-orange-400">{colored.first.host}</span>
                            <span className="text-gray-500">/{colored.first.prefix}</span>
                            <span> - </span>
                            <span className="text-blue-600 dark:text-blue-400">{colored.last.network}</span>
                            <span className="text-orange-600 dark:text-orange-400">{colored.last.host}</span>
                            <span className="text-gray-500">/{colored.last.prefix}</span>
                          </>
                        ) : (
                          value
                        )}
                        {hoveredField === label && copiedField !== label && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-gray-700 dark:bg-gray-600 text-white px-2 py-1 rounded pointer-events-none">Copy</span>
                        )}
                        {copiedField === label && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-green-600 text-white px-2 py-1 rounded pointer-events-none">Copied!</span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-gray-200 dark:border-gray-700">
                  <td colSpan="2" className="py-2">
                    <button
                      onClick={() => setShowEncodings(!showEncodings)}
                      className="w-full flex items-center justify-between px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded text-sm font-medium text-gray-700 dark:text-gray-300 transition-colors"
                    >
                      <span>Other Encodings (Integer, Hex, Base32, Base64, Base85)</span>
                      <svg
                        className={`w-4 h-4 transition-transform ${showEncodings ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>
                  </td>
                </tr>
                {showEncodings && [
                  ['Integer ID', result.intId, null],
                  ['Hexadecimal ID', result.hexId, null],
                  ['Base 32 ID', result.base32Id, null],
                  ['Base 64 ID', result.base64Id, null],
                  ['Base 85 ID', result.base85Id, null],
                ].map(([label, value, colored]) => (
                  <tr key={label} className="border-b border-gray-200 dark:border-gray-700">
                    <td className="py-2 pr-4 font-bold text-gray-600 dark:text-gray-400 align-top">{label}</td>
                    <td className="py-2 break-all relative">
                      <button
                        onClick={() => copyText(value, label)}
                        onMouseEnter={() => setHoveredField(label)}
                        onMouseLeave={() => setHoveredField('')}
                        className="text-left w-full hover:bg-gray-100 dark:hover:bg-gray-700 px-2 py-1 rounded transition relative"
                      >
                        {value}
                        {hoveredField === label && copiedField !== label && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-gray-700 dark:bg-gray-600 text-white px-2 py-1 rounded pointer-events-none">Copy</span>
                        )}
                        {copiedField === label && (
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] bg-green-600 text-white px-2 py-1 rounded pointer-events-none">Copied!</span>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="text-xs font-bold text-gray-600 dark:text-gray-400 mb-2">Check IP in Subnet</div>
              <div className="flex gap-2">
                <input
                  value={checkIp}
                  onChange={(e) => setCheckIp(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCheckIp()}
                  placeholder="Enter IP to check"
                  className="flex-1 text-xs font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-jwtPurple"
                  spellCheck="false"
                />
                <button
                  onClick={handleCheckIp}
                  className="btn-primary btn-sm"
                >
                  Check
                </button>
              </div>
              {checkResult && <div className="mt-2 text-xs font-mono">{checkResult}</div>}
            </div>
          </div>
        )}

        <HistoryList storageKey="ipcalc_history_v1" newItem={null} dedupeKey={(v) => v}>
          {({ items, clear, deleteAt, restore, add }) => {
            historyAddRef.current = add;
            return (
            <div className="mt-6 w-full">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold text-gray-600 dark:text-gray-400">Calculation History</div>
                <button
                  onClick={clear}
                  className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:opacity-90"
                >
                  Clear
                </button>
              </div>
              {items.length === 0 ? (
                <div className="text-[11px] text-gray-500">No history yet.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {items.map((it, idx) => (
                    <div
                      key={it.ts + '-' + idx}
                      className="group flex items-center max-w-[260px] text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded py-[4px]"
                    >
                      <button
                        aria-label="Restore"
                        onClick={() => { setInput(it.value); restore(it.value, idx); }}
                        className="text-xs px-1 rounded opacity-0 group-hover:opacity-100 transition"
                      >
                        <span className="icon icon-ok"></span>
                      </button>
                      <button
                        onClick={() => { setInput(it.value); restore(it.value, idx); }}
                        className="flex-1 text-left font-mono truncate mx-1 hover:opacity-80 transition"
                        title={it.value}
                      >
                        {it.value}
                      </button>
                      <button
                        aria-label="Delete"
                        onClick={() => deleteAt(idx)}
                        className="text-xs px-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-200 dark:hover:bg-red-800/60 transition"
                      >
                        <span className="icon icon-cancel"></span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
          }}
        </HistoryList>
      </div>
    </div>
  );
};

export default IPCalcTool;

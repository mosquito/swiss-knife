import React, { useState, useEffect } from 'react';
import Base64QuerySync from './Base64QuerySync';

const UNIT_CATEGORIES = {
  storage: {
    name: 'Data Storage',
    baseTypes: ['binary', 'decimal'], // IEC (1024) vs SI (1000)
    units: {
      binary: [
        { id: 'bit', label: 'Bits', multiplier: 1/8 },
        { id: 'B', label: 'Bytes (B)', multiplier: 1 },
        { id: 'KiB', label: 'Kibibytes (KiB)', multiplier: 1024 },
        { id: 'MiB', label: 'Mebibytes (MiB)', multiplier: 1024 ** 2 },
        { id: 'GiB', label: 'Gibibytes (GiB)', multiplier: 1024 ** 3 },
        { id: 'TiB', label: 'Tebibytes (TiB)', multiplier: 1024 ** 4 },
        { id: 'PiB', label: 'Pebibytes (PiB)', multiplier: 1024 ** 5 },
      ],
      decimal: [
        { id: 'bit', label: 'Bits', multiplier: 1/8 },
        { id: 'B', label: 'Bytes (B)', multiplier: 1 },
        { id: 'KB', label: 'Kilobytes (KB)', multiplier: 1000 },
        { id: 'MB', label: 'Megabytes (MB)', multiplier: 1000 ** 2 },
        { id: 'GB', label: 'Gigabytes (GB)', multiplier: 1000 ** 3 },
        { id: 'TB', label: 'Terabytes (TB)', multiplier: 1000 ** 4 },
        { id: 'PB', label: 'Petabytes (PB)', multiplier: 1000 ** 5 },
      ]
    },
    baseUnit: 'bytes'
  },
  temperature: {
    name: 'Temperature',
    units: [
      { id: 'C', label: 'Celsius (°C)' },
      { id: 'F', label: 'Fahrenheit (°F)' },
      { id: 'K', label: 'Kelvin (K)' },
    ],
    convert: (value, fromUnit, toUnit) => {
      // Convert to Celsius first
      let celsius;
      if (fromUnit === 'C') celsius = value;
      else if (fromUnit === 'F') celsius = (value - 32) * 5/9;
      else if (fromUnit === 'K') celsius = value - 273.15;
      
      // Convert from Celsius to target
      if (toUnit === 'C') return celsius;
      if (toUnit === 'F') return celsius * 9/5 + 32;
      if (toUnit === 'K') return celsius + 273.15;
    }
  },
  length: {
    name: 'Length',
    units: [
      { id: 'mm', label: 'Millimeters (mm)', multiplier: 0.001 },
      { id: 'cm', label: 'Centimeters (cm)', multiplier: 0.01 },
      { id: 'm', label: 'Meters (m)', multiplier: 1 },
      { id: 'km', label: 'Kilometers (km)', multiplier: 1000 },
      { id: 'in', label: 'Inches (in)', multiplier: 0.0254 },
      { id: 'ft', label: 'Feet (ft)', multiplier: 0.3048 },
      { id: 'yd', label: 'Yards (yd)', multiplier: 0.9144 },
      { id: 'mi', label: 'Miles (mi)', multiplier: 1609.34 },
    ],
    baseUnit: 'meters'
  },
  weight: {
    name: 'Weight/Mass',
    units: [
      { id: 'mg', label: 'Milligrams (mg)', multiplier: 0.001 },
      { id: 'g', label: 'Grams (g)', multiplier: 1 },
      { id: 'kg', label: 'Kilograms (kg)', multiplier: 1000 },
      { id: 'oz', label: 'Ounces (oz)', multiplier: 28.3495 },
      { id: 'lb', label: 'Pounds (lb)', multiplier: 453.592 },
      { id: 't', label: 'Metric Tons (t)', multiplier: 1000000 },
    ],
    baseUnit: 'grams'
  },
  number: {
    name: 'Number Base',
    units: [
      { id: 'dec', label: 'Decimal (Base 10)' },
      { id: 'hex', label: 'Hexadecimal (Base 16)' },
      { id: 'oct', label: 'Octal (Base 8)' },
      { id: 'bin', label: 'Binary (Base 2)' },
    ],
    convert: (value, fromUnit) => {
      // Parse input based on source base
      let decimalValue;
      if (fromUnit === 'dec') decimalValue = parseInt(value, 10);
      else if (fromUnit === 'hex') decimalValue = parseInt(value, 16);
      else if (fromUnit === 'oct') decimalValue = parseInt(value, 8);
      else if (fromUnit === 'bin') decimalValue = parseInt(value, 2);
      
      // Check if parsing was successful
      if (isNaN(decimalValue)) {
        return {
          dec: '',
          hex: '',
          oct: '',
          bin: '',
        };
      }
      
      return {
        dec: decimalValue.toString(10),
        hex: '0x' + decimalValue.toString(16).toUpperCase(),
        oct: '0o' + decimalValue.toString(8),
        bin: '0b' + decimalValue.toString(2),
      };
    },
    isIntegerOnly: true
  },
  time: {
    name: 'Time',
    units: [
      { id: 'ms', label: 'Milliseconds (ms)', multiplier: 0.001 },
      { id: 's', label: 'Seconds (s)', multiplier: 1 },
      { id: 'min', label: 'Minutes (min)', multiplier: 60 },
      { id: 'h', label: 'Hours (h)', multiplier: 3600 },
      { id: 'd', label: 'Days (d)', multiplier: 86400 },
      { id: 'w', label: 'Weeks (w)', multiplier: 604800 },
    ],
    baseUnit: 'seconds'
  }
};

const ByteConverterTool = () => {
  const [category, setCategory] = useState('storage');
  const [inputValue, setInputValue] = useState('1');
  const [inputUnit, setInputUnit] = useState('MiB');
  const [results, setResults] = useState({});
  const [numberBase, setNumberBase] = useState('dec'); // 'dec', 'bin', 'hex', 'oct' (for number display)
  const [storageBase, setStorageBase] = useState('binary'); // 'binary' (1024) or 'decimal' (1000)

  const currentCategory = UNIT_CATEGORIES[category];
  const UNITS = currentCategory.units?.binary ? currentCategory.units[storageBase] : currentCategory.units;

  // Reset input unit when category changes
  useEffect(() => {
    setInputUnit(UNITS[0].id);
    setResults({});
  }, [category, storageBase]);

  useEffect(() => {
    const value = parseFloat(inputValue);
    if (isNaN(value)) {
      setResults({});
      return;
    }

    // Handle number base conversions separately
    if (category === 'number') {
      if (currentCategory.isIntegerOnly && !Number.isInteger(value)) {
        setResults({});
        return;
      }
      const converted = currentCategory.convert(inputValue, inputUnit);
      setResults(converted);
      return;
    }

    // Handle temperature conversions
    if (currentCategory.convert) {
      const newResults = {};
      UNITS.forEach(unit => {
        newResults[unit.id] = currentCategory.convert(value, inputUnit, unit.id);
      });
      setResults(newResults);
      return;
    }

    // Handle multiplier-based conversions
    if (value < 0 && category !== 'temperature') {
      setResults({});
      return;
    }

    const inputUnitData = UNITS.find(u => u.id === inputUnit);
    if (!inputUnitData) return;

    // Convert input to base unit
    const baseValue = value * inputUnitData.multiplier;

    // Convert to all units
    const newResults = {};
    UNITS.forEach(unit => {
      const converted = baseValue / unit.multiplier;
      newResults[unit.id] = converted;
    });

    setResults(newResults);
  }, [inputValue, inputUnit, category, storageBase]);

  const formatNumber = (num) => {
    if (num === undefined || num === null || isNaN(num)) return '';
    
    // For very large or very small numbers, use exponential notation
    if (num >= 1e15 || (num < 0.000001 && num > 0)) {
      return num.toExponential(6);
    }
    
    // For integers or numbers with few decimals
    if (Number.isInteger(num)) {
      return num.toLocaleString();
    }
    
    // For decimal numbers, show up to 6 significant digits
    const str = num.toString();
    if (str.length > 15) {
      return num.toPrecision(10);
    }
    
    return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
  };

  const formatByteValue = (num, base) => {
    if (num === undefined || num === null || isNaN(num)) return '';
    
    // Only show base representations for whole bytes
    const wholeBytes = Math.floor(num);
    
    if (base === 'dec') return formatNumber(num);
    if (base === 'hex') return wholeBytes > 0 ? '0x' + wholeBytes.toString(16).toUpperCase() : '0x0';
    if (base === 'oct') return wholeBytes > 0 ? '0o' + wholeBytes.toString(8) : '0o0';
    if (base === 'bin') return wholeBytes > 0 ? '0b' + wholeBytes.toString(2) : '0b0';
    return formatNumber(num);
  };

  const formatResult = (value, unitId) => {
    if (category === 'number') {
      return value; // Already formatted by convert function
    }
    
    if (category === 'storage') {
      return formatByteValue(value, numberBase);
    }
    
    return formatNumber(value);
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  // Query string state for sharing
  const qsState = {
    category,
    inputValue,
    inputUnit,
    numberBase,
    storageBase
  };

  return (
    <main className="tool-container">
      <Base64QuerySync
        value={qsState}
        encode={(v) => JSON.stringify(v)}
        decode={(str) => {
          try {
            const parsed = JSON.parse(str);
            return parsed;
          } catch {
            return undefined;
          }
        }}
        onDecoded={(decoded) => {
          if (decoded.category) setCategory(decoded.category);
          if (decoded.inputValue) setInputValue(decoded.inputValue);
          if (decoded.inputUnit) setInputUnit(decoded.inputUnit);
          if (decoded.numberBase) setNumberBase(decoded.numberBase);
          if (decoded.storageBase) setStorageBase(decoded.storageBase);
        }}
        queryParam="bytes"
      />
      <div className="tool-content">
        {/* Header */}
        <div className="card-elevated">
          <h2 className="tool-title mb-2 flex items-center gap-2">
            <span className="icon icon-bidirectional-arrows"></span>
            <span>Units Converter</span>
          </h2>
          <p className="tool-subtitle">
            Convert between different units - storage, temperature, length, weight, number bases, and time
          </p>
        </div>

        {/* Category Selection */}
        <div className="card-elevated">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Category
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
            {Object.entries(UNIT_CATEGORIES).map(([key, cat]) => (
              <button
                key={key}
                onClick={() => setCategory(key)}
                className={`btn ${category === key ? 'btn-primary' : 'btn-secondary'}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Input Section */}
        <div className="card-elevated">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Input
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {/* First row: Value input */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type={category === 'number' ? 'text' : 'number'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={category === 'number' ? 'Enter integer value' : 'Enter value'}
                className="input flex-1"
                step="any"
                min={category === 'temperature' ? undefined : '0'}
              />
              <select
                value={inputUnit}
                onChange={(e) => setInputUnit(e.target.value)}
                className="select w-full sm:w-48"
              >
                {UNITS.map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.label}
                  </option>
                ))}
              </select>
            </div>
            
            {/* Second row: Number base and Storage base selects (only for storage) */}
            {category === 'storage' && (
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="flex-1">
                  <label className="label mb-1">Display Format</label>
                  <select
                    value={numberBase}
                    onChange={(e) => setNumberBase(e.target.value)}
                    className="select w-full"
                  >
                    <option value="dec">Decimal (DEC)</option>
                    <option value="bin">Binary (BIN)</option>
                    <option value="hex">Hexadecimal (HEX)</option>
                    <option value="oct">Octal (OCT)</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="label mb-1">Unit System</label>
                  <select
                    value={storageBase}
                    onChange={(e) => setStorageBase(e.target.value)}
                    className="select w-full"
                  >
                    <option value="binary">Binary - IEC (1024)</option>
                    <option value="decimal">Decimal - SI (1000)</option>
                  </select>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Results Section */}
        {Object.keys(results).length > 0 && (
          <div className="card-elevated">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Converted Values
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {UNITS.map(unit => (
                <div
                  key={unit.id}
                  className={`flex items-center justify-between p-3 rounded-md ${
                    unit.id === inputUnit
                      ? 'bg-jwtBlue/10 border border-jwtBlue dark:border-jwtBlue'
                      : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                  }`}
                >
                  <div className="flex-1">
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {unit.label}
                    </div>
                    <div className="text-xl font-mono text-gray-900 dark:text-gray-100 mt-1 break-all">
                      {formatResult(results[unit.id], unit.id)}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(results[unit.id].toString())}
                    className="btn-secondary btn-sm ml-4"
                    title="Copy to clipboard"
                  >
                    Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reference */}
        {category === 'storage' && (
          <div className="card-elevated">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Quick Reference - {storageBase === 'binary' ? 'Binary (IEC) Units' : 'Decimal (SI) Units'}
            </h3>
            {storageBase === 'binary' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 KiB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,024 Bytes</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 MiB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,024 KiB = 1,048,576 Bytes</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 GiB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,024 MiB = 1,073,741,824 Bytes</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 TiB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,024 GiB = 1,099,511,627,776 Bytes</div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 KB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,000 Bytes</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 MB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,000 KB = 1,000,000 Bytes</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 GB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,000 MB = 1,000,000,000 Bytes</div>
                </div>
                <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                  <div className="font-semibold text-gray-700 dark:text-gray-200">1 TB</div>
                  <div className="text-gray-600 dark:text-gray-400">= 1,000 GB = 1,000,000,000,000 Bytes</div>
                </div>
              </div>
            )}
            <div className="alert-info mt-4">
              <p className="alert-info-text">
                <strong>Note:</strong> {storageBase === 'binary' 
                  ? 'Binary units (KiB, MiB, GiB) use base 1024 and are standard for memory and file systems.' 
                  : 'Decimal units (KB, MB, GB) use base 1000 and are commonly used by storage manufacturers.'}
              </p>
            </div>
          </div>
        )}
        
        {category === 'temperature' && (
          <div className="card-elevated">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Common Temperature Points
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-200">Freezing Point</div>
                <div className="text-gray-600 dark:text-gray-400">0°C = 32°F = 273.15K</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-200">Boiling Point</div>
                <div className="text-gray-600 dark:text-gray-400">100°C = 212°F = 373.15K</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-200">Absolute Zero</div>
                <div className="text-gray-600 dark:text-gray-400">-273.15°C = -459.67°F = 0K</div>
              </div>
            </div>
          </div>
        )}

        {category === 'number' && (
          <div className="card-elevated">
            <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
              Number Base Examples
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-200">255 (Decimal)</div>
                <div className="text-gray-600 dark:text-gray-400">= 0xFF (Hex) = 0o377 (Octal) = 0b11111111 (Binary)</div>
              </div>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
                <div className="font-semibold text-gray-700 dark:text-gray-200">16 (Decimal)</div>
                <div className="text-gray-600 dark:text-gray-400">= 0x10 (Hex) = 0o20 (Octal) = 0b10000 (Binary)</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
};

export default ByteConverterTool;

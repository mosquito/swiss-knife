import React, { useState, useEffect } from 'react';

const UNITS = [
  { id: 'B', label: 'Bytes (B)', multiplier: 1 },
  { id: 'KB', label: 'Kilobytes (KB)', multiplier: 1024 },
  { id: 'MB', label: 'Megabytes (MB)', multiplier: 1024 * 1024 },
  { id: 'GB', label: 'Gigabytes (GB)', multiplier: 1024 * 1024 * 1024 },
  { id: 'TB', label: 'Terabytes (TB)', multiplier: 1024 * 1024 * 1024 * 1024 },
  { id: 'PB', label: 'Petabytes (PB)', multiplier: 1024 * 1024 * 1024 * 1024 * 1024 },
];

const ByteConverterTool = () => {
  const [inputValue, setInputValue] = useState('1');
  const [inputUnit, setInputUnit] = useState('MB');
  const [results, setResults] = useState({});

  useEffect(() => {
    const value = parseFloat(inputValue);
    if (isNaN(value) || value < 0) {
      setResults({});
      return;
    }

    const inputUnitData = UNITS.find(u => u.id === inputUnit);
    if (!inputUnitData) return;

    // Convert input to bytes
    const bytes = value * inputUnitData.multiplier;

    // Convert to all units
    const newResults = {};
    UNITS.forEach(unit => {
      const converted = bytes / unit.multiplier;
      newResults[unit.id] = converted;
    });

    setResults(newResults);
  }, [inputValue, inputUnit]);

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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text).then(() => {
      // Could add a toast notification here
    });
  };

  return (
    <main className="flex-1 overflow-auto bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold mb-2 text-gray-800 dark:text-gray-100">
            💾 Byte Unit Converter
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Convert between different byte units (B, KB, MB, GB, TB, PB)
          </p>
        </div>

        {/* Input Section */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Input
          </h3>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="number"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder="Enter value"
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-jwtBlue focus:border-transparent"
              step="any"
              min="0"
            />
            <select
              value={inputUnit}
              onChange={(e) => setInputUnit(e.target.value)}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:ring-2 focus:ring-jwtBlue focus:border-transparent"
            >
              {UNITS.map(unit => (
                <option key={unit.id} value={unit.id}>
                  {unit.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Results Section */}
        {Object.keys(results).length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
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
                    <div className="font-medium text-gray-700 dark:text-gray-200">
                      {unit.label}
                    </div>
                    <div className="text-xl font-mono text-gray-900 dark:text-gray-100 mt-1">
                      {formatNumber(results[unit.id])}
                    </div>
                  </div>
                  <button
                    onClick={() => copyToClipboard(results[unit.id].toString())}
                    className="ml-4 px-3 py-1 text-sm bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500 rounded transition text-gray-700 dark:text-gray-200"
                    title="Copy to clipboard"
                  >
                    📋 Copy
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Quick Reference */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold mb-4 text-gray-800 dark:text-gray-100">
            Quick Reference
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="font-semibold text-gray-700 dark:text-gray-200">1 KB</div>
              <div className="text-gray-600 dark:text-gray-400">= 1,024 Bytes</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="font-semibold text-gray-700 dark:text-gray-200">1 MB</div>
              <div className="text-gray-600 dark:text-gray-400">= 1,024 KB = 1,048,576 Bytes</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="font-semibold text-gray-700 dark:text-gray-200">1 GB</div>
              <div className="text-gray-600 dark:text-gray-400">= 1,024 MB = 1,073,741,824 Bytes</div>
            </div>
            <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded">
              <div className="font-semibold text-gray-700 dark:text-gray-200">1 TB</div>
              <div className="text-gray-600 dark:text-gray-400">= 1,024 GB = 1,099,511,627,776 Bytes</div>
            </div>
          </div>
          <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Note:</strong> This converter uses binary units (base 1024), which is the standard for computer memory and storage calculations.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
};

export default ByteConverterTool;

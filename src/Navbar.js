import React from 'react';

const tools = [
  { id: 'jwt', label: '🔐 JWT Tool' },
  { id: 'hash', label: '🔣 Hashes' },
  { id: 'encode', label: '🔁 Encode / Decode' },
  { id: 'barcode', label: '🏷️ Barcodes' },
  { id: 'ipcalc', label: '🌐 IP Calc' },
  { id: 'datetime', label: '🕒 Date / Time' },
  { id: 'format', label: '🗃️ Data Format' },
  { id: 'crypto', label: '🛡️ Crypto Utils' },
  { id: 'password', label: '🔑 Password' },
  { id: 'uuid', label: '🆔 UUID' },
  { id: 'wifiqr', label: '📶 WiFi QR' },
  { id: 'bytes', label: '💾 Bytes' },
];

const Navbar = ({ activeTool, onSelect }) => (
  <nav className="flex-none flex items-center justify-between px-4 md:px-6 py-3 bg-white dark:bg-gray-800 shadow border-b border-gray-200 dark:border-gray-700 z-10 md:pl-24">
    <div className="hidden md:flex items-center space-x-3">
      <h1 className="text-lg md:text-xl font-bold tracking-wide">Swiss Knife</h1>
    </div>
    <div className="grid grid-cols-5 gap-1 md:flex md:items-center md:gap-3 w-full md:w-auto pr-4 md:pr-0">
      {tools.map(t => (
        <button
          key={t.id}
          disabled={t.disabled}
          onClick={() => !t.disabled && onSelect(t.id)}
          className={`text-xs md:text-sm px-1 py-0.5 md:px-2 md:py-1 rounded border transition select-none ${
            t.id === activeTool ? 'bg-jwtBlue/10 border-jwtBlue text-jwtBlue font-semibold' : 'bg-gray-100 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-300'
          } ${t.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:bg-gray-200 dark:hover:bg-gray-600'}`}
        >{t.label}</button>
      ))}
    </div>
  </nav>
);

export default Navbar;

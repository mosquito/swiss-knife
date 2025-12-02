import React, { useState, useEffect, useCallback } from 'react';
import './styles.css';
import Navbar from './Navbar';
import JwtTool from './JwtTool';
import HashTool from './HashTool';
import EncodeDecodeTool from './EncodeDecodeTool';
import DateTimeTool from './DateTimeTool';
import DataFormatTool from './DataFormatTool';
import BarcodeTool from './BarcodeTool';
import IPCalcTool from './IPCalcTool';
import DisclaimerFooter from './DisclaimerFooter';
import CryptoTool from './CryptoTool';
import PasswordTool from './PasswordTool';
import PasswordHashTool from './PasswordHashTool';
import UuidTool from './UuidTool';
import WifiQRTool from './WifiQRTool';
import UnitsConverterTool from './UnitsConverterTool';

const App = () => {
  const [activeTool, setActiveTool] = useState('jwt');

  // Sync tool selection with location.hash and listen for external hash changes
  useEffect(() => {
    const allowed = ['jwt','hash','encode','barcode','ipcalc','datetime','format','crypto','password','passwordhash','uuid','wifiqr','units','text'];
    const applyFromHash = () => {
      const raw = window.location.hash.replace(/^#/,'').trim();
      if (allowed.includes(raw)) setActiveTool(raw);
    };
    applyFromHash();
    window.addEventListener('hashchange', applyFromHash);
    return () => window.removeEventListener('hashchange', applyFromHash);
  }, []);

  const handleSelect = useCallback((toolId) => {
    setActiveTool(toolId);
    if (window.location.hash !== '#' + toolId) {
      window.location.hash = toolId; // updates URL for direct linking
    }
  }, []);

  return (
    <div className="h-screen w-screen bg-gray-50 dark:bg-gray-900 text-gray-800 dark:text-gray-100 font-sans overflow-hidden">
      <Navbar activeTool={activeTool} onSelect={handleSelect} />
      
      {/* Main content area - offset for sidebar on desktop, top bar on mobile */}
      <div className="h-full flex flex-col main-content-offset">
        <div className="flex-1 overflow-auto">
          {activeTool === 'jwt' && <JwtTool />}
          {activeTool === 'hash' && <HashTool />}
          {activeTool === 'encode' && <EncodeDecodeTool />}
          {activeTool === 'barcode' && <BarcodeTool />}
          {activeTool === 'ipcalc' && <IPCalcTool />}
          {activeTool === 'datetime' && <DateTimeTool />}
          {activeTool === 'format' && <DataFormatTool />}
          {activeTool === 'crypto' && <CryptoTool />}
          {activeTool === 'password' && <PasswordTool />}
          {activeTool === 'passwordhash' && <PasswordHashTool />}
          {activeTool === 'uuid' && <UuidTool />}
          {activeTool === 'wifiqr' && <WifiQRTool />}
          {activeTool === 'units' && <UnitsConverterTool />}
          {/* Future tools mount based on activeTool */}
        </div>
        <DisclaimerFooter />
      </div>
    </div>
  );
};

export default App;
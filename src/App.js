import React, { useState, useEffect, useCallback } from 'react';
import './styles.css';
import Navbar from './Navbar';
import DisclaimerFooter from './DisclaimerFooter';
import { allTools, toolIds } from './toolsRegistry';

const App = () => {
  const [activeTool, setActiveTool] = useState('jwt');

  // Sync tool selection with location.hash and listen for external hash changes
  useEffect(() => {
    const applyFromHash = () => {
      const raw = window.location.hash.replace(/^#/,'').trim();
      if (toolIds.has(raw)) setActiveTool(raw);
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
          {allTools.map(({ id, component: ToolComponent }) => (
            <div key={id} className={activeTool === id ? '' : 'hidden'}>
              <ToolComponent />
            </div>
          ))}
        </div>
        <DisclaimerFooter />
      </div>
    </div>
  );
};

export default App;

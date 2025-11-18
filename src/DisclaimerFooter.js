import React from 'react';

const DisclaimerFooter = () => {
  // Hide footer in offline build (check if swiss-knife.zip download link would be broken)
  if (typeof window !== 'undefined' && window.location.protocol === 'file:') {
    return null;
  }

  return (
    <footer
      aria-label="Application disclaimer"
      className="flex-none w-full text-xs px-3 py-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-900 border-t border-blue-200 dark:border-gray-700 text-gray-700 dark:text-gray-300"
    >
      <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
        <p className="flex items-center gap-2">
          <span className="text-blue-600 dark:text-blue-400">🔒</span>
          <span><strong>Privacy:</strong> Runs in browser. Network disabled.</span>
        </p>
        <a
          href="/swiss-knife.zip"
          download="swiss-knife.zip"
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded shadow-sm transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 whitespace-nowrap"
          aria-label="Download offline version"
        >
          ⬇ Download offline version
        </a>
      </div>
    </footer>
  );
};

export default DisclaimerFooter;

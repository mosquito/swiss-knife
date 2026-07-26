import React from 'react';
import CodeEditor from './CodeEditor';

const CodeEditorPanel = ({
  actions,
  className = '',
  error,
  header,
  language = 'plain',
  ...editorProps
}) => (
  <div className={`flex flex-col bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded min-h-0 ${className}`}>
    <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 gap-2">
      <div className="min-w-0">{header}</div>
      {actions}
    </div>
    <CodeEditor
      className="flex-1"
      language={language}
      {...editorProps}
    />
    {error && (
      <div className="px-3 py-1 text-[11px] leading-4 text-red-600 border-t border-red-200 dark:border-red-700 bg-red-50 dark:bg-red-900/20 font-mono">
        {error}
      </div>
    )}
  </div>
);

export default CodeEditorPanel;

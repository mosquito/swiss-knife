import React, { useMemo } from 'react';
import CodeMirror, { EditorView } from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { html } from '@codemirror/lang-html';
import { javascript } from '@codemirror/lang-javascript';
import { json } from '@codemirror/lang-json';
import { xml } from '@codemirror/lang-xml';
import { yaml } from '@codemirror/lang-yaml';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { useDarkMode } from './hooks';

const languageExtension = (language) => {
  switch (language) {
    case 'html': return html();
    case 'javascript': return javascript({ jsx: true });
    case 'json': return json();
    case 'toml': return StreamLanguage.define(toml);
    case 'xml': return xml();
    case 'yaml': return yaml();
    default: return [];
  }
};

const CodeEditor = ({
  ariaLabel = 'Code editor',
  className = '',
  language = 'plain',
  onBlur,
  onChange,
  placeholder,
  readOnly = false,
  value = '',
}) => {
  const isDarkMode = useDarkMode();
  const extensions = useMemo(
    () => [languageExtension(language), EditorView.lineWrapping],
    [language],
  );

  return (
    <div className={`code-editor min-h-0 overflow-hidden ${className}`}>
      <CodeMirror
        value={value}
        height="100%"
        theme={isDarkMode ? 'dark' : 'light'}
        extensions={extensions}
        editable={!readOnly}
        readOnly={readOnly}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onBlur={onBlur}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          highlightSelectionMatches: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
        }}
        onChange={(nextValue) => onChange?.(nextValue)}
      />
    </div>
  );
};

export default CodeEditor;

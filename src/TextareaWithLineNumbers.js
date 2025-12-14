import React, { useRef, useEffect } from 'react';

const TextareaWithLineNumbers = ({ 
  value, 
  onChange, 
  className = '', 
  textareaClassName = '', 
  gutterClassName = '',
  ...props 
}) => {
  const textareaRef = useRef(null);
  const linesRef = useRef(null);

  const lineCount = value ? value.split('\n').length : 1;
  const lines = Array.from({ length: lineCount }, (_, i) => i + 1);

  const handleScroll = () => {
    if (textareaRef.current && linesRef.current) {
      linesRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  // Sync scroll on value change as well, in case lines are added/removed and it shifts? 
  // Actually, we mostly care about manual scrolling.
  
  return (
    <div className={`flex relative overflow-hidden ${className}`}>
      <div
        ref={linesRef}
        className={`flex-none text-right select-none overflow-hidden line-numbers-gutter ${gutterClassName}`}
        style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit'
        }}
      >
        {lines.map((line) => (
          <div key={line}>{line}</div>
        ))}
      </div>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={onChange}
        onScroll={handleScroll}
        className={`flex-1 resize-none focus:outline-none ${textareaClassName}`}
        style={{
            fontFamily: 'inherit',
            fontSize: 'inherit',
            lineHeight: 'inherit',
            margin: 0
        }}
        {...props}
      />
    </div>
  );
};

export default TextareaWithLineNumbers;

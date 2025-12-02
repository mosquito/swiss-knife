import React, { useState, useEffect, useMemo } from 'react';
import { passwordDictionary } from './passwordDictionary';
import { generatePassword } from './utils';

const PasswordTool = () => {
  const [passwords, setPasswords] = useState([]);
  const [copied, setCopied] = useState(null);
  const [useNumbers, setUseNumbers] = useState(true);
  const [useSymbols, setUseSymbols] = useState(true);
  const [useUpperCase, setUseUpperCase] = useState(true);
  const [onlyLowerCase, setOnlyLowerCase] = useState(false);
  const [urlSafe, setUrlSafe] = useState(false);
  const [minNumber, setMinNumber] = useState(10);
  const [maxNumber, setMaxNumber] = useState(9999);
  const DEFAULT_SEPARATORS = '-_.,+@$';
  const [separatorsInput, setSeparatorsInput] = useState(DEFAULT_SEPARATORS);
  const [useMixedSeparators, setUseMixedSeparators] = useState(false);
  const [minWords, setMinWords] = useState(3);
  const [maxWords, setMaxWords] = useState(4);
  const [optsOpen, setOptsOpen] = useState(false);

  // Entropy calculation helpers
  const entropyInfo = useMemo(() => {
    const D = passwordDictionary.length || 1;
    const U = (!onlyLowerCase && useUpperCase) ? 2 : 1; // simple model: capitalized vs not
    // Build separator set size S from input chars plus empty separator
    const sepSet = new Set(['']);
    for (let i = 0; i < separatorsInput.length; i++) sepSet.add(separatorsInput[i]);
    const S = sepSet.size; // includes empty as one option
    // Calculate number range for entropy
    const numMin = Math.max(0, minNumber);
    const numMax = Math.max(numMin, maxNumber);
    const numRange = numMax - numMin + 1;
    const symOpts = useSymbols ? (urlSafe ? 4 : 15) : 1; // URL-safe: - _ . ~ + (or all standard symbols)
    const ln2 = Math.LN2;
    const log2 = (x) => x > 0 ? Math.log(x) / ln2 : 0;

    const clamp2to10 = (v) => Math.max(2, Math.min(10, v));
    const minW = clamp2to10(minWords);
    const maxW = clamp2to10(Math.max(minW, maxWords));

    const bitsForN = (N) => {
      // Words contribute: N * log2(D) for word choice
      const wordsBits = N * log2(D);
      
      // Capitalization entropy:
      // - If onlyLowerCase is enabled: no capitalization entropy
      // - If separator can be empty: words after empty separators are always capitalized (deterministic)
      //   so only words with non-empty separators can be randomly capitalized
      // - If useUpperCase is enabled: each word that can be randomly capitalized adds 1 bit
      let capBits = 0;
      if (!onlyLowerCase && useUpperCase) {
        if (sepSet.has('')) {
          // Empty separator is possible: first word gets random cap, others after empty sep are always capped
          // In mixed mode: variable number of empty seps, so estimate conservatively
          // In uniform mode: if empty chosen, all N-1 words after first are capped (no entropy)
          //                  if non-empty chosen, all N words can be randomly capped
          if (useMixedSeparators) {
            // Mixed: estimate that on average half the separators might be empty
            // Words after empty seps contribute 0 bits (always capped)
            // Words after non-empty seps or first word contribute 1 bit each
            capBits = N * 0.5; // conservative estimate
          } else {
            // Uniform: P(empty) = 1/S, P(non-empty) = (S-1)/S
            // If empty: first word gets 1 bit, rest are forced caps = 1 bit total
            // If non-empty: all N words get random cap = N bits
            const pEmpty = 1 / S;
            const pNonEmpty = (S - 1) / S;
            capBits = pEmpty * 1 + pNonEmpty * N;
          }
        } else {
          // No empty separator possible: all words can be randomly capitalized
          capBits = N;
        }
      }
      
      // Separators: if mixed, each gap gets a choice; if uniform, one choice for all
      const sepBits = useMixedSeparators ? (N > 0 ? (N - 1) * log2(S) : 0) : log2(S);
      
      // Numbers: if enabled, adds log2(numRange) bits + choice of which separator to replace
      const numBits = useNumbers ? (log2(numRange) + (N > 1 ? log2(N - 1) : 0)) : 0;
      
      // Suffix: only symbol (if enabled)
      const suffixBits = log2(symOpts);
      
      return Math.max(0, wordsBits + capBits + sepBits + numBits + suffixBits);
    };

    const minBits = Math.round(bitsForN(minW));
    const maxBits = Math.round(bitsForN(maxW));
    const labelFor = (b) => {
      if (b < 40) return 'weak';
      if (b < 60) return 'medium';
      if (b < 80) return 'strong';
      return 'strongest';
    };
    const text = (minBits === maxBits)
      ? `expected entropy ~ ${minBits} bits`
      : `expected entropy between ${minBits}–${maxBits} bits`;
    const rangeLabel = (minBits === maxBits)
      ? labelFor(minBits)
      : `${labelFor(minBits)}–${labelFor(maxBits)}`;
    return { minBits, maxBits, text, rangeLabel };
  }, [passwordDictionary.length, onlyLowerCase, useUpperCase, separatorsInput, useNumbers, useSymbols, useMixedSeparators, minWords, maxWords, urlSafe, minNumber, maxNumber]);

  // Load saved toggles on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem('password_generator_toggles');
      if (raw) {
        const saved = JSON.parse(raw);
        if (typeof saved.useNumbers === 'boolean') setUseNumbers(saved.useNumbers);
        if (typeof saved.useSymbols === 'boolean') setUseSymbols(saved.useSymbols);
        if (typeof saved.useUpperCase === 'boolean') setUseUpperCase(saved.useUpperCase);
        if (typeof saved.onlyLowerCase === 'boolean') setOnlyLowerCase(saved.onlyLowerCase);
        if (typeof saved.urlSafe === 'boolean') setUrlSafe(saved.urlSafe);
        if (typeof saved.minNumber === 'number') setMinNumber(Math.max(0, saved.minNumber));
        if (typeof saved.maxNumber === 'number') setMaxNumber(Math.max(0, saved.maxNumber));
        if (typeof saved.separatorsInput === 'string') setSeparatorsInput(saved.separatorsInput);
        if (typeof saved.useMixedSeparators === 'boolean') setUseMixedSeparators(saved.useMixedSeparators);
        if (typeof saved.minWords === 'number') setMinWords(Math.max(2, Math.min(10, saved.minWords)));
        if (typeof saved.maxWords === 'number') setMaxWords(Math.max(2, Math.min(10, saved.maxWords)));
      }
    } catch {}
  }, []);

  // Persist toggles when they change
  useEffect(() => {
    const data = {
      useNumbers, useSymbols, useUpperCase, onlyLowerCase, urlSafe,
      separatorsInput, useMixedSeparators,
      minWords, maxWords, minNumber, maxNumber
    };
    try { localStorage.setItem('password_generator_toggles', JSON.stringify(data)); } catch {}
  }, [useNumbers, useSymbols, useUpperCase, onlyLowerCase, urlSafe, separatorsInput, useMixedSeparators, minWords, maxWords, minNumber, maxNumber]);

  const generatePasswordWithConfig = () => {
    return generatePassword({
      wordList: passwordDictionary,
      minWords,
      maxWords,
      useNumbers,
      useSymbols,
      useUpperCase,
      onlyLowerCase,
      urlSafe,
      minNumber,
      maxNumber,
      separatorsInput,
      useMixedSeparators
    });
  };

  const generatePasswords = () => {
    const newPasswords = [];
    for (let i = 0; i < 24; i++) {
      newPasswords.push(generatePasswordWithConfig());
    }
    setPasswords(newPasswords);
    setCopied(null);
  };

  useEffect(() => {
    generatePasswords();
  }, [useNumbers, useSymbols, useUpperCase, onlyLowerCase, separatorsInput, useMixedSeparators, minWords, maxWords, urlSafe, minNumber, maxNumber]);

    const handleCopy = async (pwd, index) => {
    try {
      await navigator.clipboard.writeText(pwd);
      setCopied(index);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      /* ignore copy errors */
    }
  };

  const renderPassword = (pwd) => {
    const parts = [];
    let run = '';
    let runType = 'text'; // 'text' | 'upper' | 'num' | 'sym'

    const flush = (keyBase) => {
      if (!run) return;
      if (runType === 'num') parts.push(<span key={`num-${keyBase}`} className="text-jwtBlue dark:text-blue-400">{run}</span>);
      else if (runType === 'sym') parts.push(<span key={`sym-${keyBase}`} className="text-jwtPurple dark:text-purple-300">{run}</span>);
      else if (runType === 'upper') parts.push(<span key={`upp-${keyBase}`} className="text-green-600 dark:text-green-400">{run}</span>);
      else parts.push(<span key={`txt-${keyBase}`}>{run}</span>);
      run = '';
    };

    for (let i = 0; i < pwd.length; i++) {
      const ch = pwd[i];
      const isNum = /[0-9]/.test(ch);
      const isUpper = /[A-Z]/.test(ch);
      const isLower = /[a-z]/.test(ch);
      const isSym = !/[a-zA-Z0-9]/.test(ch);
      const type = isNum ? 'num' : (isSym ? 'sym' : (isUpper ? 'upper' : 'text'));
      if (type !== runType && run) {
        flush(i);
      }
      if (type !== runType) runType = type;
      run += ch;
    }
    flush('end');
    return parts;
  };

  return (
    <div className="tool-container">
      <div className="tool-content">
          <h2 className="tool-title">Password Generator</h2>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            Generates 24 readable passwords from a custom wordlist. Configure numbers, symbols, case, and separators (including mixed). Click any password to copy; settings persist locally.
          </p>

          

          <div className="space-y-4">
            <button
              onClick={generatePasswords}
              className="w-full px-4 py-2 rounded bg-gray-700 dark:bg-gray-600 text-white font-semibold hover:bg-gray-800 dark:hover:bg-gray-500 transition"
            >
              Regenerate
            </button>
            {passwords.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {passwords.map((pwd, index) => (
                  <div
                    key={index}
                    onClick={() => handleCopy(pwd, index)}
                    className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-sm hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition group"
                  >
                    <span className="font-mono text-sm text-gray-800 dark:text-gray-200 select-all flex-1 text-center">
                      {renderPassword(pwd)}
                    </span>
                    <button
                      className="ml-4 px-3 py-1 text-xs rounded bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 opacity-0 group-hover:opacity-100 transition"
                    >
                      {copied === index ? <><span className="icon icon-ok"></span> Copied</> : <><span className="icon icon-copy"></span> Copy</>}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {passwords.length === 0 && (
              <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-8">
                Generating passwords...
              </div>
            )}

            {/* Options Accordion */}
            <div className="bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded shadow-sm">
              <button
                onClick={() => setOptsOpen(o => !o)}
                className="w-full flex items-center justify-between px-4 py-2 text-sm font-semibold"
              >
                <span>Generator recipe</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-600 dark:text-gray-400 font-normal">
                    {entropyInfo.text} • {entropyInfo.rangeLabel}
                  </span>
                  <span className="text-[10px]">{optsOpen ? '▲' : '▼'}</span>
                </div>
              </button>
              {optsOpen && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={useNumbers} onChange={e => setUseNumbers(e.target.checked)} className="cursor-pointer" />
                      <span>Replace one separator with number</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={useSymbols} onChange={e => setUseSymbols(e.target.checked)} className="cursor-pointer" />
                      <span>Append symbol suffix</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={urlSafe} onChange={e => setUrlSafe(e.target.checked)} className="cursor-pointer" />
                      <span>URL-Safe symbols (- _ . ~ +)</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={useUpperCase} onChange={e => setUseUpperCase(e.target.checked)} disabled={onlyLowerCase} className="cursor-pointer disabled:opacity-50" />
                      <span>Use upper case</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={onlyLowerCase} onChange={e => setOnlyLowerCase(e.target.checked)} className="cursor-pointer" />
                      <span>Only lower case</span>
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-300">Min words</span>
                      <input
                        type="number"
                        min={2}
                        max={10}
                        value={minWords}
                        onChange={(e)=>{
                          const v = Number(e.target.value);
                          const clamped = Math.max(2, Math.min(10, v));
                          setMinWords(clamped);
                          if (clamped > maxWords) setMaxWords(clamped);
                        }}
                        className="w-16 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-300">Max words</span>
                      <input
                        type="number"
                        min={2}
                        max={10}
                        value={maxWords}
                        onChange={(e)=>{
                          const v = Number(e.target.value);
                          const clamped = Math.max(2, Math.min(10, v));
                          setMaxWords(clamped);
                          if (clamped < minWords) setMinWords(clamped);
                        }}
                        className="w-16 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs">
                    <label className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-300">Number min</span>
                      <input
                        type="number"
                        min={0}
                        value={minNumber}
                        onChange={(e)=>{
                          const v = Number(e.target.value);
                          const clamped = Math.max(0, v);
                          setMinNumber(clamped);
                          if (clamped > maxNumber) setMaxNumber(clamped);
                        }}
                        className="w-20 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                        disabled={!useNumbers}
                      />
                    </label>
                    <label className="flex items-center gap-2">
                      <span className="text-gray-600 dark:text-gray-300">Number max</span>
                      <input
                        type="number"
                        min={0}
                        value={maxNumber}
                        onChange={(e)=>{
                          const v = Number(e.target.value);
                          const clamped = Math.max(0, v);
                          setMaxNumber(clamped);
                          if (clamped < minNumber) setMinNumber(clamped);
                        }}
                        className="w-20 px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                        disabled={!useNumbers}
                      />
                    </label>
                  </div>
                  <div className="space-y-2 pt-1">
                    <h4 className="text-sm font-semibold">Separators</h4>
                    <div className="flex flex-wrap items-center gap-3 text-xs">
                      <input
                        type="text"
                        value={separatorsInput}
                        onChange={(e)=> setSeparatorsInput(e.target.value)}
                        placeholder="e.g. -_., (numbers added via toggle)"
                        className="min-w-[240px] px-2 py-1 rounded bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600"
                      />
                      <button
                        onClick={()=> setSeparatorsInput(DEFAULT_SEPARATORS)}
                        className="px-2 py-1 rounded bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500"
                      >
                        Reset defaults
                      </button>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" checked={useMixedSeparators} onChange={e => setUseMixedSeparators(e.target.checked)} className="cursor-pointer" />
                        <span>Mixed (vary within password)</span>
                      </label>
                    </div>
                    <div className="text-[10px] text-gray-500 dark:text-gray-400">Empty means no separators between words. Each character is treated as a possible separator.</div>
                  </div>
                </div>
              )}
            </div>
          </div>
      </div>
    </div>
  );
};

export default PasswordTool;

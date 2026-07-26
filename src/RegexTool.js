import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import Base64QuerySync from './Base64QuerySync';
import CodeEditor from './CodeEditor';
import HistoryList from './HistoryList';
import {
  UndoableInput,
  UndoableSelect,
  UndoableTextarea,
} from './UndoableFields';
import { copyText } from './browserActions';
import {
  analyzeRegexRisk,
  buildExplanation,
  FLAG_OPTIONS,
  generateRegexCode,
  parseRegexPattern,
  QUICK_REFERENCE,
  runRegexSafely,
} from './regexEngine';

const DEFAULT_PATTERN = '(?<user>[\\w.+-]+)@(?<domain>[\\w.-]+\\.[A-Za-z]{2,})';
const DEFAULT_TEST_STRING = [
  'Contact alice@example.com or bob.smith+alerts@dev.example.org.',
  'Invalid addresses: missing-at.example.com and root@localhost.',
].join('\n');
const DEFAULT_REPLACEMENT = '$<user> at $<domain>';
const MAX_SHARED_STATE_LENGTH = 12000;

const MODE_OPTIONS = [
  { id: 'match', label: 'Match' },
  { id: 'replace', label: 'Substitution' },
  { id: 'list', label: 'List' },
  { id: 'tests', label: 'Unit Tests' },
  { id: 'code', label: 'Code Generator' },
];

const EXAMPLES = [
  {
    id: 'email',
    label: 'Email',
    pattern: DEFAULT_PATTERN,
    flags: 'gi',
    testString: DEFAULT_TEST_STRING,
    replacement: DEFAULT_REPLACEMENT,
  },
  {
    id: 'url',
    label: 'URL parts',
    pattern: '(?<scheme>https?):\\/\\/(?<host>[\\w.-]+)(?<port>:\\d+)?(?<path>\\/[^\\s?#]*)?',
    flags: 'gi',
    testString: 'Docs: https://example.com/reference\nLocal: http://localhost:8080/api/v1',
    replacement: '$<host>$<path>',
  },
  {
    id: 'logs',
    label: 'Log lines',
    pattern: '^(?<timestamp>\\d{4}-\\d{2}-\\d{2}T\\S+)\\s+(?<level>INFO|WARN|ERROR)\\s+(?<message>.*)$',
    flags: 'gm',
    testString: [
      '2026-07-26T18:42:01Z INFO server started',
      '2026-07-26T18:42:03Z WARN queue is 80% full',
      '2026-07-26T18:42:05Z ERROR connection refused',
    ].join('\n'),
    replacement: '[$<level>] $<message>',
  },
  {
    id: 'unicode',
    label: 'Unicode words',
    pattern: '\\p{Letter}[\\p{Letter}\\p{Mark}\\p{Number}_-]*',
    flags: 'gu',
    testString: 'English Ελληνικά русский 日本語 café naïve',
    replacement: '«$&»',
  },
  {
    id: 'redos',
    label: 'Risk demo',
    pattern: '^(a+)+$',
    flags: '',
    testString: 'aaaaaaaaaaaaaaaaaaaa!',
    replacement: '$&',
  },
];

const createDefaultTests = () => [
  { id: 1, input: 'alice@example.com', expected: true },
  { id: 2, input: 'root@localhost', expected: false },
  { id: 3, input: 'not an email', expected: false },
];

const regexHistoryKey = (item) => JSON.stringify({
  flags: item.flags,
  mode: item.mode,
  pattern: item.pattern,
  replacement: item.replacement,
  testString: item.testString,
  tests: item.tests,
});

const renderRegexHistoryLabel = (item) => (
  <div className="min-w-0">
    <div className="font-mono text-xs truncate text-gray-800 dark:text-gray-100">
      /{item.pattern}/{item.flags}
    </div>
    <div className="text-[11px] text-gray-500 truncate">
      {(item.testString || '').length.toLocaleString()} chars · {item.mode || 'match'}
    </div>
  </div>
);

const locationAt = (text, index) => {
  const before = text.slice(0, Math.max(0, index));
  const lines = before.split('\n');
  return {
    column: lines[lines.length - 1].length + 1,
    line: lines.length,
  };
};

const formatDuration = (milliseconds) => {
  if (!Number.isFinite(milliseconds)) return '—';
  if (milliseconds < 1) return `${Math.max(1, Math.round(milliseconds * 1000))} μs`;
  return `${milliseconds.toFixed(milliseconds < 10 ? 2 : 1)} ms`;
};

const normalizeFlags = (flags) => FLAG_OPTIONS
  .filter(({ id }) => flags.includes(id))
  .map(({ id }) => id)
  .join('');

const buildHighlightSegments = (text, matches, selectedMatch) => {
  const segments = [];
  let cursor = 0;
  matches.forEach((match, index) => {
    if (match.start < cursor) return;
    if (match.start > cursor) {
      segments.push({
        key: `text-${cursor}`,
        text: text.slice(cursor, match.start),
        type: 'text',
      });
    }
    segments.push({
      active: index === selectedMatch,
      color: index % 4,
      key: `match-${index}-${match.start}`,
      text: match.end === match.start ? '\u200b' : text.slice(match.start, match.end),
      type: 'match',
    });
    cursor = Math.max(cursor, match.end);
  });
  if (cursor < text.length) {
    segments.push({
      key: `text-${cursor}`,
      text: text.slice(cursor),
      type: 'text',
    });
  }
  if (!segments.length) segments.push({ key: 'empty', text, type: 'text' });
  return segments;
};

const HighlightedTestEditor = ({
  matches,
  onChange,
  selectedMatch,
  value,
}) => {
  const overlayRef = useRef(null);
  const segments = useMemo(
    () => buildHighlightSegments(value, matches, selectedMatch),
    [matches, selectedMatch, value],
  );

  const handleScroll = (event) => {
    if (!overlayRef.current) return;
    overlayRef.current.scrollTop = event.currentTarget.scrollTop;
    overlayRef.current.scrollLeft = event.currentTarget.scrollLeft;
  };

  return (
    <div className="regex-test-editor relative h-[360px] min-h-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded overflow-hidden focus-within:ring-2 focus-within:ring-jwtBlue">
      <pre
        ref={overlayRef}
        aria-hidden="true"
        className="regex-highlight-layer absolute inset-0 overflow-hidden font-mono text-sm leading-5 whitespace-pre"
      >
        {segments.map((segment) => segment.type === 'match' ? (
          <mark
            key={segment.key}
            className={`regex-match-highlight regex-match-highlight-${segment.color} ${segment.active ? 'regex-match-highlight-active' : ''}`}
          >
            {segment.text}
          </mark>
        ) : <span key={segment.key}>{segment.text}</span>)}
        {value.endsWith('\n') ? ' ' : ''}
      </pre>
      <UndoableTextarea
        aria-label="Regex test string"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onScroll={handleScroll}
        wrap="off"
        spellCheck="false"
        placeholder="Insert the text you want to test…"
        className="absolute inset-0 z-10 w-full h-full bg-transparent border-none font-mono text-sm leading-5 text-gray-900 dark:text-gray-100 resize-none outline-none"
        style={{ padding: '0.75rem', tabSize: 2 }}
      />
    </div>
  );
};

const StatusBadge = ({ children, help = '', tone = 'neutral' }) => {
  const tones = {
    danger: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 border-red-200 dark:border-red-800',
    neutral: 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600',
    success: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200 dark:border-green-800',
    warning: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800',
  };
  return (
    <span
      className={`relative group inline-flex items-center gap-1 px-2 py-1 rounded border text-[11px] leading-4 font-semibold ${tones[tone]}`}
      tabIndex={help ? 0 : undefined}
      title={help || undefined}
    >
      {children}
      {help && (
        <>
          <span
            aria-hidden="true"
            className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full border border-current opacity-60 text-[9px] leading-none"
          >
            ?
          </span>
          <span
            role="tooltip"
            className="absolute z-50 left-0 bottom-full mb-2 w-72 max-w-[80vw] p-2.5 rounded bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 text-[11px] leading-4 font-normal shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus:opacity-100 group-focus:visible pointer-events-none transition-opacity"
          >
            {help}
          </span>
        </>
      )}
    </span>
  );
};

const MatchInformation = ({
  matches,
  onSelectMatch,
  selectedMatch,
  testString,
  truncated,
}) => {
  const visibleMatches = matches.slice(0, 200);

  if (!matches.length) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center">
        <div>
          <div className="text-3xl mb-3 text-gray-300 dark:text-gray-600">∅</div>
          <div className="text-sm font-semibold">No matches</div>
          <div className="text-xs text-gray-500 mt-1">The expression is valid but does not match the test string.</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {visibleMatches.map((match, index) => {
        const selected = selectedMatch === index;
        const location = locationAt(testString, match.start);
        return (
          <button
            key={`${match.start}-${match.end}-${index}`}
            type="button"
            onClick={() => onSelectMatch(index)}
            className={`w-full text-left rounded border p-3 transition ${
              selected
                ? 'border-jwtBlue bg-blue-50 dark:bg-blue-900/20 ring-1 ring-jwtBlue'
                : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-400 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="text-xs font-bold text-gray-600 dark:text-gray-300">
                Match {match.number}
              </div>
              <div className="text-[11px] font-mono text-gray-500">
                {match.start}–{match.end} · L{location.line}:C{location.column}
              </div>
            </div>
            <div className="mt-1 font-mono text-sm break-all text-gray-900 dark:text-gray-100">
              {match.value === '' ? <span className="italic text-gray-400">zero-length match</span> : match.value}
            </div>
            {selected && Boolean(match.groups.length) && (
              <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1.5">
                {match.groups.map((group) => {
                  const namedEntry = Object.entries(match.named)
                    .find(([, named]) => named.start === group.start && named.end === group.end);
                  return (
                    <div key={group.number} className="grid grid-cols-[auto_1fr_auto] gap-2 items-start text-xs">
                      <span className="font-bold text-jwtPurple">
                        {namedEntry ? namedEntry[0] : `Group ${group.number}`}
                      </span>
                      <span className="font-mono break-all">
                        {group.value === null ? <i className="text-gray-400">unmatched</i> : group.value}
                      </span>
                      <span className="font-mono text-gray-400">
                        {group.start === null ? '—' : `${group.start}–${group.end}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </button>
        );
      })}
      {(truncated || matches.length > visibleMatches.length) && (
        <div className="alert-warning text-xs">
          Results were capped to keep the interface responsive.
        </div>
      )}
    </div>
  );
};

const Explanation = ({ explanation, pattern, risk }) => (
  <div className="space-y-3">
    <div className={`rounded border p-3 ${
      risk.level === 'high'
        ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
        : risk.level === 'review'
          ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
          : 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
    }`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wide">Backtracking risk</div>
        <StatusBadge tone={risk.level === 'high' ? 'danger' : risk.level === 'review' ? 'warning' : 'success'}>
          {risk.level === 'high' ? 'High' : risk.level === 'review' ? 'Review' : 'Low'}
        </StatusBadge>
      </div>
      <div className="mt-1 text-[11px] leading-4 text-gray-600 dark:text-gray-300">
        Heuristic only. Suspicious executions are isolated and stopped automatically.
      </div>
      {risk.issues.map((issue) => (
        <div key={`${issue.start}-${issue.message}`} className="mt-2 text-xs">
          <span className="font-mono text-gray-500">[{issue.start}–{issue.end}]</span>{' '}
          {issue.message}
        </div>
      ))}
    </div>

    <div className="space-y-1">
      {explanation.slice(0, 300).map((row, index) => (
        <div
          key={`${row.start}-${row.end}-${row.type}-${index}`}
          className="grid grid-cols-[minmax(80px,0.7fr)_minmax(0,1.3fr)] gap-3 px-2 py-1.5 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60 text-xs"
          style={{ paddingLeft: `${0.5 + Math.min(row.depth, 6) * 0.6}rem` }}
          title={`Pattern range ${row.start}–${row.end}`}
        >
          <code className="font-mono font-bold text-jwtPurple break-all">
            {row.raw || pattern.slice(row.start, row.end) || '∅'}
          </code>
          <span className="text-gray-600 dark:text-gray-300">{row.description}</span>
        </div>
      ))}
      {explanation.length > 300 && (
        <div className="text-xs text-gray-500 p-2">Explanation capped at 300 nodes.</div>
      )}
    </div>
  </div>
);

const QuickReference = ({ query, onQueryChange }) => {
  const items = QUICK_REFERENCE.filter((item) => (
    `${item.token} ${item.title} ${item.detail}`.toLowerCase().includes(query.toLowerCase())
  ));
  return (
    <div>
      <UndoableInput
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search tokens, groups, anchors…"
        aria-label="Search regex quick reference"
        className="input w-full mb-3"
      />
      <div className="space-y-1">
        {items.map((item) => (
          <div key={item.token} className="grid grid-cols-[120px_1fr] gap-3 px-2 py-2 rounded hover:bg-gray-100 dark:hover:bg-gray-700/60">
            <code className="font-mono text-sm font-bold text-jwtPurple whitespace-pre-wrap">{item.token}</code>
            <div>
              <div className="text-xs font-bold">{item.title}</div>
              <div className="text-[11px] leading-4 text-gray-500 dark:text-gray-400">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const UnitTests = ({ results, tests, onChange }) => {
  const updateTest = (id, patch) => {
    onChange(tests.map((test) => test.id === id ? { ...test, ...patch } : test));
  };
  const addTest = () => {
    const id = Math.max(0, ...tests.map((test) => test.id)) + 1;
    onChange([...tests, { id, input: '', expected: true }]);
  };
  const removeTest = (id) => onChange(tests.filter((test) => test.id !== id));
  const resultById = new Map(results.map((result) => [result.id, result]));
  const passed = results.filter((result) => result.passed).length;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-bold">Unit Tests</div>
          <div className="text-xs text-gray-500">
            {results.length ? `${passed}/${results.length} passing` : 'Tests run with the current JavaScript expression.'}
          </div>
        </div>
        <button type="button" onClick={addTest} className="btn-primary btn-sm">Add test</button>
      </div>
      {tests.map((test, index) => {
        const result = resultById.get(test.id);
        return (
          <div key={test.id} className="card p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">Test {index + 1}</span>
                {result && (
                  <StatusBadge tone={result.passed ? 'success' : 'danger'}>
                    {result.passed ? 'PASS' : 'FAIL'}
                  </StatusBadge>
                )}
              </div>
              <button
                type="button"
                onClick={() => removeTest(test.id)}
                disabled={tests.length === 1}
                className="text-xs text-red-600 dark:text-red-400 disabled:opacity-30"
              >
                Remove
              </button>
            </div>
            <UndoableTextarea
              value={test.input}
              onChange={(event) => updateTest(test.id, { input: event.target.value })}
              aria-label={`Regex test case ${index + 1}`}
              className="w-full h-20 input font-mono resize-none"
              style={{ padding: '0.65rem' }}
              placeholder="Test input…"
              spellCheck="false"
            />
            <label className="mt-2 flex items-center gap-2 text-xs cursor-pointer">
              <UndoableInput
                type="checkbox"
                checked={test.expected}
                onChange={(event) => updateTest(test.id, { expected: event.target.checked })}
              />
              Expected to match
              {result && (
                <span className="ml-auto text-gray-500">
                  Actual: {result.found ? 'match' : 'no match'}
                </span>
              )}
            </label>
          </div>
        );
      })}
    </div>
  );
};

const CodeGenerator = ({ snippets }) => {
  const [language, setLanguage] = useState('javascript');
  const [variant, setVariant] = useState('match');
  const [copied, setCopied] = useState(false);
  const selectedLanguage = snippets[language];
  const code = selectedLanguage.snippets[variant];
  const copy = async () => {
    if (await copyText(code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };
  const labels = {
    compile: 'Compile',
    match: 'Match all',
    replace: 'Replace',
  };

  return (
    <div className="card p-0 overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
        <div className="flex gap-1">
          {Object.entries(snippets).map(([id, languageInfo]) => (
            <button
              key={id}
              type="button"
              onClick={() => setLanguage(id)}
              className={`px-3 py-1.5 rounded text-xs font-bold ${
                language === id
                  ? 'bg-jwtPurple text-white'
                  : 'bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
              }`}
            >
              {languageInfo.label}
            </button>
          ))}
        </div>
        <button type="button" onClick={copy} className="btn-secondary btn-sm">
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex flex-wrap gap-1">
          {Object.keys(labels).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => setVariant(id)}
              className={`px-2 py-1 rounded text-xs font-semibold ${
                variant === id
                  ? 'bg-gray-700 dark:bg-gray-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 hover:bg-gray-300 dark:hover:bg-gray-500'
              }`}
            >
              {labels[id]}
            </button>
          ))}
        </div>
        <span className="text-[11px] text-gray-500">
          {selectedLanguage.label} · generated locally
        </span>
      </div>
      {selectedLanguage.warnings.length > 0 && (
        <div className="px-3 py-2 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
          <div className="text-xs font-bold text-yellow-800 dark:text-yellow-200 mb-1">
            Compatibility notes
          </div>
          {selectedLanguage.warnings.map((warning) => (
            <div key={warning} className="text-[11px] leading-4 text-yellow-700 dark:text-yellow-300">
              • {warning}
            </div>
          ))}
        </div>
      )}
      <CodeEditor
        readOnly
        language={selectedLanguage.language}
        lineWrapping={false}
        value={code}
        ariaLabel={`Generated ${selectedLanguage.label} regex code`}
        className="h-80"
      />
    </div>
  );
};

const RegexTool = () => {
  const [pattern, setPattern] = useState(DEFAULT_PATTERN);
  const [flags, setFlags] = useState('gi');
  const [testString, setTestString] = useState(DEFAULT_TEST_STRING);
  const [replacement, setReplacement] = useState(DEFAULT_REPLACEMENT);
  const [mode, setMode] = useState('match');
  const [tests, setTests] = useState(createDefaultTests);
  const [result, setResult] = useState(null);
  const [runtimeError, setRuntimeError] = useState('');
  const [running, setRunning] = useState(false);
  const [selectedMatch, setSelectedMatch] = useState(0);
  const [sidePanel, setSidePanel] = useState('matches');
  const [referenceQuery, setReferenceQuery] = useState('');
  const [historyItem, setHistoryItem] = useState(null);
  const requestIdRef = useRef(0);

  const syntax = useMemo(() => {
    try {
      const parsed = parseRegexPattern(pattern, flags);
      return {
        aliases: parsed.aliases,
        ast: parsed.ast,
        error: null,
        executionPattern: parsed.pattern,
        explanation: buildExplanation(parsed.ast, parsed),
        risk: analyzeRegexRisk(parsed.ast, parsed.pattern, parsed),
      };
    } catch (error) {
      const position = Number.isInteger(error.sourceIndex)
        ? error.sourceIndex
        : Number.isInteger(error.index)
          ? error.index
          : null;
      return {
        aliases: [],
        ast: null,
        executionPattern: pattern,
        explanation: [],
        risk: { level: 'low', issues: [] },
        error: {
          message: error.message || String(error),
          position,
        },
      };
    }
  }, [flags, pattern]);

  const workspaceSnapshot = useMemo(() => ({
    flags,
    mode,
    pattern,
    replacement,
    testString,
    tests,
  }), [flags, mode, pattern, replacement, testString, tests]);

  useEffect(() => {
    if (!pattern && !testString) return undefined;
    const timeout = setTimeout(() => setHistoryItem(workspaceSnapshot), 1200);
    return () => clearTimeout(timeout);
  }, [workspaceSnapshot]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    if (syntax.error) {
      setResult(null);
      setRuntimeError('');
      setRunning(false);
      return undefined;
    }

    setRunning(true);
    setRuntimeError('');
    const timeout = setTimeout(() => {
      runRegexSafely({
        pattern: syntax.executionPattern,
        flags,
        testString,
        replacement,
        tests,
        maxMatches: 500,
        timeoutMs: 400,
      }).then((nextResult) => {
        if (requestId !== requestIdRef.current) return;
        setResult(nextResult);
        setSelectedMatch((current) => Math.min(
          current,
          Math.max(0, nextResult.matches.length - 1),
        ));
        setRunning(false);
      }).catch((error) => {
        if (requestId !== requestIdRef.current) return;
        setResult(null);
        setRuntimeError(error.message || String(error));
        setRunning(false);
      });
    }, 100);

    return () => clearTimeout(timeout);
  }, [flags, pattern, replacement, syntax.error, syntax.executionPattern, testString, tests]);

  const sharedState = useMemo(() => ({
    flags,
    mode,
    pattern,
    replacement,
    testString,
  }), [flags, mode, pattern, replacement, testString]);
  const encodeSharedState = useCallback((value) => {
    const encoded = JSON.stringify(value);
    return encoded.length <= MAX_SHARED_STATE_LENGTH ? encoded : '';
  }, []);
  const decodeSharedState = useCallback((raw) => {
    const value = JSON.parse(raw);
    if (!value || typeof value.pattern !== 'string' || typeof value.testString !== 'string') {
      return undefined;
    }
    return value;
  }, []);
  const applySharedState = useCallback((value) => {
    setPattern(value.pattern);
    setFlags(normalizeFlags(typeof value.flags === 'string' ? value.flags : 'g'));
    setTestString(value.testString);
    setReplacement(typeof value.replacement === 'string' ? value.replacement : '');
    if (MODE_OPTIONS.some(({ id }) => id === value.mode)) setMode(value.mode);
  }, []);

  const restoreWorkspace = useCallback((value) => {
    if (!value || typeof value.pattern !== 'string') return;
    setPattern(value.pattern);
    setFlags(normalizeFlags(typeof value.flags === 'string' ? value.flags : 'g'));
    setTestString(typeof value.testString === 'string' ? value.testString : '');
    setReplacement(typeof value.replacement === 'string' ? value.replacement : '');
    setTests(Array.isArray(value.tests) && value.tests.length ? value.tests : createDefaultTests());
    if (MODE_OPTIONS.some(({ id }) => id === value.mode)) setMode(value.mode);
    setSelectedMatch(0);
  }, []);

  const toggleFlag = (flag) => {
    setFlags((current) => {
      let next = current.includes(flag)
        ? current.replace(flag, '')
        : current + flag;
      if (flag === 'u' && next.includes('u')) next = next.replace('v', '');
      if (flag === 'v' && next.includes('v')) next = next.replace('u', '');
      return normalizeFlags(next);
    });
  };

  const applyExample = (example) => {
    setPattern(example.pattern);
    setFlags(example.flags);
    setTestString(example.testString);
    setReplacement(example.replacement);
    setMode('match');
    setSidePanel('matches');
    setSelectedMatch(0);
  };

  const clearWorkspace = () => {
    setPattern('');
    setTestString('');
    setReplacement('');
    setSelectedMatch(0);
  };

  const matches = result?.matches || [];
  const snippets = useMemo(
    () => generateRegexCode({
      pattern: syntax.executionPattern,
      flags,
      testString,
      replacement,
    }),
    [flags, replacement, syntax.executionPattern, testString],
  );
  const listOutput = matches.map((match) => match.value).join('\n');
  const selectedLocation = syntax.error?.position === null
    ? null
    : locationAt(pattern, syntax.error?.position || 0);
  const riskTone = syntax.risk.level === 'high'
    ? 'danger'
    : syntax.risk.level === 'review'
      ? 'warning'
      : 'success';
  const timedOut = runtimeError.startsWith('Execution exceeded');

  return (
    <div className="tool-container">
      <Base64QuerySync
        value={sharedState}
        encode={encodeSharedState}
        decode={decodeSharedState}
        onDecoded={applySharedState}
        queryParam="regex"
        toolHash="#regex"
      />
      <HistoryList
        storageKey="regex_lab_history_v1"
        newItem={historyItem}
        max={20}
        dedupeKey={regexHistoryKey}
      >
        {() => null}
      </HistoryList>
      <div className="tool-content">
        <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-3">
          <div>
            <h2 className="tool-title mb-1">Regex Lab</h2>
            <p className="tool-subtitle mb-0">
              Build, explain and test ECMAScript regular expressions. Execution stays offline and runs in a timeout-protected worker.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EXAMPLES.map((example) => (
              <button
                key={example.id}
                type="button"
                onClick={() => applyExample(example)}
                className="btn-secondary btn-sm"
              >
                {example.label}
              </button>
            ))}
            <button type="button" onClick={clearWorkspace} className="btn-secondary btn-sm">
              Clear
            </button>
          </div>
        </div>

        <div className="card p-3 space-y-3">
          <div className="flex flex-col xl:flex-row xl:items-center gap-3">
            <div className="flex-1 min-w-0">
              <label className="label">Regular Expression · JavaScript / ECMAScript 2025</label>
              <div className={`flex items-center bg-white dark:bg-gray-900 border rounded font-mono ${
                syntax.error
                  ? 'border-red-500 ring-1 ring-red-400'
                  : 'border-gray-300 dark:border-gray-600 focus-within:ring-2 focus-within:ring-jwtBlue'
              }`}>
                <span className="pl-3 text-lg text-gray-400 select-none">/</span>
                <UndoableInput
                  value={pattern}
                  onChange={(event) => setPattern(event.target.value)}
                  aria-label="Regular expression pattern"
                  spellCheck="false"
                  className="flex-1 min-w-0 bg-transparent px-2 py-2.5 border-none outline-none font-mono"
                />
                <span className="text-lg text-gray-400 select-none">/</span>
                <span className="px-3 text-sm font-bold text-jwtPurple min-w-8">{flags || '—'}</span>
              </div>
              {syntax.error && (
                <div className="mt-1 text-xs text-red-600 dark:text-red-400 font-mono">
                  {syntax.error.message}
                  {selectedLocation && ` · line ${selectedLocation.line}, column ${selectedLocation.column}`}
                </div>
              )}
            </div>

            <div className="xl:w-[440px]">
              <div className="label">Flags</div>
              <div className="flex flex-wrap gap-1">
                {FLAG_OPTIONS.map((flag) => {
                  const active = flags.includes(flag.id);
                  return (
                    <button
                      key={flag.id}
                      type="button"
                      onClick={() => toggleFlag(flag.id)}
                      title={`${flag.id} — ${flag.description}`}
                      className={`group px-2 py-1.5 rounded border text-xs transition ${
                        active
                          ? 'bg-gray-700 dark:bg-gray-500 border-gray-700 dark:border-gray-500 text-white'
                          : 'bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 hover:border-gray-500'
                      }`}
                    >
                      <span className="font-mono font-bold">{flag.id}</span>
                      <span className="ml-1 opacity-70 hidden 2xl:inline">{flag.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-gray-100 dark:border-gray-700">
            <StatusBadge
              tone={syntax.error ? 'danger' : 'success'}
              help="Validation uses the ECMAScript 2025 grammar and then compiles the normalized pattern with this browser’s native JavaScript RegExp engine."
            >
              {syntax.error ? 'SYNTAX ERROR' : 'VALID'}
            </StatusBadge>
            <StatusBadge help="Number of non-overlapping matches returned by the selected JavaScript flags. Results are capped at 500.">
              {running ? 'RUNNING…' : `${matches.length} MATCH${matches.length === 1 ? '' : 'ES'}`}
            </StatusBadge>
            <StatusBadge help="Execution time measured inside the isolated worker. Worker startup and UI rendering are not included.">
              {result ? formatDuration(result.elapsedMs) : '—'}
            </StatusBadge>
            {!syntax.error && (
              <StatusBadge
                tone={riskTone}
                help="Heuristic backtracking risk. LOW: no common traps detected. REVIEW: unbounded wildcards or a large search space deserve inspection. HIGH: nested quantifiers or ambiguous repeated alternatives may grow exponentially. This is not a proof that a regex is safe or unsafe."
              >
                RISK: {syntax.risk.level.toUpperCase()}
              </StatusBadge>
            )}
            {syntax.aliases.length > 0 && (
              <StatusBadge
                tone="warning"
                help="Python-style named groups and backreferences are preserved in the editor, then normalized to native JavaScript syntax before parsing and execution."
              >
                PYTHON SYNTAX → JS · {syntax.aliases.length}
              </StatusBadge>
            )}
            {timedOut && (
              <StatusBadge
                tone="danger"
                help="The isolated worker exceeded its execution budget and was terminated. This usually indicates catastrophic backtracking or an input that is too expensive for the current pattern."
              >
                TIMED OUT
              </StatusBadge>
            )}
            {result?.truncated && <StatusBadge tone="warning">RESULTS CAPPED</StatusBadge>}
          </div>
        </div>

        <div className="flex flex-wrap gap-1 border-b border-gray-300 dark:border-gray-700">
          {MODE_OPTIONS.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`px-3 py-2 text-xs font-bold border-b-2 -mb-px transition ${
                mode === option.id
                  ? 'border-jwtBlue text-gray-900 dark:text-white bg-blue-50/50 dark:bg-blue-900/10'
                  : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        {(syntax.error || runtimeError) && (
          <div className="alert-error">
            <div className="alert-error-text font-mono">
              {runtimeError || syntax.error.message}
            </div>
          </div>
        )}

        {mode === 'tests' ? (
          <div className="grid xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] gap-4 items-start">
            <UnitTests tests={tests} results={result?.tests || []} onChange={setTests} />
            <div className="card">
              <div className="text-sm font-bold mb-2">Test semantics</div>
              <ul className="text-xs text-gray-600 dark:text-gray-300 space-y-2">
                <li>Each input runs against a fresh JavaScript RegExp instance.</li>
                <li>“Expected to match” uses the same semantics as <code className="font-mono">regex.test(input)</code>.</li>
                <li>The complete suite shares the same 400 ms safety timeout.</li>
                <li>Test data never leaves this browser.</li>
              </ul>
            </div>
          </div>
        ) : mode === 'code' ? (
          <div className="grid xl:grid-cols-[minmax(0,1.25fr)_minmax(340px,0.75fr)] gap-4 items-start">
            <CodeGenerator snippets={snippets} />
            <div className="card">
              <div className="text-sm font-bold mb-2">Cross-language generation</div>
              <p className="text-xs text-gray-600 dark:text-gray-300 leading-5">
                JavaScript executes the exact normalized pattern. Python and Go generators translate named groups, flags and replacement tokens, and report constructs whose semantics cannot be carried across safely.
              </p>
            </div>
          </div>
        ) : (
          <div className="grid xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)] gap-4 min-h-0">
            <div className="space-y-4 min-w-0">
              <div>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <label className="label mb-0">Test String</label>
                  <div className="text-[11px] font-mono text-gray-500">
                    {testString.length.toLocaleString()} chars · {testString.split('\n').length} lines
                  </div>
                </div>
                <HighlightedTestEditor
                  value={testString}
                  onChange={setTestString}
                  matches={matches}
                  selectedMatch={selectedMatch}
                />
              </div>

              {mode === 'replace' && (
                <div className="space-y-3">
                  <div>
                    <label className="label">Substitution</label>
                    <UndoableInput
                      value={replacement}
                      onChange={(event) => setReplacement(event.target.value)}
                      aria-label="Regex replacement"
                      className="input input-mono w-full"
                      placeholder="$1, $<name>, $&, $`, $'"
                    />
                  </div>
                  <div>
                    <label className="label">Result</label>
                    <UndoableTextarea
                      readOnly
                      value={result?.replacementOutput || ''}
                      aria-label="Regex substitution output"
                      className="textarea h-44"
                    />
                  </div>
                </div>
              )}

              {mode === 'list' && (
                <div>
                  <label className="label">Match List · one result per line</label>
                  <UndoableTextarea
                    readOnly
                    value={listOutput}
                    aria-label="Regex match list"
                    className="textarea h-44"
                  />
                </div>
              )}
            </div>

            <div className="card p-0 min-h-[440px] max-h-[720px] flex flex-col overflow-hidden">
              <div className="flex flex-wrap border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                {[
                  { id: 'matches', label: `Matches (${matches.length})` },
                  { id: 'explanation', label: 'Explanation' },
                  { id: 'reference', label: 'Reference' },
                  { id: 'history', label: 'History' },
                ].map((panel) => (
                  <button
                    key={panel.id}
                    type="button"
                    onClick={() => setSidePanel(panel.id)}
                    className={`px-3 py-2 text-xs font-bold border-b-2 ${
                      sidePanel === panel.id
                        ? 'border-jwtPurple text-gray-900 dark:text-white'
                        : 'border-transparent text-gray-500 hover:text-gray-800 dark:hover:text-gray-200'
                    }`}
                  >
                    {panel.label}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-auto custom-scrollbar p-3">
                {sidePanel === 'matches' && (
                  <MatchInformation
                    matches={matches}
                    onSelectMatch={setSelectedMatch}
                    selectedMatch={selectedMatch}
                    testString={testString}
                    truncated={result?.truncated}
                  />
                )}
                {sidePanel === 'explanation' && !syntax.error && (
                  <Explanation
                    explanation={syntax.explanation}
                    pattern={pattern}
                    risk={syntax.risk}
                  />
                )}
                {sidePanel === 'reference' && (
                  <QuickReference query={referenceQuery} onQueryChange={setReferenceQuery} />
                )}
                {sidePanel === 'history' && (
                  <HistoryList
                    storageKey="regex_lab_history_v1"
                    title="Regex Workspace History"
                    newItem={historyItem}
                    max={20}
                    dedupeKey={regexHistoryKey}
                    renderLabel={renderRegexHistoryLabel}
                    onRestore={restoreWorkspace}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegexTool;

import React, { useState, useEffect, useRef } from 'react';

// Helper: format relative difference between a target date and now.
const humanRelative = (targetMs, nowMs) => {
  let diff = targetMs - nowMs; // positive => future
  const direction = diff === 0 ? 'now' : diff > 0 ? 'in' : 'ago';
  diff = Math.abs(diff);
  const sec = Math.floor(diff / 1000);
  const days = Math.floor(sec / 86400);
  const hours = Math.floor((sec % 86400) / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  const parts = [];
  if (days) parts.push(days + ' day' + (days !== 1 ? 's' : ''));
  if (hours) parts.push(hours + ' hour' + (hours !== 1 ? 's' : ''));
  if (mins) parts.push(mins + ' minute' + (mins !== 1 ? 's' : ''));
  if (seconds || parts.length === 0) parts.push(seconds + ' second' + (seconds !== 1 ? 's' : ''));
  if (direction === 'now') return 'now';
  const phr = parts.join(' ');
  return direction === 'in' ? ('after ' + phr) : (phr + ' ago');
};

const parseInputDate = (str) => {
  if (!str) return null;
  // Try ISO or natural Date.parse
  const ms = Date.parse(str);
  return isNaN(ms) ? null : ms;
};

const isNumeric = (v) => /^[-]?\d+(\.\d+)?$/.test(v.trim());

const DateTimeTool = () => {
  // Prefill with current time: epoch seconds and current ISO string
  const [tsInput, setTsInput] = useState(() => Math.floor(Date.now() / 1000).toString()); // user-provided timestamp (seconds or ms)
  const [dtInput, setDtInput] = useState(() => new Date().toISOString()); // user-provided datetime string
  const [resolvedTsMs, setResolvedTsMs] = useState(null);
  const [resolvedDtMs, setResolvedDtMs] = useState(null);
  const [errorTs, setErrorTs] = useState('');
  const [errorDt, setErrorDt] = useState('');
  const [nowMs, setNowMs] = useState(Date.now());
  const tickRef = useRef(null);

  // Update 'now' every second for relative calculations
  useEffect(() => {
    tickRef.current = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(tickRef.current);
  }, []);

  // Parse timestamp input
  useEffect(() => {
    if (!tsInput.trim()) { setResolvedTsMs(null); setErrorTs(''); return; }
    if (!isNumeric(tsInput)) { setErrorTs('Not a number'); setResolvedTsMs(null); return; }
    setErrorTs('');
    const num = Number(tsInput.trim());
    // Heuristic: if length >= 13 or value > year 3000 in seconds treat as ms
    const ms = num < 1e12 ? (num * 1000) : num; // assume seconds if smaller than trillion
    setResolvedTsMs(ms);
  }, [tsInput]);

  // Parse datetime string input
  useEffect(() => {
    if (!dtInput.trim()) { setResolvedDtMs(null); setErrorDt(''); return; }
    const parsed = parseInputDate(dtInput.trim());
    if (parsed === null) { setErrorDt('Unparseable date'); setResolvedDtMs(null); return; }
    setErrorDt('');
    setResolvedDtMs(parsed);
  }, [dtInput]);

  const formatDetails = (ms) => {
    if (ms === null) return null;
    const d = new Date(ms);
    return {
      isoUTC: d.toISOString(),
      locale: d.toLocaleString(),
      weekday: new Intl.DateTimeFormat(undefined, { weekday: 'long'}).format(d),
      epochSeconds: Math.floor(ms / 1000),
      epochMilliseconds: ms,
      relative: humanRelative(ms, nowMs)
    };
  };

  const tsInfo = formatDetails(resolvedTsMs);
  const dtInfo = formatDetails(resolvedDtMs);

  const nowInfo = formatDetails(nowMs);

  return (
    <div className="tool-container">
      <div className="tool-content">
        <h2 className="tool-title">Date / Time</h2>
        <p className="text-xs text-gray-600 dark:text-gray-400">Convert between Unix timestamps and human-readable datetimes. All calculations are local.</p>

        {/* Two Column Inputs */}
        <div className="grid-2col">
          {/* TIMESTAMP INPUT */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Timestamp → Date</span>
            </div>
            <input
              value={tsInput}
              onChange={e=>setTsInput(e.target.value)}
              placeholder="Enter unix timestamp (seconds or ms)"
              className="w-full text-xs font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-jwtBlue"
              spellCheck="false"
            />
            {errorTs && <div className="mt-2 text-[10px] text-red-600 font-mono">{errorTs}</div>}
            {tsInfo && !errorTs && (
              <div className="mt-3 font-mono text-[11px] break-all space-y-1">
                <div><span className="font-bold">ISO UTC:</span> {tsInfo.isoUTC}</div>
                <div><span className="font-bold">Local:</span> {tsInfo.locale}</div>
                <div><span className="font-bold">Weekday:</span> {tsInfo.weekday}</div>
                <div><span className="font-bold">Epoch Seconds:</span> {tsInfo.epochSeconds}</div>
                <div><span className="font-bold">Epoch Milliseconds:</span> {tsInfo.epochMilliseconds}</div>
                <div><span className="font-bold">Relative:</span> {tsInfo.relative}</div>
              </div>
            )}
          </div>

          {/* DATETIME INPUT */}
          <div className="card">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-gray-500 dark:text-gray-400">Date → Unix Timestamp</span>
            </div>
            <input
              value={dtInput}
              onChange={e=>setDtInput(e.target.value)}
              placeholder="Enter date string (ISO, YYYY-MM-DD, RFC2822, etc.)"
              className="w-full text-xs font-mono px-3 py-2 rounded border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-jwtPurple"
              spellCheck="false"
            />
            {errorDt && <div className="mt-2 text-[10px] text-red-600 font-mono">{errorDt}</div>}
            {dtInfo && !errorDt && (
              <div className="mt-3 font-mono text-[11px] break-all space-y-1">
                <div><span className="font-bold">ISO UTC:</span> {dtInfo.isoUTC}</div>
                <div><span className="font-bold">Local:</span> {dtInfo.locale}</div>
                <div><span className="font-bold">Weekday:</span> {dtInfo.weekday}</div>
                <div><span className="font-bold">Epoch Seconds:</span> {dtInfo.epochSeconds}</div>
                <div><span className="font-bold">Epoch Milliseconds:</span> {dtInfo.epochMilliseconds}</div>
                <div><span className="font-bold">Relative:</span> {dtInfo.relative}</div>
              </div>
            )}
          </div>
        </div>

        {/* NOW SECTION BELOW */}
        <div className="card">
          <div className="text-xs font-bold mb-2 text-gray-500 dark:text-gray-400">Current Time (Browser)</div>
          <div className="font-mono text-[11px] break-all space-y-1">
            <div><span className="font-bold">ISO UTC:</span> {nowInfo.isoUTC}</div>
            <div><span className="font-bold">Local:</span> {nowInfo.locale}</div>
            <div><span className="font-bold">Weekday:</span> {nowInfo.weekday}</div>
            <div><span className="font-bold">Epoch Seconds:</span> {nowInfo.epochSeconds}</div>
            <div><span className="font-bold">Epoch Milliseconds:</span> {nowInfo.epochMilliseconds}</div>
          </div>
        </div>

        <div className="text-[10px] text-gray-500 dark:text-gray-400 font-mono">Parsing uses built-in Date; timezone conversions use browser locale and UTC ISO.</div>
      </div>
    </div>
  );
};

export default DateTimeTool;

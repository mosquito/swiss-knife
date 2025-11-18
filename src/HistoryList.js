import React, { useEffect, useMemo, useRef, useState } from 'react';

// Generic, reusable history component that stores items in localStorage.
// - Deduplicates based on a provided dedupeKey(item) or JSON.stringify(item).
// - Puts most recent at the top. Limits to `max` items.
// - Accepts `newItem` prop; when it changes, it's added to history with dedup.
// - Renders a simple list with Restore/Delete controls.

const defaultDedupeKey = (item) => {
  try { return JSON.stringify(item); } catch { return String(item); }
};

const defaultRenderLabel = (item) => {
  try { return <span className="font-mono text-[11px]">{JSON.stringify(item)}</span>; }
  catch { return <span className="font-mono text-[11px]">{String(item)}</span>; }
};

const HistoryList = ({
  storageKey,
  title = 'History',
  newItem = null,
  max = 20,
  dedupeKey = defaultDedupeKey,
  renderLabel = defaultRenderLabel,
  onRestore = () => {},
  children, // optional render-prop for full control over rendering
}) => {
  const [items, setItems] = useState([]); // array of { value, ts }
  const lastKeyRef = useRef('');

  // Load initial items
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setItems(arr);
      }
    } catch {}
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    try { localStorage.setItem(storageKey, JSON.stringify(items)); } catch {}
  }, [items, storageKey]);

  // Add new item when it changes
  useEffect(() => {
    if (newItem == null) return;
    const k = dedupeKey(newItem);
    if (k === lastKeyRef.current) return; // avoid double add on same render
    lastKeyRef.current = k;
    setItems((prev) => {
      const next = prev.filter((it) => {
        try { return dedupeKey(it.value) !== k; } catch { return true; }
      });
      next.unshift({ value: newItem, ts: Date.now() });
      return next.slice(0, max);
    });
  }, [newItem, dedupeKey, max]);

  const handleClear = () => setItems([]);
  const handleDelete = (idx) => setItems((prev) => prev.filter((_, i) => i !== idx));

  // Headless mode: let the parent render everything, providing operations and data.
  if (typeof children === 'function') {
    return children({
      items, // [{ value, ts }]
      clear: handleClear,
      deleteAt: handleDelete,
      restore: (value, index) => onRestore(value, index),
    });
  }

  return (
    <div className="mt-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-600 dark:text-gray-400">{title}</div>
        <button onClick={handleClear} className="text-[10px] px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:opacity-90">Clear</button>
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-gray-500">No history yet.</div>
      ) : (
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={it.ts + '-' + idx} className="flex items-center justify-between text-[11px] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded px-3 py-2">
              <div className="truncate">{renderLabel(it.value)}</div>
              <div className="flex items-center gap-2">
                <button onClick={() => onRestore(it.value)} className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:opacity-90">Restore</button>
                <button onClick={() => handleDelete(idx)} className="text-xs px-2 py-1 rounded bg-red-200 dark:bg-red-800/60 text-red-800 dark:text-red-200 hover:opacity-90">Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default HistoryList;

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

const parseJson = (raw) => JSON.parse(raw);
const stringifyJson = (value) => JSON.stringify(value);

export const useDebouncedEffect = (effect, delay, dependencies) => {
  const effectRef = useRef(effect);
  effectRef.current = effect;

  useEffect(() => {
    const timeout = setTimeout(() => effectRef.current(), delay);
    return () => clearTimeout(timeout);
  }, [delay, ...dependencies]);
};

export const useStoredState = (
  storageKey,
  initialValue,
  {
    parse = parseJson,
    stringify = stringifyJson,
    validate = () => true,
  } = {},
) => {
  const [value, setValue] = useState(() => {
    const fallback = typeof initialValue === 'function' ? initialValue() : initialValue;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw === null) return fallback;
      const stored = parse(raw);
      return validate(stored) ? stored : fallback;
    } catch {
      return fallback;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, stringify(value));
    } catch {}
  }, [storageKey, stringify, value]);

  return [value, setValue];
};

export const useStoredSettings = (
  storageKey,
  value,
  applyStored,
  {
    parse = parseJson,
    stringify = stringifyJson,
  } = {},
) => {
  const skipInitialPersistRef = useRef(true);
  let serialized;
  try {
    serialized = stringify(value);
  } catch {
    serialized = undefined;
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) applyStored(parse(raw));
    } catch {}
  }, [storageKey]);

  useEffect(() => {
    if (skipInitialPersistRef.current) {
      skipInitialPersistRef.current = false;
      return;
    }
    if (serialized === undefined) return;
    try {
      localStorage.setItem(storageKey, serialized);
    } catch {}
  }, [serialized, storageKey]);
};

const darkModeListeners = new Set();
let darkModeObserver = null;

const getDarkModeSnapshot = () => document.documentElement.classList.contains('dark');

const subscribeToDarkMode = (listener) => {
  darkModeListeners.add(listener);
  if (!darkModeObserver) {
    darkModeObserver = new MutationObserver(() => {
      darkModeListeners.forEach((notify) => notify());
    });
    darkModeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
    });
  }

  return () => {
    darkModeListeners.delete(listener);
    if (darkModeListeners.size === 0) {
      darkModeObserver.disconnect();
      darkModeObserver = null;
    }
  };
};

export const useDarkMode = () => useSyncExternalStore(
  subscribeToDarkMode,
  getDarkModeSnapshot,
  getDarkModeSnapshot,
);

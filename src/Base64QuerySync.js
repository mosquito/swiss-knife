import React, { useEffect, useRef } from 'react';

// Global registry of active query params
const activeParams = new Set();

// Pending clear timeout - cancelled if a tool sets its param
let pendingClearTimeout = null;

// Strip base64 padding (can be restored from length)
const stripPadding = (str) => str.replace(/=+$/, '');

// Restore base64 padding based on string length
const restorePadding = (str) => {
  const pad = str.length % 4;
  if (pad === 2) return str + '==';
  if (pad === 3) return str + '=';
  return str;
};

// Update URL with only the specified param, clearing ALL other params
const updateUrl = (queryParam, encoded) => {
  const newUrl = new URL(window.location.origin + window.location.pathname);
  // Only set this tool's param, all others are cleared
  if (encoded) {
    newUrl.searchParams.set(queryParam, encoded);
  }
  newUrl.hash = window.location.hash;
  window.history.replaceState({}, '', newUrl);
};

// Clear all query params from URL (keep hash)
const clearAllParams = () => {
  const newUrl = new URL(window.location.origin + window.location.pathname);
  newUrl.hash = window.location.hash;
  window.history.replaceState({}, '', newUrl);
};

// Check if this tool is currently active based on URL hash
const isToolActive = (toolHash) => {
  if (!toolHash) return true; // No hash specified = always active
  const currentHash = window.location.hash;
  // Handle both '#encode' and '#encode-decode' style hashes
  return currentHash === toolHash || currentHash.startsWith(toolHash + '-') || currentHash.startsWith(toolHash + '/');
};

// Generic component to sync a value with a base64 encoded URL query param.
// Only processes if this tool is active (hash matches). Clears other params on update.
export default function Base64QuerySync({
  value,
  encode,       // (value) => string to encode
  decode,       // (decodedString) => parsed value OR undefined if incompatible
  onDecoded,    // (parsedValue) => void, called if decode succeeded
  queryParam = 'value', // which query param name to use
  toolHash = null, // hash that identifies this tool, e.g., '#encode'
  updateOnMount = true,
}) {
  const lastEncodedRef = useRef(null);
  const mountedRef = useRef(false);
  const wasActiveRef = useRef(false);

  // Register this param and try to decode on mount
  useEffect(() => {
    activeParams.add(queryParam);

    const isActive = isToolActive(toolHash);
    wasActiveRef.current = isActive;

    // Only process if this tool is active
    if (!isActive) {
      return () => { activeParams.delete(queryParam); };
    }

    const url = new URL(window.location.href);
    const raw = url.searchParams.get(queryParam);
    let decodedOk = false;

    if (raw) {
      try {
        const decodedStr = atob(restorePadding(raw));
        const parsed = decode(decodedStr);
        if (parsed !== undefined) {
          decodedOk = true;
          lastEncodedRef.current = raw;
          onDecoded && onDecoded(parsed);
        }
      } catch {
        // ignore
      }
    }

    // Clear other params if there are any (this tool is now active)
    const currentParams = new URL(window.location.href).searchParams;
    const hasOtherParams = Array.from(currentParams.keys()).some(k => k !== queryParam);
    if (hasOtherParams) {
      if (decodedOk) {
        // Keep our param, clear others
        updateUrl(queryParam, raw);
      } else if (updateOnMount) {
        // Set our param, clear others
        try {
          const encoded = stripPadding(btoa(encode(value)));
          lastEncodedRef.current = encoded;
          updateUrl(queryParam, encoded);
        } catch {
          clearAllParams();
        }
      } else {
        clearAllParams();
      }
    } else if (updateOnMount && !decodedOk) {
      try {
        const encoded = stripPadding(btoa(encode(value)));
        lastEncodedRef.current = encoded;
        updateUrl(queryParam, encoded);
      } catch {
        // ignore
      }
    }

    // Mark as mounted after delay to let state updates settle
    setTimeout(() => { mountedRef.current = true; }, 100);

    // Cleanup: unregister on unmount
    return () => {
      activeParams.delete(queryParam);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Watch for hash changes - when this tool becomes active, set its URL param
  useEffect(() => {
    const handleHashChange = () => {
      const isActive = isToolActive(toolHash);
      const wasActive = wasActiveRef.current;
      wasActiveRef.current = isActive;

      // Tool just became active - set our param (updateUrl clears others)
      if (isActive && !wasActive) {
        // Cancel any pending clear from other tools
        if (pendingClearTimeout) {
          clearTimeout(pendingClearTimeout);
          pendingClearTimeout = null;
        }
        if (value !== undefined) {
          try {
            const encoded = stripPadding(btoa(encode(value)));
            lastEncodedRef.current = encoded;
            updateUrl(queryParam, encoded);
          } catch {
            clearAllParams();
          }
        } else {
          clearAllParams();
        }
      }

      // Tool just became inactive - schedule a clear (will be cancelled if another tool sets params)
      if (!isActive && wasActive) {
        if (pendingClearTimeout) clearTimeout(pendingClearTimeout);
        pendingClearTimeout = setTimeout(() => {
          clearAllParams();
          pendingClearTimeout = null;
        }, 50);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [toolHash, queryParam, value, encode]);

  // On value change: update URL (but only after mount is complete and tool is active)
  useEffect(() => {
    if (!mountedRef.current) return;
    if (!isToolActive(toolHash)) return;
    if (value === undefined) return;

    try {
      const encoded = stripPadding(btoa(encode(value)));
      // Skip if value encodes to same as last time
      if (encoded === lastEncodedRef.current) return;
      lastEncodedRef.current = encoded;
      updateUrl(queryParam, encoded);
    } catch {
      // ignore
    }
  }, [value, encode, queryParam, toolHash]);

  return null;
}

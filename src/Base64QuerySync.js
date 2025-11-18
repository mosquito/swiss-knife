import React, { useEffect } from 'react';

// Generic component to sync a value with a base64 encoded URL query param.
// It decodes existing param on mount (calling onDecoded) and then keeps param
// updated whenever value changes. If decoding fails for an existing param from
// a different tool, it overwrites the param with this tool's representation.
// When updating, all other query params except the specified one are removed.
export default function Base64QuerySync({
  value,
  encode,       // (value) => string to encode
  decode,       // (decodedString) => parsed value OR undefined if incompatible
  onDecoded,    // (parsedValue) => void, called if decode succeeded
  queryParam = 'value', // which query param name to use (same as param by default)
  updateOnMount = true,
}) {
  useEffect(() => {
    const url = new URL(window.location.href);
    const raw = url.searchParams.get(queryParam);
    let decodedOk = false;

    if (raw) {
      try {
        const decodedStr = atob(raw);
        const parsed = decode(decodedStr);
        if (parsed !== undefined) {
          decodedOk = true;
          onDecoded && onDecoded(parsed);
        }
      } catch {
        // ignore
      }
    }

    if (updateOnMount && (!raw || !decodedOk)) {
      // Overwrite with current tool's value representation
      try {
        const encoded = btoa(encode(value));
        // Clear all params except the current one, preserve hash
        const newUrl = new URL(window.location.origin + window.location.pathname);
        newUrl.searchParams.set(queryParam, encoded);
        newUrl.hash = window.location.hash;
        window.history.replaceState({}, '', newUrl);
      } catch {
        // ignore
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (value === undefined) return;
    try {
      const encoded = btoa(encode(value));
      // Clear all params except the current one, preserve hash
      const newUrl = new URL(window.location.origin + window.location.pathname);
      newUrl.searchParams.set(queryParam, encoded);
      newUrl.hash = window.location.hash;
      window.history.replaceState({}, '', newUrl);
    } catch {
      // ignore
    }
  }, [value, encode, queryParam]);

  return null;
}

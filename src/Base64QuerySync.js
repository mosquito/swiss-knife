import { useEffect, useRef, useState } from 'react';

const stripPadding = (value) => value.replace(/=+$/, '');

const restorePadding = (value) => {
  const remainder = value.length % 4;
  if (remainder === 2) return value + '==';
  if (remainder === 3) return value + '=';
  return value;
};

const encodeBase64Utf8 = (value) => {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return stripPadding(btoa(binary));
};

const decodeBase64Candidates = (value) => {
  const binary = atob(restorePadding(value));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const utf8 = new TextDecoder().decode(bytes);
  return utf8 === binary ? [utf8] : [utf8, binary];
};

const updateUrl = (queryParam, encoded) => {
  const newUrl = new URL(window.location.origin + window.location.pathname);
  if (encoded) newUrl.searchParams.set(queryParam, encoded);
  newUrl.hash = window.location.hash;
  window.history.replaceState({}, '', newUrl);
};

const clearAllParams = () => {
  const newUrl = new URL(window.location.origin + window.location.pathname);
  newUrl.hash = window.location.hash;
  window.history.replaceState({}, '', newUrl);
};

const isToolActive = (toolHash) => {
  if (!toolHash) return true;
  const currentHash = window.location.hash;
  return currentHash === toolHash
    || currentHash.startsWith(toolHash + '-')
    || currentHash.startsWith(toolHash + '/');
};

export const useShareableToolState = ({
  value,
  encode,
  decode,
  onDecoded,
  onHydrated,
  queryParam = 'value',
  toolHash = null,
  updateOnMount = true,
}) => {
  const [hydrated, setHydrated] = useState(false);
  const valueRef = useRef(value);
  const encodeRef = useRef(encode);
  const decodeRef = useRef(decode);
  const onDecodedRef = useRef(onDecoded);
  const onHydratedRef = useRef(onHydrated);
  const lastEncodedRef = useRef(null);
  const wasActiveRef = useRef(false);
  const skipInitialValueEffectRef = useRef(true);

  valueRef.current = value;
  encodeRef.current = encode;
  decodeRef.current = decode;
  onDecodedRef.current = onDecoded;
  onHydratedRef.current = onHydrated;

  useEffect(() => {
    const active = isToolActive(toolHash);
    wasActiveRef.current = active;
    let decoded = false;

    if (active) {
      const url = new URL(window.location.href);
      const raw = url.searchParams.get(queryParam);

      if (raw) {
        try {
          for (const candidate of decodeBase64Candidates(raw)) {
            try {
              const parsed = decodeRef.current(candidate);
              if (parsed !== undefined) {
                decoded = true;
                lastEncodedRef.current = raw;
                onDecodedRef.current?.(parsed);
                break;
              }
            } catch {}
          }
        } catch {}
      }

      const hasOtherParams = Array.from(url.searchParams.keys())
        .some((key) => key !== queryParam);

      if (decoded && hasOtherParams) {
        updateUrl(queryParam, raw);
      } else if (!decoded && updateOnMount) {
        try {
          const encoded = encodeBase64Utf8(encodeRef.current(valueRef.current));
          lastEncodedRef.current = encoded;
          updateUrl(queryParam, encoded);
        } catch {
          if (hasOtherParams) clearAllParams();
        }
      } else if (hasOtherParams) {
        clearAllParams();
      }
    }

    setHydrated(true);
    onHydratedRef.current?.({ active, decoded });
  }, [queryParam, toolHash, updateOnMount]);

  useEffect(() => {
    const handleHashChange = () => {
      const active = isToolActive(toolHash);
      const wasActive = wasActiveRef.current;
      wasActiveRef.current = active;

      if (active && !wasActive) {
        try {
          const encoded = encodeBase64Utf8(encodeRef.current(valueRef.current));
          lastEncodedRef.current = encoded;
          updateUrl(queryParam, encoded);
        } catch {
          clearAllParams();
        }
      } else if (!active && wasActive) {
        setTimeout(() => {
          const url = new URL(window.location.href);
          if (url.searchParams.has(queryParam)) clearAllParams();
        }, 0);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, [queryParam, toolHash]);

  useEffect(() => {
    if (skipInitialValueEffectRef.current) {
      skipInitialValueEffectRef.current = false;
      return;
    }
    if (!isToolActive(toolHash) || value === undefined) return;

    try {
      const encoded = encodeBase64Utf8(encode(value));
      if (encoded === lastEncodedRef.current) return;
      lastEncodedRef.current = encoded;
      updateUrl(queryParam, encoded);
    } catch {}
  }, [value, encode, queryParam, toolHash]);

  return { hydrated };
};

export default function Base64QuerySync(props) {
  useShareableToolState(props);
  return null;
}

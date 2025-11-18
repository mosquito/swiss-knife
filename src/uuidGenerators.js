/**
 * UUID Generators using official uuid package
 */
import { v1 as uuidv1, v3 as uuidv3, v4 as uuidv4, v5 as uuidv5, v6 as uuidv6, v7 as uuidv7, validate, version } from 'uuid';

export { validate, version };

// Standard UUID namespaces (RFC 4122)
export const NAMESPACE_DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_OID = '6ba7b812-9dad-11d1-80b4-00c04fd430c8';
export const NAMESPACE_X500 = '6ba7b814-9dad-11d1-80b4-00c04fd430c8';

// UUID v1: timestamp-based
export function generateUUIDv1() {
  return uuidv1();
}

// UUID v3: MD5 hash-based (namespace)
export function generateUUIDv3(name, namespace = NAMESPACE_DNS) {
  return uuidv3(name, namespace);
}

// UUID v4: random
export function generateUUIDv4() {
  return uuidv4();
}

// UUID v5: SHA-1 hash-based (namespace)
export function generateUUIDv5(name, namespace = NAMESPACE_DNS) {
  return uuidv5(name, namespace);
}

// UUID v6: timestamp-ordered (reordered v1)
export function generateUUIDv6() {
  return uuidv6();
}

// UUID v7: timestamp-based with random
export function generateUUIDv7() {
  return uuidv7();
}

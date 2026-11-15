import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
let calls = 0;
const subtle = new Proxy(webcrypto.subtle, {
  get(target, key) {
    if (key === 'deriveBits') return async (algorithm, ...args) => {
      if (algorithm.name === 'PBKDF2') {
        assert.ok(algorithm.iterations <= 100000, 'Cloudflare Workers PBKDF2 iteration limit exceeded');
        calls++;
      }
      return target.deriveBits(algorithm, ...args);
    };
    const value = Reflect.get(target, key, target);
    return typeof value === 'function' ? value.bind(target) : value;
  }
});
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {
  subtle, getRandomValues: webcrypto.getRandomValues.bind(webcrypto)
}});
await import('./accounts-test.mjs');
await import('./account-admin-test.mjs');
assert.ok(calls > 10);
console.log('PASS: registration, login, recovery, password changes and admin reset stay within the Workers password hashing limit.');

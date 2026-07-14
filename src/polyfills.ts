// Must be imported FIRST (before anything that pulls in @ton/core), so that
// @ton/core's top-level `Buffer` reference resolves in the browser.
import { Buffer } from 'buffer';

if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}
if (typeof (globalThis as any).global === 'undefined') {
  (globalThis as any).global = globalThis;
}

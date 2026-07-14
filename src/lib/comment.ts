import { beginCell } from '@ton/core';

/**
 * Build a TON text-comment payload (base64 BOC) carrying the order ref, so the
 * backend payment watcher can reconcile the on-chain payment to the order —
 * the same "Ref#…" pattern Fragment itself uses.
 */
export function commentPayload(text: string): string {
  return beginCell().storeUint(0, 32).storeStringTail(text).endCell().toBoc().toString('base64');
}

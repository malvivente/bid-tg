/**
 * Tiny, dependency-free TON address helpers (browser-safe, no Buffer / no @ton libs).
 * Only used for DISPLAY — converting TonAPI raw `0:<hex>` addresses to user-friendly
 * base64url. The heavy crypto lives in the backend; TonConnect handles real transfers.
 */

function crc16(data: Uint8Array): number {
  let crc = 0;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
    }
  }
  return crc & 0xffff;
}

function bytesToB64Url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Convert a raw `0:<hex>` address to user-friendly base64url (non-bounceable by default). */
export function rawToFriendly(raw: string, opts?: { bounceable?: boolean }): string {
  try {
    if (!raw.includes(':')) return raw; // already friendly
    const [wcStr, hashHex] = raw.split(':');
    if (!hashHex || hashHex.length !== 64) return raw;
    const workchain = parseInt(wcStr, 10);
    const bytes = new Uint8Array(36);
    bytes[0] = opts?.bounceable ? 0x11 : 0x51;
    bytes[1] = workchain & 0xff;
    for (let i = 0; i < 32; i++) bytes[i + 2] = parseInt(hashHex.substr(i * 2, 2), 16);
    const crc = crc16(bytes.slice(0, 34));
    bytes[34] = (crc >> 8) & 0xff;
    bytes[35] = crc & 0xff;
    return bytesToB64Url(bytes);
  } catch {
    return raw;
  }
}

/** True if the string looks like a valid TON address (raw or user-friendly). */
export function isValidAddress(addr: string): boolean {
  const a = addr.trim();
  if (/^-?\d+:[0-9a-fA-F]{64}$/.test(a)) return true;
  return /^[A-Za-z0-9_-]{48}$/.test(a);
}

/** Normalize any address form to user-friendly base64url. */
export function toFriendly(addr: string, bounceable = false): string {
  return addr.includes(':') ? rawToFriendly(addr, { bounceable }) : addr;
}

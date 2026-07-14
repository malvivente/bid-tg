export const NANO = 1_000_000_000;

/** nanoTON (number|bigint) → TON number */
export function toTon(nano: number | bigint): number {
  return Number(nano) / NANO;
}

/** TON → nanoTON bigint */
export function toNano(ton: number): bigint {
  return BigInt(Math.round(ton * NANO));
}

/**
 * Compact TON display. Small amounts keep up to 2 decimals; large amounts round up
 * (matching how auction figures are usually shown). Never trailing zeros.
 */
export function fmtTon(nano: number | bigint, opts?: { decimals?: number }): string {
  const ton = toTon(nano);
  if (opts?.decimals != null) {
    return trimZeros(ton.toFixed(opts.decimals));
  }
  if (ton === 0) return '0';
  if (ton < 1) return trimZeros(ton.toFixed(3));
  if (ton < 1000) return trimZeros(ton.toFixed(2));
  return Math.round(ton).toLocaleString('en-US');
}

function trimZeros(s: string): string {
  return s.replace(/\.?0+$/, '');
}

export function fmtUsd(nano: number | bigint, tonToUsd: number): string {
  const usd = toTon(nano) * tonToUsd;
  if (usd < 1) return usd.toFixed(2);
  if (usd < 1000) return usd.toFixed(1).replace(/\.0$/, '');
  return Math.round(usd).toLocaleString('en-US');
}

export function fmtInt(n: number): string {
  return n.toLocaleString('en-US');
}

/** Countdown text for an auction end time. */
export function endsText(endUnix: number): { text: string; urgent: boolean; closed: boolean } {
  const now = Math.floor(Date.now() / 1000);
  const left = endUnix - now;
  if (left <= 0) return { text: 'Closed', urgent: true, closed: true };
  const d = Math.floor(left / 86400);
  const h = Math.floor((left % 86400) / 3600);
  const m = Math.floor((left % 3600) / 60);
  if (left < 3600) return { text: `${m}m ${left % 60}s`, urgent: true, closed: false };
  if (d < 1) return { text: `${h}h ${m}m`, urgent: true, closed: false };
  return { text: `${d}d ${h}h`, urgent: false, closed: false };
}

export function fmtDate(unix: number): string {
  const d = new Date(unix * 1000);
  return (
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  );
}

/** Human label for a collectible: "@name" for usernames, "+888 …" for numbers, "Name #n" for gifts. */
export function itemLabel(a: { kind?: string; username: string; display?: string }): string {
  if (a.kind === 'number') return a.display ?? `+888 ${a.username.replace(/^888/, '')}`;
  if (a.kind === 'gift') return a.display ?? a.username;
  return `@${a.username}`;
}

export function shortAddr(addr: string, head = 4, tail = 4): string {
  if (!addr) return '';
  if (addr.length <= head + tail + 1) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

/** Deterministic ref code for reconciling payments (client-side placeholder). */
export function makeRef(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (Math.imul(31, h) + seed.charCodeAt(i)) | 0;
  return 'G' + (h >>> 0).toString(36).toUpperCase().padStart(6, '0').slice(0, 8);
}

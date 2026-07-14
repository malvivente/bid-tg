import type { ItemKind } from '@/types';
import type {
  UsernameInfo,
  UsernameStatus,
  NumberListing,
  GiftCollection,
  GiftItem,
  GiftSearchResult,
  GiftAttributes,
  GiftQuery,
} from './api';

/**
 * CLIENT-SIDE Fragment resolver — parses a public item page's HTML to get the TRUE
 * status + price, so search works with real data even without the backend running.
 *
 * Fragment blocks browser cross-origin fetches, so we go through a same-origin proxy:
 *   - dev: Vite proxies `/frag/*` → `https://fragment.com/*` (see vite.config.ts)
 *   - prod: set VITE_FRAGMENT_PROXY to a CORS proxy, or use the backend (VITE_API_BASE_URL)
 *
 * The parser MUST stay in sync with backend/src/lib/fragmentPublic.ts (same page markup).
 */

const PROXY = (import.meta.env.VITE_FRAGMENT_PROXY as string) || '/frag';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

function toNano(disp: string): string {
  const n = parseFloat(disp.replace(/,/g, '').trim());
  if (!isFinite(n) || n <= 0) return '0';
  return BigInt(Math.round(n * 1e9)).toString();
}

function mapStatus(text: string): UsernameStatus {
  const t = text.toLowerCase();
  if (t.includes('on auction') || t === 'auction') return 'auction';
  if (t.includes('available')) return 'available';
  if (t.includes('for sale') || t.includes('on sale') || t.includes('resale')) return 'onsale';
  if (t.includes('taken')) return 'taken';
  if (t.includes('sold')) return 'sold';
  if (t.includes('unavailable')) return 'unavailable';
  return 'unknown';
}

function firstBidInfoTable(h: string): string {
  const i = h.indexOf('tm-section-bid-info');
  const from = i >= 0 ? i : 0;
  const start = h.indexOf('<table', from);
  const end = h.indexOf('</table>', start);
  return start >= 0 && end >= 0 ? h.slice(start, end) : '';
}

export function numberDisplay(digits: string): string {
  const rest = digits.slice(3);
  return `+888 ${rest.replace(/(\d{4})(?=\d)/g, '$1 ').trim()}`;
}

/** Parse a fetched item page into status + prices. Shared shape with the backend resolver. */
export function parseItemPage(h: string, kind: ItemKind, id: string): UsernameInfo {
  const display = kind === 'number' ? numberDisplay(id) : id;

  const sm = h.match(
    /tm-section-header-status[^"]*">\s*(On auction|Available|On sale|For sale|Resale|Taken|Sold|Unavailable)\s*</i,
  );
  const status = mapStatus(sm?.[1] ?? '');

  const table = firstBidInfoTable(h);
  const heads = [...table.matchAll(/<th[^>]*>([^<]+)<\/th>/g)].map((m) => m[1].trim());
  const cells = [...table.matchAll(/table-cell-value tm-value[^"]*">([^<]+)<\/div>/g)].map((m) => m[1].trim());
  const at = (label: string) => {
    const i = heads.findIndex((x) => x.toLowerCase() === label.toLowerCase());
    return i >= 0 ? cells[i] : undefined;
  };

  const info: UsernameInfo = { name: id, kind, display, status };

  if (status === 'available') {
    const min = at('Minimum Bid') ?? cells[0];
    if (min) info.minBidNano = toNano(min);
  } else if (status === 'auction') {
    const hi = at('Highest Bid');
    const min = at('Minimum Bid');
    if (hi) info.highestBidNano = toNano(hi);
    if (min) info.minBidNano = toNano(min);
    info.bidStepPct = 5;
    const stepDesc = table.match(/Bid Step[\s\S]{0,220}?table-cell-desc">[^0-9]*([0-9.]+)\s*%/i);
    if (stepDesc) info.bidStepPct = parseFloat(stepDesc[1]);
  } else if (status === 'onsale') {
    const price = at('Price') ?? at('Sale Price') ?? at('Minimum Bid') ?? cells[0];
    if (price) info.buyNowNano = toNano(price);
  } else if (status === 'sold') {
    // surface the last sale price for context (not for sale)
    const last = at('Sale Price') ?? cells[0];
    if (last) info.highestBidNano = toNano(last);
  }

  const usd = h.match(/&#036;([\d.,]+)/) || h.match(/\$([\d.,]+)/);
  if (usd) info.priceUsd = parseFloat(usd[1].replace(/,/g, ''));

  return info;
}

function pagePath(kind: ItemKind, id: string): string {
  if (kind === 'number') return `/number/${encodeURIComponent(id)}`;
  if (kind === 'gift') return `/gift/${encodeURIComponent(id)}`;
  return `/username/${encodeURIComponent(id)}`;
}

/** Fetch + parse a single item's live Fragment page through the proxy. Throws on network failure. */
export async function resolveItemLive(kind: ItemKind, id: string): Promise<UsernameInfo> {
  const res = await fetch(`${PROXY}${pagePath(kind, id)}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fragment ${res.status}`);
  const html = await res.text();
  if (html.trimStart().startsWith('{')) throw new Error('proxy returned JSON, not a page');
  return parseItemPage(html, kind, id);
}

/** Scrape the live +888 numbers listing through the proxy. */
export async function listNumbersLive(sort = 'ending', limit = 60): Promise<NumberListing[]> {
  const res = await fetch(`${PROXY}/numbers?sort=${encodeURIComponent(sort)}`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fragment ${res.status}`);
  const h = await res.text();

  const out: NumberListing[] = [];
  const seen = new Set<string>();
  for (const m of h.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const row = m[1];
    const href = row.match(/\/number\/(\d+)/);
    if (!href) continue;
    const number = href[1];
    if (seen.has(number)) continue;
    seen.add(number);

    const display = row.match(/table-cell-value tm-value">(\+888[^<]+)</)?.[1]?.trim() || numberDisplay(number);
    const statusThin = row.match(/table-cell-status-thin">([^<]+)</)?.[1]?.trim();
    const statusRaw = statusThin ?? (/tm-timer\b/.test(row) ? 'auction' : '');
    const priceDisp = row.match(/icon-before icon-ton">([\d.,]+)</)?.[1];
    const iso = row.match(/datetime="([^"]+)"/)?.[1];
    const usd = row.match(/&#036;([\d.,]+)/)?.[1];

    out.push({
      number,
      display,
      priceNano: priceDisp ? toNano(priceDisp) : '0',
      endsAt: iso ? Math.floor(new Date(iso).getTime() / 1000) : 0,
      status: mapStatus(statusRaw),
      ...(usd ? { priceUsd: parseFloat(usd.replace(/,/g, '')) } : {}),
    });
    if (out.length >= limit) break;
  }
  return out;
}

/** Gift collections index (name / count / thumb), scraped via the proxy. */
export async function listGiftCollectionsLive(): Promise<GiftCollection[]> {
  const res = await fetch(`${PROXY}/gifts`, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`Fragment ${res.status}`);
  const h = await res.text();
  const out: GiftCollection[] = [];
  const seen = new Set<string>();
  for (const m of h.matchAll(
    /<a[^>]*href="\/gifts\/([a-z0-9_]+)"[^>]*class="[^"]*tm-main-filters-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    const slug = m[1];
    if (seen.has(slug)) continue;
    seen.add(slug);
    const inner = m[2];
    const name = inner.match(/tm-main-filters-name">([^<]+)</)?.[1]?.trim() ?? slug;
    const count = parseInt((inner.match(/tm-main-filters-count">([\d,]+)</)?.[1] ?? '0').replace(/,/g, ''), 10);
    out.push({ slug, name, count, image: `https://fragment.com/file/gifts/${slug}/thumb.webp` });
  }
  return out;
}

function giftStatus(text: string): UsernameStatus {
  const t = text.toLowerCase();
  if (t.includes('for sale') || t.includes('on sale')) return 'onsale';
  if (t.includes('available') || t.includes('auction')) return 'auction';
  if (t.includes('sold')) return 'sold';
  return 'unknown';
}

function parseGiftGrid(html: string, fallback?: UsernameStatus): GiftItem[] {
  const out: GiftItem[] = [];
  const seen = new Set<string>();
  for (const m of html.matchAll(/<a[^>]*href="\/gift\/([a-z0-9_]+)-(\d+)[^"]*"[^>]*class="[^"]*tm-grid-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g)) {
    const coll = m[1];
    const num = parseInt(m[2], 10);
    const slug = `${coll}-${num}`;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const inner = m[3];
    const name = inner.match(/item-name">([^<]+)</)?.[1]?.trim() ?? coll;
    const priceDisp = inner.match(/tm-grid-item-value tm-value[^>]*>([\d.,]+)</)?.[1];
    const statusTxt = inner.match(/tm-grid-item-status[^>]*>([^<]+)</)?.[1]?.trim();
    out.push({
      slug,
      collection: coll,
      num,
      name,
      priceNano: priceDisp ? toNano(priceDisp) : '0',
      status: statusTxt ? giftStatus(statusTxt) : (fallback ?? 'unknown'),
      image: `https://nft.fragment.com/gift/${slug}.medium.jpg`,
    });
  }
  return out;
}

// Cached anon session hash. The stel_ssid cookie rides along via the /frag proxy
// (Set-Cookie rewritten to survive http localhost), so credentials:'include' resends it.
let giftHash: { hash: string; at: number } | null = null;
async function giftSessionHash(): Promise<string> {
  if (giftHash && Date.now() - giftHash.at < 120_000) return giftHash.hash;
  const res = await fetch(`${PROXY}/gifts`, { credentials: 'include' });
  const html = await res.text();
  const hash = html.match(/api\?hash=([a-f0-9]+)/)?.[1];
  if (!hash) throw new Error('gift session hash not found');
  giftHash = { hash, at: Date.now() };
  return hash;
}

/** Paginated + filtered gift catalog via Fragment searchAuctions, through the proxy. */
export async function giftSearchLive(q: GiftQuery, retry = true): Promise<GiftSearchResult> {
  const hash = await giftSessionHash();
  const collection = q.collection && q.collection !== 'all' ? q.collection : '';
  const referer = collection ? `https://fragment.com/gifts/${collection}` : 'https://fragment.com/gifts';
  const body = new URLSearchParams({
    type: 'gifts',
    collection,
    query: q.query ?? '',
    filter: q.filter ?? '',
    sort: q.sort ?? '',
    'attr[Model]': q.attrs?.Model?.length ? JSON.stringify(q.attrs.Model) : '',
    'attr[Backdrop]': q.attrs?.Backdrop?.length ? JSON.stringify(q.attrs.Backdrop) : '',
    'attr[Symbol]': q.attrs?.Symbol?.length ? JSON.stringify(q.attrs.Symbol) : '',
    method: 'searchAuctions',
  });
  if (q.offset && q.offset > 0) body.set('offset_id', String(q.offset));

  const res = await fetch(`${PROXY}/api?hash=${hash}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'XMLHttpRequest', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'X-Aj-Referer': referer },
    body: body.toString(),
  });
  const json: any = await res.json().catch(() => ({ ok: false }));
  if (!json.ok) {
    if (retry) {
      giftHash = null; // refresh a stale session once
      return giftSearchLive(q, false);
    }
    throw new Error(json.error || 'gift search failed');
  }
  const grid = (json.html || '') + (json.body || '');
  const foot = (json.html || '') + (json.foot || '');
  const fb: UsernameStatus | undefined = q.filter === 'auction' ? 'auction' : q.filter === 'sale' ? 'onsale' : undefined;
  const nextM = foot.match(/data-next-offset="(\d+)"/);
  return { items: parseGiftGrid(grid, fb), nextOffset: nextM ? parseInt(nextM[1], 10) : null };
}

/** Model/Backdrop/Symbol filter values for a collection, via the proxy. */
export async function giftAttributesLive(collection: string): Promise<GiftAttributes> {
  const clean = collection.replace(/[^a-z0-9_]/gi, '').toLowerCase();
  const empty: GiftAttributes = { Model: [], Backdrop: [], Symbol: [] };
  if (!clean) return empty;
  const res = await fetch(`${PROXY}/gifts/${clean}`, { credentials: 'include' });
  if (!res.ok) return empty;
  const h = await res.text();
  const group = (type: keyof GiftAttributes): string[] => {
    const start = h.indexOf(`data-field="attr[${type}]"`);
    if (start < 0) return [];
    const nexts = (['Model', 'Backdrop', 'Symbol'] as (keyof GiftAttributes)[])
      .map((t) => h.indexOf(`data-field="attr[${t}]"`, start + 1))
      .filter((i) => i > start);
    const end = nexts.length ? Math.min(...nexts) : start + 40000;
    return [...new Set([...h.slice(start, end).matchAll(/js-attribute-item"[^>]*data-value="([^"]+)"/g)].map((m) => m[1]))];
  };
  return { Model: group('Model'), Backdrop: group('Backdrop'), Symbol: group('Symbol') };
}

/** Items for sale in a gift collection, scraped via the proxy. */
export async function listGiftItemsLive(collection: string, sort = 'price_asc', filter = 'sale', limit = 60): Promise<GiftItem[]> {
  const clean = collection.replace(/[^a-z0-9_]/gi, '').toLowerCase();
  const res = await fetch(`${PROXY}/gifts/${clean}?sort=${encodeURIComponent(sort)}&filter=${encodeURIComponent(filter)}`, {
    headers: { 'User-Agent': UA },
  });
  if (!res.ok) throw new Error(`Fragment ${res.status}`);
  const h = await res.text();
  const out: GiftItem[] = [];
  const seen = new Set<string>();
  for (const m of h.matchAll(
    /<a[^>]*href="\/gift\/([a-z0-9_]+)-(\d+)[^"]*"[^>]*class="[^"]*tm-grid-item[^"]*"[^>]*>([\s\S]*?)<\/a>/g,
  )) {
    const coll = m[1];
    const num = parseInt(m[2], 10);
    const slug = `${coll}-${num}`;
    if (seen.has(slug)) continue;
    seen.add(slug);
    const inner = m[3];
    const name = inner.match(/item-name">([^<]+)</)?.[1]?.trim() ?? coll;
    const priceDisp = inner.match(/tm-grid-item-value tm-value[^>]*>([\d.,]+)</)?.[1];
    const statusTxt = inner.match(/tm-grid-item-status[^>]*>([^<]+)</)?.[1]?.trim() ?? '';
    out.push({
      slug,
      collection: coll,
      num,
      name,
      priceNano: priceDisp ? toNano(priceDisp) : '0',
      status: mapStatus(statusTxt),
      image: `https://nft.fragment.com/gift/${slug}.medium.jpg`,
    });
    if (out.length >= limit) break;
  }
  return out;
}

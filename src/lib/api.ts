import type { StarsQuote, PremiumQuote, TopupQuote, BidPrepare, Auction, Order, ItemKind } from '@/types';
import { feeStars, feePremium, feeBid, feeBuyNow, feeAdsTopup, feeStartAuction, TON } from './fee';
import { makeRef } from './format';
import {
  resolveItemLive,
  listNumbersLive,
  listGiftCollectionsLive,
  giftSearchLive,
  giftAttributesLive,
  numberDisplay,
} from './fragment-resolve';

/**
 * bid.tg backend client.
 *
 * When VITE_API_BASE_URL is set, calls the real Fastify backend (which owns the
 * Fragment session cookies + operator wallet). When empty, a built-in MOCK layer
 * lets the whole UI run without a backend — quotes use the real fee engine and
 * plausible prices, so every screen and flow is fully clickable for preview.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL as string) || '';
const TREASURY =
  (import.meta.env.VITE_TREASURY_ADDRESS as string) ||
  'UQA0odVR0IIwT7cZqYn_ugtv5r4RRPPlkdlGt5H5Wa6K8Qez';
const MOCK_HOT_WALLET = 'UQD__god_tg_hot_wallet_placeholder_do_not_send__0000';

export const isMock = !BASE;

// Fragment prices are FIXED IN USD; the GRAM amount floats with the GRAM/USD rate.
// So the mock anchors in USD and divides by the live rate — matching how Fragment works.
// (Real charges always come from Fragment via the backend; these are estimates only.)
// Verified on fragment.com: stars = $0.015/★ (linear); premium 3mo/6mo/12mo = $11.99/$15.99/$28.99.
const STAR_USD = 0.015;
const PREMIUM_USD: Record<number, number> = { 3: 11.99, 6: 15.99, 12: 28.99 };
const FALLBACK_GRAM_USD = 2.5; // only if the live rate is momentarily unavailable

function usdToNano(usd: number, gramUsd: number): bigint {
  const rate = gramUsd > 0 ? gramUsd : FALLBACK_GRAM_USD;
  return BigInt(Math.round((usd / rate) * 1e9));
}

function delay<T>(v: T, ms = 420): Promise<T> {
  return new Promise((r) => setTimeout(() => r(v), ms));
}

async function post<T>(path: string, body: unknown, initData: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `tma ${initData}` },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(msg || `API ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function quoteStars(
  recipient: string,
  quantity: number,
  initData: string,
  gramUsd = 0,
): Promise<StarsQuote> {
  if (!isMock) return post('/api/stars/quote', { recipient, quantity }, initData);
  const cost = usdToNano(quantity * STAR_USD, gramUsd);
  const fee = feeStars(cost);
  const ref = makeRef(`stars:${recipient}:${quantity}:${Date.now()}`);
  return delay({
    orderId: ref,
    ref,
    recipient,
    quantity,
    hotWallet: MOCK_HOT_WALLET,
    treasury: TREASURY,
    estimated: true,
    ...fee,
  });
}

export async function quotePremium(
  recipient: string,
  months: number,
  initData: string,
  gramUsd = 0,
): Promise<PremiumQuote> {
  if (!isMock) return post('/api/premium/quote', { recipient, months }, initData);
  const cost = usdToNano(PREMIUM_USD[months] ?? PREMIUM_USD[3], gramUsd);
  const fee = feePremium(cost);
  const ref = makeRef(`prem:${recipient}:${months}:${Date.now()}`);
  return delay({
    orderId: ref,
    ref,
    recipient,
    months,
    hotWallet: MOCK_HOT_WALLET,
    treasury: TREASURY,
    estimated: true,
    ...fee,
  });
}

/**
 * Ads / GRAM top-up quote (custodial, operator-fronted like Stars).
 * The user tops up `gramAmount` GRAM to a Telegram account's ads balance; cost is
 * ~1:1 in GRAM. Real charge comes from Fragment's initAdsTopupRequest via the backend.
 */
export async function quoteTopup(
  recipient: string,
  gramAmount: number,
  initData: string,
): Promise<TopupQuote> {
  if (!isMock) return post('/api/topup/quote', { recipient, amount: gramAmount }, initData);
  const cost = BigInt(Math.round(gramAmount * 1e9)); // GRAM top-up ≈ 1:1
  const fee = feeAdsTopup(cost);
  const ref = makeRef(`topup:${recipient}:${gramAmount}:${Date.now()}`);
  return delay({
    orderId: ref,
    ref,
    recipient,
    gramAmount,
    hotWallet: MOCK_HOT_WALLET,
    treasury: TREASURY,
    estimated: true,
    ...fee,
  });
}

export async function prepareBid(
  auction: Auction,
  bidNano: bigint,
  userAccount: string,
  initData: string,
  buyNow = false,
): Promise<BidPrepare> {
  if (!isMock)
    return post(
      '/api/bid/prepare',
      { username: auction.username, bidNano: bidNano.toString(), userAccount, kind: auction.kind ?? 'username', buyNow },
      initData,
    );
  const fee = buyNow ? feeBuyNow(bidNano) : feeBid(bidNano);
  const ref = makeRef(`${buyNow ? 'buy' : 'bid'}:${auction.username}:${bidNano}:${Date.now()}`);
  // In the real flow bidMessage comes from Fragment getBidLink built for the USER's wallet.
  return delay({
    orderId: ref,
    ref,
    validUntil: Math.floor(Date.now() / 1000) + 360,
    bidMessage: {
      // placeholder auction target; the backend returns Fragment's real target + payload
      address: 'EQAuction__target__from__fragment__getBidLink__placeholder0',
      amount: bidNano.toString(),
    },
    feeMessage: {
      address: TREASURY,
      amount: fee.feeNano.toString(),
    },
    fee,
  });
}

/**
 * Info for STARTING a new auction on a username already listed on Fragment
 * (e.g. fragment.com/username/json1) — NOT a conversion. This leg is operator-
 * fronted: the verified account places the initial bid, so the user prepays the
 * opening bid + fee to the operator (like stars/premium).
 */
export type UsernameStatus =
  | 'available'
  | 'auction'
  | 'onsale'
  | 'taken'
  | 'sold'
  | 'unavailable'
  | 'unknown';

export interface UsernameInfo {
  name: string;
  kind?: ItemKind;
  display?: string;
  status: UsernameStatus;
  minBidNano?: string;
  highestBidNano?: string;
  bidStepPct?: number;
  buyNowNano?: string;
  priceUsd?: number;
}

/** Resolve any collectible's live Fragment status + price. */
export async function resolveItem(kind: ItemKind, name: string, initData: string): Promise<UsernameInfo> {
  const id =
    kind === 'number'
      ? name.replace(/[^\d]/g, '')
      : name.replace(/^@/, '').replace(/\.t\.me$/, '').toLowerCase();
  const path =
    kind === 'number'
      ? `/api/number/${encodeURIComponent(id)}`
      : kind === 'gift'
        ? `/api/gift/${encodeURIComponent(id)}`
        : `/api/username/${encodeURIComponent(id)}`;
  if (!isMock) {
    const res = await fetch(`${BASE}${path}`, { headers: { Authorization: `tma ${initData}` } });
    if (!res.ok) return { name: id, kind, status: 'unknown' };
    return res.json() as Promise<UsernameInfo>;
  }
  // No backend → resolve the REAL public page via the same-origin Fragment proxy, so
  // search shows the true status/price (available/taken/sold/onsale/auction). Only if
  // the proxy is unreachable do we return an honest 'unknown' (never a fabricated price).
  try {
    return await resolveItemLive(kind, id);
  } catch {
    return { name: id, kind, display: kind === 'number' ? numberDisplay(id) : id, status: 'unknown' };
  }
}

/** Back-compat: username-only resolver. */
export const resolveUsername = (name: string, initData: string) => resolveItem('username', name, initData);
export const resolveNumber = (number: string, initData: string) => resolveItem('number', number, initData);

export interface NumberListing {
  number: string;
  display: string;
  priceNano: string;
  endsAt: number;
  status: UsernameStatus;
  priceUsd?: number;
}

/** Live +888 numbers on auction/resale. Real backend scrapes fragment.com/numbers; without
 *  it, the same-origin proxy scrapes the live listing; a demo set is the last-resort fallback. */
export async function listNumbers(initData: string, sort = 'ending'): Promise<NumberListing[]> {
  if (!isMock) {
    const res = await fetch(`${BASE}/api/numbers?sort=${encodeURIComponent(sort)}`, {
      headers: { Authorization: `tma ${initData}` },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as { numbers: NumberListing[] };
    return json.numbers ?? [];
  }
  try {
    const live = await listNumbersLive(sort);
    if (live.length) return live;
  } catch {
    /* fall through to the demo set */
  }
  const now = Math.floor(Date.now() / 1000);
  const demo = ['88801518888', '88800001312', '88800059059', '88802615175', '88807778888', '88809000900'];
  return demo.map((n, i) => {
    const price = mockNumberPrice(n);
    return {
      number: n,
      display: numberDisplay(n),
      priceNano: price.toString(),
      endsAt: now + (i + 1) * 3600 * (i % 2 ? 6 : 30),
      status: 'auction' as UsernameStatus,
    };
  });
}

export interface GiftCollection {
  slug: string;
  name: string;
  count: number;
  image: string;
}

export interface GiftItem {
  slug: string;
  collection: string;
  num: number;
  name: string;
  priceNano: string;
  status: UsernameStatus;
  image: string;
}

/** Gift collections index. Real backend scrapes fragment.com/gifts; without it, the proxy does. */
export async function listGiftCollections(initData: string): Promise<GiftCollection[]> {
  if (!isMock) {
    const res = await fetch(`${BASE}/api/gifts`, { headers: { Authorization: `tma ${initData}` } });
    if (!res.ok) return [];
    return ((await res.json()) as { collections: GiftCollection[] }).collections ?? [];
  }
  try {
    return await listGiftCollectionsLive();
  } catch {
    return [];
  }
}

export type GiftFilter = 'sale' | 'auction' | '';
export interface GiftAttributes {
  Model: string[];
  Backdrop: string[];
  Symbol: string[];
}
export interface GiftQuery {
  collection?: string; // '' | 'all' → across every collection
  filter?: GiftFilter;
  sort?: string; // price_asc | price_desc | ''
  query?: string;
  offset?: number;
  attrs?: { Model?: string[]; Backdrop?: string[]; Symbol?: string[] };
}
export interface GiftSearchResult {
  items: GiftItem[];
  nextOffset: number | null;
}

/** Paginated + filtered gift catalog (Fragment searchAuctions). */
export async function searchGifts(q: GiftQuery, initData: string): Promise<GiftSearchResult> {
  if (!isMock) {
    const p = new URLSearchParams();
    if (q.filter !== undefined) p.set('filter', q.filter || 'all');
    if (q.sort) p.set('sort', q.sort);
    if (q.offset) p.set('offset', String(q.offset));
    if (q.query) p.set('query', q.query);
    for (const v of q.attrs?.Model ?? []) p.append('model', v);
    for (const v of q.attrs?.Backdrop ?? []) p.append('backdrop', v);
    for (const v of q.attrs?.Symbol ?? []) p.append('symbol', v);
    const res = await fetch(`${BASE}/api/gifts/${encodeURIComponent(q.collection || 'all')}?${p.toString()}`, {
      headers: { Authorization: `tma ${initData}` },
    });
    if (!res.ok) return { items: [], nextOffset: null };
    return (await res.json()) as GiftSearchResult;
  }
  try {
    return await giftSearchLive(q);
  } catch {
    return { items: [], nextOffset: null };
  }
}

/** Available Model/Backdrop/Symbol filter values for a collection. */
export async function giftAttributes(collection: string, initData: string): Promise<GiftAttributes> {
  const empty: GiftAttributes = { Model: [], Backdrop: [], Symbol: [] };
  if (!collection || collection === 'all') return empty;
  if (!isMock) {
    const res = await fetch(`${BASE}/api/gifts/${encodeURIComponent(collection)}/attributes`, {
      headers: { Authorization: `tma ${initData}` },
    });
    if (!res.ok) return empty;
    return (await res.json()) as GiftAttributes;
  }
  try {
    return await giftAttributesLive(collection);
  } catch {
    return empty;
  }
}

/** Resolve a single gift item's live status/price. */
export const resolveGift = (slug: string, initData: string) => resolveItem('gift', slug, initData);

export interface StartInfo {
  username: string;
  kind?: ItemKind;
  display?: string;
  ref: string;
  status?: UsernameStatus;
  initialMinNano: string;
  hotWallet: string;
  treasury: string;
}

function mockInitialMin(username: string): bigint {
  const len = username.replace('@', '').length;
  const ton = len <= 4 ? 100 : len === 5 ? 50 : len === 6 ? 20 : len === 7 ? 10 : 5;
  return BigInt(ton) * TON;
}

/** Deterministic plausible mock price for a +888 number (nanoGRAM). */
function mockNumberPrice(digits: string): bigint {
  let h = 0;
  for (const c of digits) h = (h * 31 + c.charCodeAt(0)) % 100000;
  const ton = 5 + (h % 200); // 5–204 GRAM
  return BigInt(ton) * TON;
}

export interface StartPrepare {
  orderId: string;
  ref: string;
  username: string;
  hotWallet: string;
  treasury: string;
  costNano: string;
  feeNano: string;
  totalNano: string;
  effectivePct: number;
}

/**
 * Create the tracked start-auction order (custodial). The user then sends ONE payment of
 * totalNano (opening bid + fee) to hotWallet; the operator places the bid, sweeps the fee,
 * and transfers the NFT to `userAddress` if it wins (else refunds the opening bid).
 */
export async function prepareStart(
  username: string,
  kind: ItemKind,
  bidNano: bigint,
  userAddress: string,
  initData: string,
): Promise<StartPrepare> {
  if (!isMock)
    return post('/api/auction/start/prepare', { username, kind, bidNano: bidNano.toString(), userAddress }, initData);
  const fee = feeStartAuction(bidNano);
  const ref = makeRef(`start:${username}:${bidNano}:${Date.now()}`);
  return delay({
    orderId: ref,
    ref,
    username: username.replace('@', ''),
    hotWallet: MOCK_HOT_WALLET,
    treasury: TREASURY,
    costNano: bidNano.toString(),
    feeNano: fee.feeNano.toString(),
    totalNano: fee.totalNano.toString(),
    effectivePct: fee.effectivePct,
  });
}

export async function getStartInfo(username: string, initData: string, kind: ItemKind = 'username'): Promise<StartInfo> {
  if (!isMock) return post('/api/auction/start/info', { username, kind }, initData);
  const id = kind === 'number' ? username.replace(/[^\d]/g, '') : username.replace(/^@/, '').toLowerCase();
  // Resolve the REAL page so the opening bid matches Fragment's true minimum + status.
  let status: UsernameStatus = 'available';
  let display: string | undefined;
  let initialMinNano = mockInitialMin(id).toString();
  try {
    const info = await resolveItemLive(kind, id);
    status = info.status;
    display = info.display;
    if (info.minBidNano && info.minBidNano !== '0') initialMinNano = info.minBidNano;
  } catch {
    /* proxy unreachable → keep the heuristic minimum */
  }
  return {
    username: id,
    kind,
    display,
    ref: makeRef(`start:${id}:${Date.now()}`),
    status,
    initialMinNano,
    hotWallet: MOCK_HOT_WALLET,
    treasury: TREASURY,
  };
}

export async function fetchMyOrders(initData: string): Promise<Order[]> {
  if (!isMock) return post('/api/orders', {}, initData);
  return delay([]);
}

export { TREASURY };

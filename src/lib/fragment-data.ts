import type { Auction, BidHistoryEntry, OwnershipEntry } from '@/types';
import { rawToFriendly } from './ton';
import { shortAddr } from './format';

const TONAPI = (import.meta.env.VITE_TONAPI_BASE as string) || 'https://tonapi.io';

/**
 * Tiny TTL cache with in-flight de-duplication + stale-on-error. Prevents the TonAPI
 * 429s that came from re-fetching the same immutable-ish data on every tab switch /
 * refresh (the GRAM rate, the auctions list): concurrent callers share one request, a
 * fresh value is reused within its TTL, and a failed refresh falls back to the last good
 * value instead of erroring.
 */
type CacheEntry<T> = { at: number; val?: T; inflight?: Promise<T> };
const cacheStore = new Map<string, CacheEntry<unknown>>();

async function memo<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const e: CacheEntry<T> = (cacheStore.get(key) as CacheEntry<T> | undefined) ?? { at: 0 };
  const now = Date.now();
  if (e.val !== undefined && now - e.at < ttlMs) return e.val;
  if (e.inflight) return e.inflight;
  const inflight = fn()
    .then((val) => {
      cacheStore.set(key, { at: Date.now(), val });
      return val;
    })
    .catch((err) => {
      const prev = cacheStore.get(key) as CacheEntry<T> | undefined;
      cacheStore.set(key, { at: prev?.at ?? 0, val: prev?.val }); // clear inflight, keep stale
      if (prev?.val !== undefined) return prev.val; // serve stale rather than throw
      throw err;
    });
  cacheStore.set(key, { ...e, inflight });
  return inflight;
}

/** Run async tasks with bounded concurrency (avoids TonAPI request bursts). */
async function mapLimit<I, O>(items: I[], limit: number, fn: (item: I) => Promise<O>): Promise<O[]> {
  const out: O[] = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

/**
 * Live, non-custodial data straight from TonAPI (no backend needed for reads).
 * The +5% bid step is the on-chain Fragment default; we compute the TRUE next
 * minimum in integer nanoTON (ceil) rather than the whole-TON figure fragment.com
 * shows — that difference is the bid.tg discount.
 */
const DEFAULT_BID_STEP = 0.05;

function minNextBidNano(priceNano: number, step = DEFAULT_BID_STEP): number {
  // integer nanoTON, rounded up so it always clears the on-chain threshold
  return Math.ceil(priceNano * (1 + step));
}

export async function fetchAuctions(limit = 500): Promise<Auction[]> {
  // Cached 45s: the auctions list barely changes second-to-second, and re-opening the
  // Names tab shouldn't re-hit TonAPI each time.
  return memo(`auctions:${limit}`, 45_000, async () => {
    const res = await fetch(`${TONAPI}/v2/dns/auctions?tld=t.me`);
    if (!res.ok) throw new Error(`TonAPI ${res.status}`);
    const json = await res.json();
    const rows: any[] = json.data ?? json.auctions ?? (Array.isArray(json) ? json : []);
    return rows.slice(0, limit).map(normalizeAuction).filter((a): a is Auction => !!a);
  });
}

function normalizeAuction(row: any): Auction | null {
  const domain: string = row.domain ?? row.name ?? '';
  if (!domain) return null;
  const username = domain.replace(/\.t\.me$/, '');
  const priceNano = Number(row.price ?? row.value ?? 0);
  const endsAt = Number(row.date ?? row.auction_end ?? row.expires ?? 0);
  return {
    domain,
    username,
    priceNano,
    endsAt,
    minNextBidNano: minNextBidNano(priceNano),
    bidStep: DEFAULT_BID_STEP,
    bidCount: row.bids != null ? Number(row.bids) : undefined,
  };
}

/** Resolve a single username to its live auction figures (fresh price + min next bid). */
export async function fetchAuction(username: string): Promise<Auction | null> {
  const clean = username.replace(/^@/, '').replace(/\.t\.me$/, '');
  try {
    const res = await fetch(`${TONAPI}/v2/dns/${clean}.t.me/bids`);
    if (!res.ok) return null;
    const json = await res.json();
    const top = (json.data ?? [])[0];
    if (!top) return null;
    const priceNano = Number(top.value ?? 0);
    return {
      domain: `${clean}.t.me`,
      username: clean,
      priceNano,
      endsAt: 0,
      minNextBidNano: minNextBidNano(priceNano),
      bidStep: DEFAULT_BID_STEP,
    };
  } catch {
    return null;
  }
}

export interface AuctionState {
  currentBidNano: number;
  minNextBidNano: number;
  endsAt: number;
  bidStepPct?: number;
  buyNowNano?: number;
}

/**
 * EXACT auction figures read straight from the telemint NFT contract's get-methods via
 * TonAPI — no Fragment, no frontend scrape (it's all on-chain). `get_telemint_auction_state`
 * returns `min_bid`, the authoritative minimum next bid: the contract enforces an absolute
 * floor step (≈1 GRAM) on top of the % step, so the price×(1+5%) heuristic UNDERSHOOTS cheap
 * auctions (10 GRAM → real min 11, heuristic 10.5) and Fragment then rejects the bid as
 * "Bid is too small". `get_telemint_auction_config` adds the step % and buy-now (max_bid).
 * Usernames only (DNS-resolvable); returns null for numbers/gifts/anything unresolvable,
 * so callers fall back to the list's heuristic minimum.
 */
export async function fetchAuctionState(domain: string): Promise<AuctionState | null> {
  const full = domain.endsWith('.t.me') ? domain : `${domain}.t.me`;
  return memo(`aucstate:${full}`, 8_000, async () => {
    try {
      const dns = await (await fetch(`${TONAPI}/v2/dns/${full}`)).json();
      const nft = dns?.item?.address;
      if (!nft) return null;
      const st = await (await fetch(`${TONAPI}/v2/blockchain/accounts/${nft}/methods/get_telemint_auction_state`)).json();
      if (!st?.success || !st.decoded || st.decoded.min_bid == null) return null;
      const out: AuctionState = {
        currentBidNano: Number(st.decoded.bid),
        minNextBidNano: Number(st.decoded.min_bid),
        endsAt: Number(st.decoded.end_time),
      };
      try {
        const cfg = await (await fetch(`${TONAPI}/v2/blockchain/accounts/${nft}/methods/get_telemint_auction_config`)).json();
        if (cfg?.success && cfg.decoded) {
          if (cfg.decoded.min_bid_step != null) out.bidStepPct = Number(cfg.decoded.min_bid_step);
          const maxBid = Number(cfg.decoded.max_bid);
          if (maxBid > 0) out.buyNowNano = maxBid;
        }
      } catch {
        /* config is optional — the state alone gives the exact minimum */
      }
      return out;
    } catch {
      return null;
    }
  });
}

// The Telegram Usernames NFT collection. The FIRST bid on a fresh username is a
// `telemint_deploy` routed THROUGH this collection, so TonAPI reports the collection
// (resolved name "realsaltlake.t.me") as the bidder. The real bidder is the wallet at
// the ROOT of the trace (the one whose in_msg is external). We only trace those.
const USERNAMES_COLLECTION = '0:80d78a35f955a14b679faa887ff4cd5bfc0f43b4a4eea2a7e6927f3701b273c2';

function bidderName(b: { address?: string; name?: string }): string {
  if (b.name) return '@' + b.name.replace(/\.t\.me$/, '');
  return shortAddr(rawToFriendly(b.address ?? ''));
}

async function resolveBidder(bid: any): Promise<{ address?: string; name?: string }> {
  const b = bid.bidder ?? {};
  if (b.address === USERNAMES_COLLECTION && bid.txHash) {
    try {
      const res = await fetch(`${TONAPI}/v2/traces/${bid.txHash}`);
      if (res.ok) {
        const acc = (await res.json())?.transaction?.account;
        if (acc?.address) return { address: acc.address, name: acc.name };
      }
    } catch {
      /* fall back to the collection label */
    }
  }
  return b;
}

export async function fetchBidHistory(domain: string): Promise<BidHistoryEntry[]> {
  const clean = domain.replace('@', '').trim();
  try {
    const res = await fetch(`${TONAPI}/v2/dns/${clean}/bids`);
    if (!res.ok) return [];
    const bids: any[] = (await res.json()).data ?? [];
    // Bounded concurrency: resolveBidder can fire a /traces call per bid — don't burst them.
    return mapLimit(
      bids,
      4,
      async (bid) => {
        const bidder = await resolveBidder(bid);
        return {
          amountTon: Number(bid.value) / 1_000_000_000,
          bidderDisplay: bidderName(bidder),
          timestamp: new Date(bid.txTime * 1000).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          explorerUrl: `https://tonviewer.com/transaction/${bid.txHash}`,
        };
      },
    );
  } catch {
    return [];
  }
}

export async function fetchOwnershipHistory(domain: string): Promise<OwnershipEntry[]> {
  const clean = domain.replace('@', '').trim();
  const full = clean.endsWith('.t.me') ? clean : `${clean}.t.me`;
  try {
    const dnsRes = await fetch(`${TONAPI}/v2/dns/${full}`);
    const dns = await dnsRes.json();
    const nftAddress = dns.item?.address;
    if (!nftAddress) return [];
    const res = await fetch(`${TONAPI}/v2/nfts/${nftAddress}/history?limit=100`);
    const json = await res.json();
    const events: any[] = json.events ?? [];
    return events
      .filter((e) => e.actions?.some((a: any) => a.type === 'NftItemTransfer'))
      .map((e) => {
        const action = e.actions.find((a: any) => a.type === 'NftItemTransfer');
        const t = action.NftItemTransfer;
        const from = t.sender
          ? t.sender.name || shortAddr(rawToFriendly(t.sender.address), 6)
          : 'Mint';
        const to = t.recipient
          ? t.recipient.name || shortAddr(rawToFriendly(t.recipient.address), 6)
          : 'Unknown';
        return {
          date: new Date(e.timestamp * 1000).toLocaleString('en-GB', {
            day: '2-digit',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          }),
          from,
          to,
          explorerUrl: `https://tonviewer.com/transaction/${e.event_id}`,
        };
      });
  } catch {
    return [];
  }
}

export async function fetchTonUsd(): Promise<number> {
  // The GRAM/USD rate moves slowly — cache 3 min, dedupe concurrent callers, serve the
  // last good value on error. (App + every section poll this; without caching it was a 429 source.)
  return memo('rate:ton-usd', 180_000, async () => {
    try {
      const res = await fetch(`${TONAPI}/v2/rates?tokens=ton&currencies=usd`);
      if (!res.ok) throw new Error('rate');
      const json = await res.json();
      const v = Number(json.rates.TON.prices.USD);
      if (v > 0) return v;
      throw new Error('bad rate');
    } catch {
      const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=the-open-network&vs_currencies=usd');
      const json = await res.json();
      return Number(json['the-open-network'].usd) || 3.0;
    }
  });
}

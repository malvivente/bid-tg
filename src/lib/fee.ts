import type { FeeQuote } from '@/types';

/**
 * god.tg fee engine — the single source of truth for pricing.
 *
 * Amounts are nanoTON (bigint) internally; 1 TON = 1_000_000_000n.
 *
 * Model (finalized with the operator):
 *  - PREMIUM: flat 1 TON.
 *  - STARS:   1% of cost, floor 0.05 TON (1% dominates once cost > 5 TON).
 *  - BID on a LIVE auction: 0.15% of the bid, minimum 0.1 TON. Charged per bid
 *    (not refunded on outbid — a contingent fee would require trusting the bidder).
 *  - START AUCTION / initial bid (operator's wallet starts it): minimum 1 TON,
 *    then 0.15% if larger. DEFERRED (conversions leg) — kept here for completeness.
 *
 * NOTE: the whole 1%→0.15% first-bid tiering was dropped because it was gameable
 * with a throwaway minimum first bid. A flat 0.15% removes that exploit entirely.
 */

export const TON = 1_000_000_000n;

const PREMIUM_FLAT = 1n * TON;
const STARS_FLOOR = TON / 20n; // 0.05 TON
const BID_MIN = TON / 10n; // 0.1 TON
const START_MIN = 1n * TON; // 1 TON
const TOPUP_FLOOR = TON / 20n; // 0.05 TON (Ads Topup — mirrors Stars)
const BUYNOW_MIN = TON / 10n; // 0.1 TON (buy-now — mirrors a live bid)

function pctOf(nano: bigint, basisPoints: bigint): bigint {
  // basisPoints out of 10_000 (100 = 1%, 15 = 0.15%)
  return (nano * basisPoints) / 10_000n;
}

function max(a: bigint, b: bigint): bigint {
  return a > b ? a : b;
}

function toQuote(costNano: bigint, feeNano: bigint): FeeQuote {
  const totalNano = costNano + feeNano;
  const effectivePct = costNano > 0n ? Number((feeNano * 10_000n) / costNano) / 100 : 0;
  return { costNano, feeNano, totalNano, effectivePct };
}

export function feePremium(costNano: bigint): FeeQuote {
  return toQuote(costNano, PREMIUM_FLAT);
}

export function feeStars(costNano: bigint): FeeQuote {
  return toQuote(costNano, max(STARS_FLOOR, pctOf(costNano, 100n)));
}

/** Bid on an already-running auction. */
export function feeBid(bidNano: bigint): FeeQuote {
  return toQuote(bidNano, max(BID_MIN, pctOf(bidNano, 15n)));
}

/** Start a new auction (deferred conversions leg). */
export function feeStartAuction(bidNano: bigint): FeeQuote {
  return toQuote(bidNano, max(START_MIN, pctOf(bidNano, 15n)));
}

/** Ads/GRAM top-up (custodial, operator-fronted) — 1% floor 0.05, same shape as Stars. */
export function feeAdsTopup(costNano: bigint): FeeQuote {
  return toQuote(costNano, max(TOPUP_FLOOR, pctOf(costNano, 100n)));
}

/** Buy-now / fixed-price purchase of a collectible (username/number/gift) — 0.15% min 0.1, same as a bid. */
export function feeBuyNow(priceNano: bigint): FeeQuote {
  return toQuote(priceNano, max(BUYNOW_MIN, pctOf(priceNano, 15n)));
}

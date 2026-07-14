import { beginCell, Address, toNano, type Cell } from '@ton/core';
import type { TxMessage } from '@/types';

/**
 * Build the on-chain message that puts a telemint NFT you OWN up for auction —
 * usernames, +888 numbers, gifts all run the same `teleitem` contract. This is fully
 * NON-CUSTODIAL and needs no Fragment: the owner signs one message straight to their
 * NFT item contract. The winner is whoever the contract records as the top bidder;
 * settlement pays the beneficiary and transfers the NFT — bid.tg never touches either.
 *
 * The wire format below was verified byte-for-byte: real successful start_auction bodies
 * pulled from chain (username + two gift code variants + a +888 number) were rebuilt with
 * this exact builder and the cell hashes matched. Sources: TelegramMessenger/telemint
 * func/nft-item.fc + common.fc.
 *
 * TWO hazards the contract does NOT protect you from — so we do, here:
 *  1. The beneficiary is NOT validated on-chain. A bad/empty beneficiary is accepted at
 *     start, then at settlement the seller's proceeds are STRANDED on the item forever.
 *     We require a real, workchain-0, std address.
 *  2. The auction-config cell must contain EXACTLY these fields (the contract does
 *     `end_parse()`); any stray bit/ref throws TVM exit 9. We build precisely and stop.
 */

export const OP_TELEITEM_START_AUCTION = 0x487a8e81;
export const OP_TELEITEM_CANCEL_AUCTION = 0x371638ae;

// Contract-enforced bounds (violating any → exit 223, the contract throws, never clamps).
export const MAX_MIN_EXTEND_SEC = 604_800; // 7 days
export const MAX_DURATION_SEC = 31_536_000; // 365 days
// Our own sane minimum for duration (the contract accepts 0 = expires instantly = useless).
export const MIN_DURATION_SEC = 3_600; // 1 hour

/**
 * `initial_min_bid` floor. The contract floor is `2 * min_tons_for_storage`, which is
 * 2 TON on the username/number contract but only 0.06 TON on the "cheap" gift contract.
 * We ship USERNAMES ONLY for now, so 2 GRAM is exact. When gifts are enabled this must be
 * read per-item, not hard-coded.
 */
export const USERNAME_MIN_INITIAL_BID = toNano('2');

export interface AuctionConfigParams {
  beneficiary: string; // where the sale proceeds go — may differ from the owner
  initialMinBidNano: bigint; // opening price (nano), >= floor
  maxBidNano: bigint; // buy-now price (nano); 0 = no buy-now, else >= initialMinBid
  minBidStepPct: number; // 1..255, a PERCENT (the contract also enforces a +1 GRAM floor per raise)
  minExtendSec: number; // anti-sniping: every bid guarantees >= this many seconds left; 0..604800
  durationSec: number; // total length; 3600..31536000
}

/** Validate + build the TeleitemAuctionConfig cell. Throws a human-readable Error on any
 *  violation, mirroring the contract so the user sees WHY before signing (not a bounce). */
export function buildAuctionConfig(p: AuctionConfigParams, minInitialBid = USERNAME_MIN_INITIAL_BID): Cell {
  let beneficiary: Address;
  try {
    beneficiary = Address.parse(p.beneficiary.trim());
  } catch {
    throw new Error('Beneficiary is not a valid TON address');
  }
  if (beneficiary.workChain !== 0) throw new Error('Beneficiary must be a workchain-0 address');
  if (p.initialMinBidNano < minInitialBid)
    throw new Error(`Opening bid must be at least ${Number(minInitialBid) / 1e9} GRAM`);
  if (p.maxBidNano !== 0n && p.maxBidNano < p.initialMinBidNano)
    throw new Error('Buy-now price must be 0 or at least the opening bid');
  if (!Number.isInteger(p.minBidStepPct) || p.minBidStepPct < 1 || p.minBidStepPct > 255)
    throw new Error('Bid step must be a whole percent from 1 to 255');
  if (!Number.isInteger(p.minExtendSec) || p.minExtendSec < 0 || p.minExtendSec > MAX_MIN_EXTEND_SEC)
    throw new Error('Anti-sniping window must be 0…7 days');
  if (!Number.isInteger(p.durationSec) || p.durationSec < MIN_DURATION_SEC || p.durationSec > MAX_DURATION_SEC)
    throw new Error('Duration must be between 1 hour and 365 days');

  // EXACT layout — order and widths are contract-verified; nothing else may be in this cell.
  return beginCell()
    .storeAddress(beneficiary) // MsgAddressInt (267 bits)
    .storeCoins(p.initialMinBidNano) // Grams
    .storeCoins(p.maxBidNano) // Grams
    .storeUint(p.minBidStepPct, 8) // uint8 (percent)
    .storeUint(p.minExtendSec, 32) // uint32
    .storeUint(p.durationSec, 32) // uint32
    .endCell();
}

/** A non-zero, unsigned 64-bit query id. A zero query id would make the contract skip its
 *  refund reply and swallow the whole attached value — always send non-zero. */
function randomQueryId(): bigint {
  const buf = new BigUint64Array(1);
  crypto.getRandomValues(buf);
  return buf[0] === 0n ? 1n : buf[0];
}

function buildStartAuctionBody(config: Cell): Cell {
  return beginCell()
    .storeUint(OP_TELEITEM_START_AUCTION, 32)
    .storeUint(randomQueryId(), 64)
    .storeRef(config)
    .endCell();
}

/**
 * Gas to attach. There is no contract-required or documented value; live owner-started
 * auctions attach 0.02–1 TON and the contract refunds the unused remainder (mode 64), so
 * 0.05 is a safe overshoot, not a measured fee. The NFT is never at risk from over/under
 * paying here — a too-low value just bounces the whole message.
 */
export const START_AUCTION_GAS = toNano('0.05');

/** Build the TonConnect message: send `START_AUCTION_GAS` to the NFT item with the start body. */
export function startAuctionMessage(nftItemAddress: string, p: AuctionConfigParams, minInitialBid?: bigint): TxMessage {
  const config = buildAuctionConfig(p, minInitialBid);
  return {
    address: nftItemAddress,
    amount: START_AUCTION_GAS.toString(),
    payload: buildStartAuctionBody(config).toBoc().toString('base64'),
  };
}

/** Cancel an auction you started — allowed by the contract ONLY while it has zero bids. */
export function cancelAuctionMessage(nftItemAddress: string): TxMessage {
  const payload = beginCell()
    .storeUint(OP_TELEITEM_CANCEL_AUCTION, 32)
    .storeUint(randomQueryId(), 64)
    .endCell()
    .toBoc()
    .toString('base64');
  return { address: nftItemAddress, amount: START_AUCTION_GAS.toString(), payload };
}

/** Map a telemint exit code (from a failed tx / emulation) to a human message. */
export function auctionExitReason(code: number): string {
  switch (code) {
    case 223:
      return 'The auction settings were rejected by the contract';
    case 220:
      return 'Only the current owner can auction this item';
    case 214:
      return 'This item already has a live auction';
    case 221:
      return 'The auction already has bids and can no longer be cancelled';
    case 219:
      return 'There is no auction to cancel';
    case 9:
      return 'The beneficiary address is invalid';
    default:
      return `Auction failed (exit ${code})`;
  }
}

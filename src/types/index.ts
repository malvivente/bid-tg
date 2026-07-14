export type TabType = 'auctions' | 'numbers' | 'gifts' | 'buy' | 'profile';

/** Sub-views inside the "Buy" hub tab. */
export type BuyView = 'stars' | 'premium' | 'topup';

/** Which collectible market an item lives in. */
export type ItemKind = 'username' | 'number' | 'gift';

/** A live Fragment username/number auction, normalized from TonAPI. */
export interface Auction {
  /** full domain, e.g. "durov.t.me" (for numbers: the digits) */
  domain: string;
  /** the item id passed to Fragment — username (no suffix) or number digits */
  username: string;
  /** which market: 'username' (default) | 'number' | 'gift' */
  kind?: ItemKind;
  /** pretty label, e.g. "+888 0261 5175"; defaults to @username */
  display?: string;
  /** current top bid in nanoTON */
  priceNano: number;
  /** auction end, unix seconds */
  endsAt: number;
  /** minimum next bid in nanoTON (true on-chain minimum, not UI-rounded) */
  minNextBidNano: number;
  /** on-chain bid step as a fraction, e.g. 0.05 */
  bidStep: number;
  /** number of bids, if known */
  bidCount?: number;
}

export interface BidHistoryEntry {
  amountTon: number;
  bidderDisplay: string;
  timestamp: string;
  explorerUrl: string;
}

export interface OwnershipEntry {
  date: string;
  from: string;
  to: string;
  explorerUrl: string;
}

/** A single message in a TON Connect batch. */
export interface TxMessage {
  address: string;
  amount: string; // nanoTON as string
  payload?: string; // base64 BOC
  stateInit?: string;
}

/** Fee breakdown returned by the fee engine / backend quote. */
export interface FeeQuote {
  costNano: bigint; // what Fragment / the auction charges
  feeNano: bigint; // bid.tg fee
  totalNano: bigint; // cost + fee
  /** effective fee as a % of cost, for transparent display */
  effectivePct: number;
}

export type OrderStatus =
  | 'quoted'
  | 'awaiting_payment'
  | 'paid'
  | 'fulfilling'
  | 'fulfilled'
  | 'refund_due'
  | 'refunded'
  | 'failed';

export interface Order {
  id: string;
  ref: string;
  kind: 'stars' | 'premium' | 'bid';
  recipient?: string;
  status: OrderStatus;
  createdAt: number;
  costNano: string;
  feeNano: string;
}

export interface StarsQuote extends FeeQuote {
  orderId: string;
  ref: string;
  recipient: string;
  quantity: number;
  hotWallet: string;
  treasury: string;
  /** true when the cost is a client-side estimate (mock mode); false/absent when it's Fragment's authoritative price */
  estimated?: boolean;
}

export interface PremiumQuote extends FeeQuote {
  orderId: string;
  ref: string;
  recipient: string;
  months: number;
  hotWallet: string;
  treasury: string;
  estimated?: boolean;
}

export interface TopupQuote extends FeeQuote {
  orderId: string;
  ref: string;
  recipient: string;
  /** GRAM added to the account/ads balance */
  gramAmount: number;
  hotWallet: string;
  treasury: string;
  estimated?: boolean;
}

export interface BidPrepare {
  orderId: string;
  ref: string;
  bidMessage: TxMessage;
  feeMessage: TxMessage;
  validUntil: number;
  fee: FeeQuote;
}

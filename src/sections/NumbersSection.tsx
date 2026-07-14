import { useCallback, useEffect, useState } from 'react';
import { Search, RefreshCw, Hash, Flame, Rocket, ShoppingCart, Ban, Lock, Gavel } from 'lucide-react';
import { BidSheet } from '@/components/auctions/BidSheet';
import { BuyNowSheet } from '@/components/auctions/BuyNowSheet';
import { StartAuctionSheet } from '@/components/auctions/StartAuctionSheet';
import { TonIcon } from '@/components/TonIcon';
import { Skeleton, EmptyState, Pill } from '@/components/ui';
import { listNumbers, resolveNumber, type NumberListing, type UsernameInfo } from '@/lib/api';
import { getInitData } from '@/lib/telegram';
import { fmtTon, fmtUsd, endsText, itemLabel } from '@/lib/format';
import type { Auction } from '@/types';
import { cn } from '@/lib/cn';

const NUMBER_RE = /^\+?888\d{7,10}$/;

function auctionFromListing(l: NumberListing): Auction {
  const price = Number(l.priceNano);
  return {
    domain: l.number,
    username: l.number,
    kind: 'number',
    display: l.display,
    priceNano: price,
    endsAt: l.endsAt,
    minNextBidNano: Math.ceil(price * 1.05),
    bidStep: 0.05,
  };
}

function auctionFromInfo(info: UsernameInfo): Auction {
  const price = Number(info.highestBidNano ?? info.minBidNano ?? 0);
  return {
    domain: info.name,
    username: info.name,
    kind: 'number',
    display: info.display ?? itemLabel({ kind: 'number', username: info.name }),
    priceNano: price,
    endsAt: 0,
    minNextBidNano: Number(info.minBidNano ?? Math.ceil(price * 1.05)),
    bidStep: (info.bidStepPct ?? 5) / 100,
  };
}

export function NumbersSection({ tonUsd }: { tonUsd: number }) {
  const [list, setList] = useState<NumberListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [resolved, setResolved] = useState<UsernameInfo | null>(null);
  const [resolving, setResolving] = useState(false);
  const [bidding, setBidding] = useState<Auction | null>(null);
  const [buying, setBuying] = useState<Auction | null>(null);
  const [starting, setStarting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setList(await listNumbers(getInitData()));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load numbers');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const q = query.trim().replace(/[^\d]/g, '');
  const digits = query.trim().startsWith('+888') || query.trim().startsWith('888') ? q : '888' + q;
  const inList = list.some((n) => n.number === digits);
  const shouldResolve = !loading && NUMBER_RE.test(query.trim().replace(/\s/g, '')) && !inList;

  useEffect(() => {
    if (!shouldResolve) {
      setResolved(null);
      return;
    }
    let alive = true;
    setResolving(true);
    setResolved(null);
    const t = setTimeout(async () => {
      try {
        const info = await resolveNumber(digits, getInitData());
        if (alive) setResolved(info);
      } finally {
        if (alive) setResolving(false);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [digits, shouldResolve]);

  function openNumber(l: NumberListing) {
    if (l.status === 'onsale') setBuying(auctionFromListing(l));
    else setBidding(auctionFromListing(l));
  }

  return (
    <div className="container-app space-y-4 py-5">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-god-cream">Anonymous numbers</h2>
          <p className="text-xs text-god-muted">
            {loading ? 'Loading live +888 auctions…' : `${list.length} live on Fragment`}
          </p>
        </div>
        <button
          onClick={load}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-god-border text-god-muted transition-colors hover:text-god-gold"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-god-gold/60" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search a +888 number…"
          inputMode="numeric"
          spellCheck={false}
          className="input-field pl-10"
        />
      </div>

      {shouldResolve && (
        <SearchResultCard
          resolving={resolving}
          info={resolved}
          onStart={(name) => setStarting(name)}
          onBid={(info) => setBidding(auctionFromInfo(info))}
          onBuy={(info) => setBuying({ ...auctionFromInfo(info), priceNano: Number(info.buyNowNano ?? 0) })}
        />
      )}

      {error && (
        <div className="rounded-xl border border-god-danger/30 bg-god-danger/10 p-3 text-sm text-god-danger">
          {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
          ))}
        </div>
      ) : list.length === 0 ? (
        <EmptyState
          icon={<Hash className="h-8 w-8" />}
          title="No live number auctions"
          hint="Search an exact +888 number to bid or buy it."
        />
      ) : (
        <div className="space-y-2">
          {list.map((n, i) => (
            <NumberRow key={n.number} listing={n} tonUsd={tonUsd} rank={i} onClick={() => openNumber(n)} />
          ))}
        </div>
      )}

      <BidSheet
        key={bidding?.domain ?? 'bid-empty'}
        auction={bidding}
        open={!!bidding}
        onClose={() => setBidding(null)}
        tonUsd={tonUsd}
      />
      <BuyNowSheet
        key={buying?.domain ?? 'buy-empty'}
        auction={buying}
        open={!!buying}
        onClose={() => setBuying(null)}
        tonUsd={tonUsd}
      />
      <StartAuctionSheet
        username={starting}
        kind="number"
        open={starting !== null}
        onClose={() => setStarting(null)}
        tonUsd={tonUsd}
      />
    </div>
  );
}

function SearchResultCard({
  resolving,
  info,
  onStart,
  onBid,
  onBuy,
}: {
  resolving: boolean;
  info: UsernameInfo | null;
  onStart: (name: string) => void;
  onBid: (info: UsernameInfo) => void;
  onBuy: (info: UsernameInfo) => void;
}) {
  if (resolving || !info) return <Skeleton className="h-[72px] w-full rounded-2xl" />;

  const label = info.display ?? itemLabel({ kind: 'number', username: info.name });
  const min = info.minBidNano ? fmtTon(Number(info.minBidNano)) : '—';
  const buy = info.buyNowNano ? fmtTon(Number(info.buyNowNano)) : '—';
  const usd = info.priceUsd ? `~ $${info.priceUsd.toLocaleString('en-US')}` : '';

  let icon = <Search className="h-5 w-5" />;
  let iconClass = 'bg-god-elevated text-god-muted';
  let sub: React.ReactNode = <>Couldn’t find {label} on Fragment</>;
  let action: React.ReactNode = null;

  switch (info.status) {
    case 'available':
      icon = <Rocket className="h-5 w-5" />;
      iconClass = 'bg-gold-gradient text-god-bg';
      sub = (
        <>
          Available · min <b className="text-god-gold">{min}</b> GRAM {usd} · starts a 7-day auction
        </>
      );
      action = (
        <button className="btn-gold px-4 py-2 text-xs" onClick={() => onStart(info.name)}>
          Start
        </button>
      );
      break;
    case 'auction':
      icon = <Gavel className="h-5 w-5" />;
      iconClass = 'bg-god-elevated text-god-gold';
      sub = (
        <>
          On auction · min next <b className="text-god-gold">{min}</b> GRAM
        </>
      );
      action = (
        <button className="btn-outline px-4 py-2 text-xs" onClick={() => onBid(info)}>
          Bid
        </button>
      );
      break;
    case 'onsale':
      icon = <ShoppingCart className="h-5 w-5" />;
      iconClass = 'bg-gold-gradient text-god-bg';
      sub = (
        <>
          For sale · <b className="text-god-gold">{buy}</b> GRAM {usd}
        </>
      );
      action = (
        <button className="btn-gold px-4 py-2 text-xs" onClick={() => onBuy(info)}>
          Buy
        </button>
      );
      break;
    case 'taken':
      icon = <Lock className="h-5 w-5" />;
      sub = <>Taken — assigned to a Telegram account</>;
      break;
    case 'sold':
      icon = <Lock className="h-5 w-5" />;
      sub = <>Sold — already an owned collectible</>;
      break;
    case 'unavailable':
      icon = <Ban className="h-5 w-5" />;
      sub = <>Unavailable — not a valid +888 number</>;
      break;
  }

  return (
    <div className="card animate-scale-in flex w-full items-center gap-3 px-4 py-3.5">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconClass)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-god-cream">{label}</div>
        <div className="text-[11px] leading-relaxed text-god-faint">{sub}</div>
      </div>
      {action}
    </div>
  );
}

function NumberRow({
  listing,
  tonUsd,
  rank,
  onClick,
}: {
  listing: NumberListing;
  tonUsd: number;
  rank: number;
  onClick: () => void;
}) {
  const ends = endsText(listing.endsAt);
  const resale = listing.status === 'onsale';
  return (
    <button onClick={onClick} className="card card-hover flex w-full items-center gap-3 px-4 py-3 text-left">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-god-elevated font-display text-sm font-bold text-god-gold">
        <Hash className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-god-cream">{listing.display}</span>
          {rank < 3 && !resale && listing.endsAt > 0 && <Flame className="h-3.5 w-3.5 shrink-0 text-god-gold" />}
        </div>
        <div className="mt-0.5">
          {resale ? (
            <Pill tone="success">Resale · buy now</Pill>
          ) : listing.endsAt <= 0 ? (
            <span className="text-[11px] text-god-faint">On auction</span>
          ) : ends.closed ? (
            <Pill tone="urgent">Closed</Pill>
          ) : (
            <span className={cn('text-[11px]', ends.urgent ? 'text-god-danger' : 'text-god-faint')}>
              ends in {ends.text}
            </span>
          )}
        </div>
      </div>
      <div className="text-right">
        <div className="flex items-center justify-end gap-1 font-mono font-bold text-god-gold">
          <TonIcon size={13} />
          {fmtTon(Number(listing.priceNano))}
        </div>
        <div className="text-[10px] text-god-faint">${fmtUsd(Number(listing.priceNano), tonUsd)}</div>
      </div>
    </button>
  );
}

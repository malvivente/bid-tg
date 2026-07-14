import { useEffect, useState } from 'react';
import { Search, ArrowDownUp, RefreshCw, Gavel, Flame, Rocket, Plus, ShoppingCart, Ban, Lock } from 'lucide-react';
import { useAuctions, type SortKey } from '@/hooks/useAuctions';
import { AuctionDetailSheet } from '@/components/auctions/AuctionDetailSheet';
import { BidSheet } from '@/components/auctions/BidSheet';
import { BuyNowSheet } from '@/components/auctions/BuyNowSheet';
import { StartAuctionSheet } from '@/components/auctions/StartAuctionSheet';
import { TonIcon } from '@/components/TonIcon';
import { Skeleton, EmptyState, Pill } from '@/components/ui';
import { resolveUsername, type UsernameInfo } from '@/lib/api';
import { getInitData } from '@/lib/telegram';
import { fmtTon, fmtUsd, endsText } from '@/lib/format';
import type { Auction } from '@/types';
import { cn } from '@/lib/cn';

const USERNAME_RE = /^@?[a-zA-Z0-9_]{4,32}$/;

function auctionFromInfo(info: UsernameInfo): Auction {
  return {
    domain: `${info.name}.t.me`,
    username: info.name,
    priceNano: Number(info.highestBidNano ?? info.minBidNano ?? 0),
    endsAt: 0,
    minNextBidNano: Number(info.minBidNano ?? 0),
    bidStep: (info.bidStepPct ?? 5) / 100,
  };
}

export function AuctionsSection() {
  const a = useAuctions();
  const [detail, setDetail] = useState<Auction | null>(null);
  const [bidding, setBidding] = useState<Auction | null>(null);
  const [buying, setBuying] = useState<Auction | null>(null);
  const [starting, setStarting] = useState<string | null>(null);
  const [resolved, setResolved] = useState<UsernameInfo | null>(null);
  const [resolving, setResolving] = useState(false);

  const sorts: { key: SortKey; label: string }[] = [
    { key: 'bid', label: 'Top bid' },
    { key: 'ends', label: 'Ending' },
    { key: 'username', label: 'Name' },
  ];

  const q = a.query.trim().replace('@', '');
  const inList = a.auctions.some((x) => x.username.toLowerCase() === q.toLowerCase());
  const shouldResolve = !a.loading && USERNAME_RE.test(q) && !inList;

  // Resolve any username (available / auction / taken / sold / …) via the backend.
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
        const info = await resolveUsername(q, getInitData());
        if (alive) setResolved(info);
      } finally {
        if (alive) setResolving(false);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [q, shouldResolve]);

  return (
    <div className="container-app space-y-4 py-5">
      <div className="flex items-end justify-between">
        <div>
          <h2 className="font-display text-xl font-bold text-god-cream">Username auctions</h2>
          <p className="text-xs text-god-muted">
            {a.loading ? 'Loading live auctions…' : `${a.total} live on Fragment`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setStarting(a.query.trim() || '')}
            className="flex items-center gap-1 rounded-xl border border-god-borderStrong px-3 py-2 text-xs font-medium text-god-gold transition-colors hover:bg-god-gold/10"
          >
            <Plus className="h-3.5 w-3.5" /> Start
          </button>
          <button
            onClick={a.reload}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-god-border text-god-muted transition-colors hover:text-god-gold"
          >
            <RefreshCw className={cn('h-4 w-4', a.loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-god-gold/60" />
        <input
          value={a.query}
          onChange={(e) => a.setQuery(e.target.value)}
          placeholder="Search username…"
          spellCheck={false}
          autoCapitalize="none"
          className="input-field pl-10"
        />
      </div>

      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar">
        <ArrowDownUp className="h-3.5 w-3.5 shrink-0 text-god-faint" />
        {sorts.map((s) => (
          <button
            key={s.key}
            onClick={() => a.toggleSort(s.key)}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              a.sortKey === s.key
                ? 'border-god-gold/50 bg-god-gold/10 text-god-gold'
                : 'border-god-border text-god-muted',
            )}
          >
            {s.label}
            {a.sortKey === s.key && <span className="ml-1">{a.sortAsc ? '↑' : '↓'}</span>}
          </button>
        ))}
      </div>

      {shouldResolve && (
        <SearchResultCard
          query={q}
          resolving={resolving}
          info={resolved}
          tonUsd={a.tonUsd}
          onStart={(name) => setStarting(name)}
          onBid={(info) => setBidding(auctionFromInfo(info))}
          onBuy={(info) => setBuying({ ...auctionFromInfo(info), priceNano: Number(info.buyNowNano ?? 0) })}
        />
      )}

      {a.error && (
        <div className="rounded-xl border border-god-danger/30 bg-god-danger/10 p-3 text-sm text-god-danger">
          {a.error}
        </div>
      )}

      {a.loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-[68px] w-full rounded-2xl" />
          ))}
        </div>
      ) : a.auctions.length === 0 ? (
        <EmptyState icon={<Gavel className="h-8 w-8" />} title="No auctions found" hint="Try a different search or refresh." />
      ) : (
        <div className="space-y-2">
          {a.auctions.map((auction, i) => (
            <AuctionRow key={auction.domain} auction={auction} tonUsd={a.tonUsd} rank={i} onClick={() => setDetail(auction)} />
          ))}
        </div>
      )}

      <AuctionDetailSheet
        key={detail?.domain ?? 'detail-empty'}
        auction={detail}
        open={!!detail}
        onClose={() => setDetail(null)}
        onBid={(auction) => {
          setDetail(null);
          setBidding(auction);
        }}
        tonUsd={a.tonUsd}
      />
      <BidSheet
        key={bidding?.domain ?? 'bid-empty'}
        auction={bidding}
        open={!!bidding}
        onClose={() => setBidding(null)}
        tonUsd={a.tonUsd}
      />
      <BuyNowSheet
        key={buying?.domain ?? 'buy-empty'}
        auction={buying}
        open={!!buying}
        onClose={() => setBuying(null)}
        tonUsd={a.tonUsd}
      />
      <StartAuctionSheet
        username={starting}
        open={starting !== null}
        onClose={() => setStarting(null)}
        tonUsd={a.tonUsd}
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
  query: string;
  resolving: boolean;
  info: UsernameInfo | null;
  tonUsd: number;
  onStart: (name: string) => void;
  onBid: (info: UsernameInfo) => void;
  onBuy: (info: UsernameInfo) => void;
}) {
  if (resolving || !info) return <Skeleton className="h-[72px] w-full rounded-2xl" />;

  const min = info.minBidNano ? fmtTon(Number(info.minBidNano)) : '—';
  const buy = info.buyNowNano ? fmtTon(Number(info.buyNowNano)) : '—';
  const usd = info.priceUsd ? `~ $${info.priceUsd.toLocaleString('en-US')}` : '';

  let icon = <Search className="h-5 w-5" />;
  let iconClass = 'bg-god-elevated text-god-muted';
  let sub: React.ReactNode = <>Couldn’t find @{info.name} on Fragment</>;
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
      sub = <>Taken on Telegram — not available as a collectible</>;
      break;
    case 'sold':
      icon = <Lock className="h-5 w-5" />;
      sub = <>Sold — already an owned collectible</>;
      break;
    case 'unavailable':
      icon = <Ban className="h-5 w-5" />;
      sub = <>Unavailable — not a free or valid username</>;
      break;
  }

  return (
    <div className="card animate-scale-in flex w-full items-center gap-3 px-4 py-3.5">
      <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', iconClass)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-god-cream">@{info.name}</div>
        <div className="text-[11px] leading-relaxed text-god-faint">{sub}</div>
      </div>
      {action}
    </div>
  );
}

function AuctionRow({
  auction,
  tonUsd,
  rank,
  onClick,
}: {
  auction: Auction;
  tonUsd: number;
  rank: number;
  onClick: () => void;
}) {
  const ends = endsText(auction.endsAt);
  return (
    <button
      onClick={onClick}
      className="card card-hover flex w-full items-center gap-3 px-4 py-3 text-left"
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-god-elevated font-display text-sm font-bold text-god-gold">
        {auction.username.slice(0, 2).toLowerCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium text-god-cream">@{auction.username}</span>
          {rank < 3 && auction.endsAt > 0 && (
            <Flame className="h-3.5 w-3.5 shrink-0 text-god-gold" />
          )}
        </div>
        <div className="mt-0.5">
          {ends.closed ? (
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
          {fmtTon(auction.priceNano)}
        </div>
        <div className="text-[10px] text-god-faint">${fmtUsd(auction.priceNano, tonUsd)}</div>
      </div>
    </button>
  );
}

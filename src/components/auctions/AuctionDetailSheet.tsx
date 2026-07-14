import { useEffect, useState } from 'react';
import { Gavel, ChevronDown, History, Users, ExternalLink, Clock } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Button, Skeleton, Pill } from '@/components/ui';
import { TonIcon } from '@/components/TonIcon';
import { fetchBidHistory, fetchOwnershipHistory, fetchAuctionState, type AuctionState } from '@/lib/fragment-data';
import { fmtTon, fmtUsd, fmtDate, endsText } from '@/lib/format';
import type { Auction, BidHistoryEntry, OwnershipEntry } from '@/types';
import { cn } from '@/lib/cn';

export function AuctionDetailSheet({
  auction,
  open,
  onClose,
  onBid,
  tonUsd,
}: {
  auction: Auction | null;
  open: boolean;
  onClose: () => void;
  onBid: (a: Auction) => void;
  tonUsd: number;
}) {
  const [live, setLive] = useState<AuctionState | null>(null);

  // Read the EXACT minimum next bid on-chain (telemint get-methods) so the detail sheet
  // matches what BidSheet will ask — the list's minNextBidNano is a price×(1+5%) heuristic
  // that undershoots cheap auctions (the contract enforces an absolute floor step). Shares
  // fetchAuctionState's 8s cache, so opening detail then bid doesn't double-fetch. Usernames
  // only resolve via DNS; numbers/gifts keep the heuristic.
  useEffect(() => {
    setLive(null);
    if (!open || !auction || (auction.kind && auction.kind !== 'username')) return;
    let cancelled = false;
    fetchAuctionState(auction.domain).then((s) => {
      if (!cancelled) setLive(s);
    });
    return () => {
      cancelled = true;
    };
  }, [open, auction?.domain, auction?.kind]);

  if (!auction) return null;
  const ends = endsText(auction.endsAt);
  // Prefer the on-chain minimum; fall back to the list heuristic until it loads.
  const minNano = BigInt(live?.minNextBidNano ?? auction.minNextBidNano);
  // Show the TRUE step (the actual increment over the current bid) when we have live data —
  // that's the "+1 GRAM" absolute floor Fragment shows — else the heuristic % label.
  const stepLabel = live
    ? `+${fmtTon(minNano - BigInt(Math.round(auction.priceNano)))} step`
    : `+${(auction.bidStep * 100).toFixed(0)}% step`;

  return (
    <Sheet open={open} onClose={onClose} title={`@${auction.username}`}>
      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <Stat label="Current bid">
            <span className="flex items-center gap-1 text-god-gold">
              <TonIcon size={16} />
              <span className="font-mono text-lg font-bold">{fmtTon(auction.priceNano)}</span>
            </span>
            <span className="text-[11px] text-god-faint">${fmtUsd(auction.priceNano, tonUsd)}</span>
          </Stat>
          <Stat label="Min next bid">
            <span className="flex items-center gap-1 text-god-cream">
              <TonIcon size={16} className="text-god-gold" />
              <span className="font-mono text-lg font-bold">{fmtTon(minNano)}</span>
            </span>
            <span className="text-[11px] text-god-faint">{stepLabel}</span>
          </Stat>
        </div>

        <div className="flex items-center justify-between rounded-xl border border-god-border bg-god-surface/60 px-4 py-3">
          <span className="flex items-center gap-2 text-sm text-god-muted">
            <Clock className="h-4 w-4 text-god-gold/70" /> Ends
          </span>
          <span className="text-right">
            {ends.closed ? (
              <Pill tone="urgent">Closed</Pill>
            ) : (
              <>
                <span className={cn('font-mono font-semibold', ends.urgent ? 'text-god-danger' : 'text-god-cream')}>
                  {ends.text}
                </span>
                <span className="block text-[10px] text-god-faint">{fmtDate(auction.endsAt)}</span>
              </>
            )}
          </span>
        </div>

        <Collapsible
          icon={<History className="h-4 w-4" />}
          label="Bid history"
          load={() => fetchBidHistory(auction.domain)}
          render={(rows: BidHistoryEntry[]) =>
            rows.length === 0 ? (
              <Empty>No bids yet</Empty>
            ) : (
              <div className="divide-y divide-god-border/40">
                {rows.map((b, i) => (
                  <a
                    key={i}
                    href={b.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between py-2 text-sm"
                  >
                    <span className="text-god-muted">{b.timestamp}</span>
                    <span className="flex-1 truncate px-3 text-god-cream/80">{b.bidderDisplay}</span>
                    <span className="flex items-center gap-1 font-mono font-semibold text-god-gold">
                      <TonIcon size={12} />
                      {fmtTon(Math.round(b.amountTon * 1e9))}
                    </span>
                  </a>
                ))}
              </div>
            )
          }
        />

        <Collapsible
          icon={<Users className="h-4 w-4" />}
          label="Ownership history"
          load={() => fetchOwnershipHistory(auction.domain)}
          render={(rows: OwnershipEntry[]) =>
            rows.length === 0 ? (
              <Empty>No transfers found</Empty>
            ) : (
              <div className="divide-y divide-god-border/40">
                {rows.map((r, i) => (
                  <a
                    key={i}
                    href={r.explorerUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center justify-between gap-2 py-2 text-xs"
                  >
                    <span className="w-20 shrink-0 text-god-faint">{r.date}</span>
                    <span className="flex-1 truncate text-god-cream/80">{r.from}</span>
                    <ExternalLink className="h-3 w-3 shrink-0 text-god-gold/60" />
                    <span className="flex-1 truncate text-right text-god-cream/80">{r.to}</span>
                  </a>
                ))}
              </div>
            )
          }
        />

        <p className="text-center text-[10px] text-god-faint">Live data · TonAPI</p>

        {!ends.closed && (
          <Button fullWidth onClick={() => onBid(auction)} leftIcon={<Gavel className="h-4 w-4" />}>
            Place bid — from {fmtTon(minNano)} GRAM
          </Button>
        )}
      </div>
    </Sheet>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-god-border bg-god-surface/60 p-3">
      <span className="text-[11px] uppercase tracking-wide text-god-faint">{label}</span>
      {children}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="py-3 text-center text-xs text-god-faint">{children}</p>;
}

function Collapsible<T>({
  icon,
  label,
  load,
  render,
}: {
  icon: React.ReactNode;
  label: string;
  load: () => Promise<T[]>;
  render: (rows: T[]) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<T[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next && rows === null) {
      setLoading(true);
      try {
        setRows(await load());
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-god-border bg-god-surface/40">
      <button onClick={toggle} className="flex w-full items-center justify-between px-4 py-3">
        <span className="flex items-center gap-2 text-sm font-medium text-god-cream/90">
          <span className="text-god-gold/80">{icon}</span>
          {label}
        </span>
        <ChevronDown className={cn('h-4 w-4 text-god-muted transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <div className="px-4 pb-3">
          {loading ? (
            <div className="space-y-2 py-1">
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-full" />
              <Skeleton className="h-6 w-2/3" />
            </div>
          ) : (
            rows && render(rows)
          )}
        </div>
      )}
    </div>
  );
}

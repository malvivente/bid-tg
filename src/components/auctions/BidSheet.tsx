import { useEffect, useMemo, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { Gavel, TrendingUp } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { TonIcon } from '@/components/TonIcon';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { prepareBid } from '@/lib/api';
import { fetchAuctionState, type AuctionState } from '@/lib/fragment-data';
import { commentPayload } from '@/lib/comment';
import { feeBid } from '@/lib/fee';
import { toNano, toTon, fmtTon, itemLabel } from '@/lib/format';
import { getInitData } from '@/lib/telegram';
import type { Auction } from '@/types';
import { cn } from '@/lib/cn';

export function BidSheet({
  auction,
  open,
  onClose,
  tonUsd,
}: {
  auction: Auction | null;
  open: boolean;
  onClose: () => void;
  tonUsd: number;
}) {
  const wallet = useTonWallet();
  const { pay } = usePayment();
  const toast = useToast();
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState<AuctionState | null>(null);

  // Read the EXACT minimum next bid on-chain (telemint get-methods) when the sheet opens.
  // The list's minNextBidNano is a price×(1+5%) heuristic that undershoots cheap auctions
  // (the contract enforces an absolute floor step) → this replaces it with the real min.
  // Usernames only resolve via DNS; numbers/gifts keep the heuristic.
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

  const label = auction ? itemLabel(auction) : '';
  // Prefer the live on-chain minimum; fall back to the list heuristic until it loads.
  const minNano = auction ? BigInt(live?.minNextBidNano ?? auction.minNextBidNano) : 0n;
  const minTon = toTon(minNano);
  // The min in GRAM can have >2 decimals; rounding to cents must go UP, or the default/Min
  // preset lands just BELOW the true minimum and Fragment rejects it as "Bid is too small".
  const minBidTon = ceilCents(minTon);

  // default the input to the minimum when the sheet opens for a new auction
  const shownAmount = amount === '' ? String(minBidTon) : amount;
  const parsed = parseFloat(shownAmount);
  const valid = auction && !isNaN(parsed) && toNano(parsed) >= minNano;

  const fee = useMemo(() => feeBid(valid ? toNano(parsed) : minNano), [parsed, valid, minNano]);
  const fragmentNano = useMemo(() => toNano(Math.ceil(parsed || minTon)), [parsed, minTon]);

  if (!auction) return null;

  const presets = [
    { label: 'Min', ton: minBidTon },
    { label: '+10%', ton: round(minTon * 1.1) },
    { label: '+25%', ton: round(minTon * 1.25) },
  ];

  async function confirm() {
    if (!auction || !valid) {
      toast('error', `Minimum bid is ${fmtTon(minNano)} GRAM`);
      return;
    }
    setBusy(true);
    try {
      const acc = wallet?.account;
      const accountJson = acc
        ? JSON.stringify({
            address: acc.address,
            chain: acc.chain,
            walletStateInit: acc.walletStateInit,
            publicKey: acc.publicKey,
          })
        : 'preview';
      const prep = await prepareBid(auction, toNano(parsed), accountJson, getInitData());
      const feeMsg = {
        ...prep.feeMessage,
        payload: prep.feeMessage.payload ?? commentPayload(prep.ref),
      };
      const res = await pay([prep.bidMessage, feeMsg], prep.validUntil);
      if (res.status === 'sent') {
        toast('success', `Bid of ${fmtTon(toNano(parsed))} GRAM placed on ${label}`);
        onClose();
      } else if (res.status === 'demo') {
        toast('info', 'Demo — connect the backend to relay the bid to Fragment');
      } else if (res.status === 'need_connect') {
        toast('info', 'Connect your wallet to bid');
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Bid failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Bid on ${label}`}>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-god-border bg-god-surface/60 px-4 py-3">
          <span className="text-sm text-god-muted">Minimum next bid</span>
          <span className="flex items-center gap-1 font-mono font-semibold text-god-gold">
            <TonIcon size={14} />
            {fmtTon(minNano)}
          </span>
        </div>

        <div className="space-y-2">
          <label className="label-eyebrow">Your bid (GRAM)</label>
          <div className="relative">
            <TonIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-god-gold" />
            <input
              type="number"
              inputMode="decimal"
              value={shownAmount}
              onChange={(e) => setAmount(e.target.value)}
              min={minTon}
              step="0.01"
              className={cn('input-field pl-10 text-lg font-bold', !valid && 'border-god-danger/50')}
            />
          </div>
          <div className="grid grid-cols-3 gap-2">
            {presets.map((p) => (
              <button
                key={p.label}
                onClick={() => setAmount(String(p.ton))}
                className="rounded-xl border border-god-border bg-god-surface py-2 text-xs font-medium text-god-muted transition-colors hover:text-god-cream"
              >
                {p.label} · {fmtTon(toNano(p.ton))}
              </button>
            ))}
          </div>
        </div>

        <FeeBreakdown
          costLabel="Your bid"
          costNano={valid ? toNano(parsed) : minNano}
          feeNano={fee.feeNano}
          totalNano={fee.totalNano}
          effectivePct={fee.effectivePct}
          tonUsd={tonUsd}
          fragmentNano={fragmentNano}
        />

        <div className="flex items-start gap-2 rounded-xl bg-god-elevated/50 p-3 text-[11px] leading-relaxed text-god-faint">
          <TrendingUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-god-gold/70" />
          You bid directly from your own wallet, so you win the collectible yourself. If you're
          outbid, the network refunds your bid automatically.
        </div>

        <Button fullWidth loading={busy} onClick={confirm} leftIcon={<Gavel className="h-4 w-4" />}>
          Place bid
        </Button>
      </div>
    </Sheet>
  );
}

function round(ton: number): number {
  return Math.round(ton * 100) / 100;
}

/** Round UP to whole cents — used for the minimum so a bid is never below it. */
function ceilCents(ton: number): number {
  return Math.ceil(ton * 100) / 100;
}

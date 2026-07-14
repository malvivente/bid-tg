import { useMemo, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { ShoppingCart, ShieldCheck } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { TonIcon } from '@/components/TonIcon';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { prepareBid } from '@/lib/api';
import { commentPayload } from '@/lib/comment';
import { feeBuyNow } from '@/lib/fee';
import { fmtTon, itemLabel } from '@/lib/format';
import { getInitData } from '@/lib/telegram';
import type { Auction } from '@/types';

/**
 * Buy-now for an onsale collectible (username / +888 number / gift). Fragment's "Buy now"
 * is a getBidLink at the fixed sale price (`auction.priceNano`), sent NON-custodially from
 * the user's wallet — so the buyer owns the NFT directly. Fee = 0.15% (feeBuyNow), same batch.
 */
export function BuyNowSheet({
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
  const [busy, setBusy] = useState(false);

  const priceNano = auction ? BigInt(Math.round(auction.priceNano)) : 0n;
  const fee = useMemo(() => feeBuyNow(priceNano), [priceNano]);
  const label = auction ? itemLabel(auction) : '';

  if (!auction) return null;

  async function confirm() {
    if (!auction || priceNano <= 0n) {
      toast('error', 'This item is not for sale right now');
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
      const prep = await prepareBid(auction, priceNano, accountJson, getInitData(), true);
      const feeMsg = { ...prep.feeMessage, payload: prep.feeMessage.payload ?? commentPayload(prep.ref) };
      const res = await pay([prep.bidMessage, feeMsg], prep.validUntil);
      if (res.status === 'sent') {
        toast('success', `Bought ${label} for ${fmtTon(priceNano)} GRAM`);
        onClose();
      } else if (res.status === 'demo') {
        toast('info', 'Demo — connect the backend to complete the purchase via Fragment');
      } else if (res.status === 'need_connect') {
        toast('info', 'Connect your wallet to buy');
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Purchase failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={`Buy ${label}`}>
      <div className="space-y-5">
        <div className="flex items-center justify-between rounded-2xl border border-god-border bg-god-surface/60 px-4 py-3">
          <span className="text-sm text-god-muted">Buy-now price</span>
          <span className="flex items-center gap-1 font-mono font-semibold text-god-gold">
            <TonIcon size={14} />
            {fmtTon(priceNano)}
          </span>
        </div>

        <FeeBreakdown
          costLabel="Item price"
          costNano={priceNano}
          feeNano={fee.feeNano}
          totalNano={fee.totalNano}
          effectivePct={fee.effectivePct}
          tonUsd={tonUsd}
        />

        <div className="flex items-start gap-2 rounded-xl bg-god-elevated/50 p-3 text-[11px] leading-relaxed text-god-faint">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-god-gold/70" />
          You pay directly from your own wallet, so the collectible transfers straight to you — no
          KYC, no account needed. bid.tg never holds the NFT.
        </div>

        <Button fullWidth loading={busy} onClick={confirm} leftIcon={<ShoppingCart className="h-4 w-4" />}>
          Buy for {fmtTon(priceNano)} GRAM
        </Button>
      </div>
    </Sheet>
  );
}

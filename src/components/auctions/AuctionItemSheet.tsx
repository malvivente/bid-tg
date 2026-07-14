import { useEffect, useMemo, useState } from 'react';
import { useTonAddress } from '@tonconnect/ui-react';
import { Gavel, Clock, TrendingUp, Zap, Target } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Button } from '@/components/ui';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { startAuctionMessage } from '@/lib/auction';
import { startability, type OwnedItem } from '@/lib/fragment-data';
import { toNano, fmtTon } from '@/lib/format';
import { cn } from '@/lib/cn';

const DURATIONS = [
  { label: '1 day', sec: 86_400 },
  { label: '3 days', sec: 259_200 },
  { label: '7 days', sec: 604_800 },
];

/**
 * Auction an NFT the user OWNS — fully on-chain, no Fragment, no operator wallet. Builds the
 * telemint `start_auction` message (validated client-side by startAuctionMessage, which mirrors
 * the contract's own checks) and the user signs it straight to their item. USERNAMES ONLY for now.
 */
export function AuctionItemSheet({
  item,
  open,
  onClose,
}: {
  item: OwnedItem | null;
  open: boolean;
  onClose: () => void;
}) {
  const owner = useTonAddress();
  const { pay } = usePayment();
  const toast = useToast();

  const [openingBid, setOpeningBid] = useState('2');
  const [buyNow, setBuyNow] = useState('');
  const [durationSec, setDurationSec] = useState(604_800);
  const [stepPct, setStepPct] = useState('5');
  const [extendMin, setExtendMin] = useState('60');
  const [beneficiary, setBeneficiary] = useState('');
  const [busy, setBusy] = useState(false);

  // reset to sane defaults each time the sheet opens; beneficiary defaults to the seller
  useEffect(() => {
    if (open) {
      setOpeningBid('2');
      setBuyNow('');
      setDurationSec(604_800);
      setStepPct('5');
      setExtendMin('60');
      setBeneficiary(owner || '');
    }
  }, [open, owner]);

  // Live client-side validation: try to build the config; a thrown Error is the reason.
  const built = useMemo(() => {
    if (!item) return { error: 'no item' as string | null, msg: null as ReturnType<typeof startAuctionMessage> | null };
    try {
      const msg = startAuctionMessage(item.nftAddress, {
        beneficiary: beneficiary.trim(),
        initialMinBidNano: toNano(parseFloat(openingBid) || 0),
        maxBidNano: buyNow.trim() ? toNano(parseFloat(buyNow) || 0) : 0n,
        minBidStepPct: parseInt(stepPct, 10),
        minExtendSec: Math.round((parseFloat(extendMin) || 0) * 60),
        durationSec,
      });
      return { error: null, msg };
    } catch (e) {
      return { error: e instanceof Error ? e.message : 'Invalid settings', msg: null };
    }
  }, [item, beneficiary, openingBid, buyNow, stepPct, extendMin, durationSec]);

  if (!item) return null;

  async function confirm() {
    if (!item || !built.msg) return;
    setBusy(true);
    try {
      // The contract enforces owner==sender, so a wrong item just bounces (NFT is never at
      // risk) — but check on-chain first to give a clear message instead of a silent revert.
      const st = await startability(item.nftAddress);
      if (st === 'on_auction') {
        toast('error', `${item.name} already has a live auction`);
        return;
      }
      const res = await pay([built.msg]);
      if (res.status === 'sent') {
        toast('success', `Auction started for ${item.name}`);
        onClose();
      } else if (res.status === 'demo') {
        toast('info', 'Demo — connect a wallet to sign the auction');
      } else if (res.status === 'need_connect') {
        toast('info', 'Connect your wallet to start the auction');
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not start the auction');
    } finally {
      setBusy(false);
    }
  }

  const beneIsSelf = beneficiary.trim() === owner;

  return (
    <Sheet open={open} onClose={onClose} title={`Auction ${item.name}`}>
      <div className="space-y-5">
        <p className="text-[11px] leading-relaxed text-god-faint">
          Runs entirely from your wallet — bid.tg never holds {item.name}. Once a bid lands you
          can no longer cancel, and the item is locked until the auction ends.
        </p>

        {/* Opening bid + buy-now */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Opening bid" icon={<TrendingUp className="h-3.5 w-3.5" />}>
            <NumInput value={openingBid} onChange={setOpeningBid} suffix="GRAM" />
          </Field>
          <Field label="Buy now (optional)" icon={<Zap className="h-3.5 w-3.5" />}>
            <NumInput value={buyNow} onChange={setBuyNow} placeholder="none" suffix="GRAM" />
          </Field>
        </div>

        {/* Duration */}
        <Field label="Duration" icon={<Clock className="h-3.5 w-3.5" />}>
          <div className="grid grid-cols-3 gap-2">
            {DURATIONS.map((d) => (
              <button
                key={d.sec}
                onClick={() => setDurationSec(d.sec)}
                className={cn(
                  'rounded-lg border py-2 text-xs font-medium transition-colors',
                  durationSec === d.sec
                    ? 'border-god-goldDeep/60 bg-god-goldDeep/10 text-god-goldDeep'
                    : 'border-god-border text-god-muted',
                )}
              >
                {d.label}
              </button>
            ))}
          </div>
        </Field>

        {/* Step + anti-snipe */}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Min bid step" icon={<Target className="h-3.5 w-3.5" />}>
            <NumInput value={stepPct} onChange={setStepPct} suffix="%" />
          </Field>
          <Field label="Anti-sniping" icon={<Clock className="h-3.5 w-3.5" />}>
            <NumInput value={extendMin} onChange={setExtendMin} suffix="min" />
          </Field>
        </div>
        <p className="-mt-3 text-[10px] text-god-faint">
          Every bid keeps at least the anti-sniping window on the clock. Each raise is also at
          least +1 GRAM, so a small % step barely matters on cheap items.
        </p>

        {/* Beneficiary */}
        <Field label="Proceeds go to">
          <input
            value={beneficiary}
            onChange={(e) => setBeneficiary(e.target.value)}
            spellCheck={false}
            autoCapitalize="none"
            className="input-field text-xs"
            placeholder="TON address"
          />
          <p className="mt-1 text-[10px] text-god-faint">
            {beneIsSelf ? 'Your connected wallet.' : 'A different wallet than yours — double-check it.'}
          </p>
        </Field>

        {built.error && beneficiary.trim() !== '' && (
          <div className="rounded-lg border border-god-danger/40 bg-god-danger/10 p-3 text-center text-xs text-god-danger">
            {built.error}
          </div>
        )}

        <Button fullWidth loading={busy} disabled={!!built.error} onClick={confirm} leftIcon={<Gavel className="h-4 w-4" />}>
          {built.msg
            ? `Start auction from ${fmtTon(toNano(parseFloat(openingBid) || 0))} GRAM`
            : 'Start auction'}
        </Button>
      </div>
    </Sheet>
  );
}

function Field({ label, icon, children }: { label: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="label-eyebrow flex items-center gap-1.5">
        {icon && <span className="text-god-goldDeep/70">{icon}</span>}
        {label}
      </label>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  suffix,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  suffix?: string;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input-field pr-12 text-sm font-bold"
      />
      {suffix && (
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-god-faint">
          {suffix}
        </span>
      )}
    </div>
  );
}

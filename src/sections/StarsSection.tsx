import { useEffect, useMemo, useState } from 'react';
import { Star, AtSign, Zap, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { quoteStars } from '@/lib/api';
import { commentPayload } from '@/lib/comment';
import { getInitData } from '@/lib/telegram';
import type { StarsQuote } from '@/types';
import { cn } from '@/lib/cn';

const PRESETS = [100, 500, 1000, 5000, 25000, 100000, 500000, 1000000];
const MIN = 50;
const MAX = 10_000_000; // Fragment's cap (~$150k)

function fmtStars(n: number): string {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1_000) return `${n / 1_000}K`;
  return String(n);
}

export function StarsSection({ tonUsd }: { tonUsd: number }) {
  const [recipient, setRecipient] = useState('');
  const [qty, setQty] = useState(100);
  const [quote, setQuote] = useState<StarsQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { pay } = usePayment();

  useEffect(() => {
    let alive = true;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteStars(recipient || 'preview', qty, getInitData(), tonUsd);
        if (alive) setQuote(q);
      } finally {
        if (alive) setQuoting(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [qty, recipient, tonUsd]);

  const recipientOk = useMemo(() => /^@?[a-zA-Z0-9_]{4,32}$/.test(recipient.trim()), [recipient]);

  async function buy() {
    if (!recipientOk) {
      toast('error', 'Enter a valid @username');
      return;
    }
    if (qty < MIN) {
      toast('error', `Minimum ${MIN} Stars`);
      return;
    }
    if (!quote) return;
    setBusy(true);
    try {
      const res = await pay([
        { address: quote.hotWallet, amount: quote.costNano.toString(), payload: commentPayload(quote.ref) },
        { address: quote.treasury, amount: quote.feeNano.toString(), payload: commentPayload(quote.ref) },
      ]);
      if (res.status === 'sent') toast('success', `Paid! ${qty} Stars incoming for @${recipient.replace('@', '')}`);
      else if (res.status === 'demo') toast('info', `Demo — connect the backend to deliver ${qty} Stars`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-app space-y-5 py-5">
      <SectionHero
        icon={<Star className="h-6 w-6" />}
        title="Buy Telegram Stars"
        subtitle="Gift Stars to any @username — no KYC, no account needed. Delivered through our verified Fragment account."
      />

      {/* Recipient */}
      <div className="space-y-2">
        <label className="label-eyebrow">Recipient</label>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-god-gold/70" />
          <input
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="username"
            spellCheck={false}
            autoCapitalize="none"
            className="input-field pl-10"
          />
        </div>
      </div>

      {/* Quantity */}
      <div className="space-y-3">
        <label className="label-eyebrow">
          Amount · {MIN}–{MAX.toLocaleString('en-US')} ★
        </label>
        <div className="relative">
          <Star
            className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-god-gold"
            fill="currentColor"
          />
          <input
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            value={qty}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setQty(isNaN(n) ? 0 : Math.min(MAX, Math.max(0, n)));
            }}
            className={cn(
              'input-field pl-10 text-lg font-bold',
              qty > 0 && qty < MIN && 'border-god-danger/50',
            )}
          />
        </div>
        <div className="grid grid-cols-4 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setQty(p)}
              className={cn(
                'flex items-center justify-center gap-1 rounded-xl border py-2 text-sm font-medium transition-all',
                qty === p
                  ? 'border-transparent bg-gold-gradient text-god-bg'
                  : 'border-god-border bg-god-surface text-god-muted hover:text-god-cream',
              )}
            >
              <Star className="h-3 w-3" fill="currentColor" />
              {fmtStars(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Quote */}
      {quote && (
        <div className={cn('transition-opacity', quoting && 'opacity-50')}>
          <FeeBreakdown
            costLabel={`${qty.toLocaleString('en-US')} Stars`}
            costNano={quote.costNano}
            feeNano={quote.feeNano}
            totalNano={quote.totalNano}
            effectivePct={quote.effectivePct}
            tonUsd={tonUsd}
            estimated={quote.estimated}
          />
        </div>
      )}

      <Button
        fullWidth
        loading={busy}
        disabled={qty < MIN}
        onClick={buy}
        leftIcon={<Zap className="h-4 w-4" />}
      >
        Buy {qty.toLocaleString('en-US')} Stars
      </Button>

      <TrustNote />
    </div>
  );
}

export function SectionHero({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="card card-hover animate-fade-up overflow-hidden p-5">
      <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-god-gold/10 blur-2xl" />
      <div className="flex items-start gap-3.5">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gold-gradient text-god-bg shadow-goldSoft">
          {icon}
        </div>
        <div>
          <h2 className="font-display text-xl font-bold text-god-cream">{title}</h2>
          <p className="mt-1 text-xs leading-relaxed text-god-muted">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function TrustNote() {
  return (
    <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-god-faint">
      <span className="flex items-center gap-1">
        <ShieldCheck className="h-3.5 w-3.5 text-god-gold/70" /> No KYC
      </span>
      <span className="flex items-center gap-1">
        <Zap className="h-3.5 w-3.5 text-god-gold/70" /> Instant
      </span>
      <span className="flex items-center gap-1">
        <Star className="h-3.5 w-3.5 text-god-gold/70" /> Lowest fees
      </span>
    </div>
  );
}

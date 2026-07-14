import { useEffect, useMemo, useState } from 'react';
import { AtSign, Zap, ShieldCheck, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { TonIcon } from '@/components/TonIcon';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { quoteTopup } from '@/lib/api';
import { commentPayload } from '@/lib/comment';
import { getInitData } from '@/lib/telegram';
import { SectionHero } from '@/sections/StarsSection';
import type { TopupQuote } from '@/types';
import { cn } from '@/lib/cn';

const PRESETS = [10, 50, 100, 500, 1000, 5000];
const MIN = 1;
const MAX = 1_000_000;

export function TopupSection({ tonUsd }: { tonUsd: number }) {
  const [recipient, setRecipient] = useState('');
  const [amount, setAmount] = useState(100);
  const [quote, setQuote] = useState<TopupQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { pay } = usePayment();

  useEffect(() => {
    let alive = true;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteTopup(recipient || 'preview', amount || MIN, getInitData());
        if (alive) setQuote(q);
      } finally {
        if (alive) setQuoting(false);
      }
    }, 250);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [amount, recipient]);

  const recipientOk = useMemo(() => /^@?[a-zA-Z0-9_]{4,32}$/.test(recipient.trim()), [recipient]);

  async function buy() {
    if (!recipientOk) {
      toast('error', 'Enter a valid @username');
      return;
    }
    if (amount < MIN) {
      toast('error', `Minimum ${MIN} GRAM`);
      return;
    }
    if (!quote) return;
    setBusy(true);
    try {
      const res = await pay([
        { address: quote.hotWallet, amount: quote.costNano.toString(), payload: commentPayload(quote.ref) },
        { address: quote.treasury, amount: quote.feeNano.toString(), payload: commentPayload(quote.ref) },
      ]);
      if (res.status === 'sent')
        toast('success', `Paid! Topping up ${amount.toLocaleString('en-US')} GRAM for @${recipient.replace('@', '')}`);
      else if (res.status === 'demo') toast('info', `Demo — connect the backend to top up ${amount} GRAM`);
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-app space-y-5 py-5">
      <SectionHero
        icon={<Megaphone className="h-6 w-6" />}
        title="Top up ads / GRAM"
        subtitle="Add GRAM to any Telegram account's Ads balance — no KYC. Funded through our verified Fragment account."
      />

      {/* Recipient */}
      <div className="space-y-2">
        <label className="label-eyebrow">Account to top up</label>
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

      {/* Amount */}
      <div className="space-y-3">
        <label className="label-eyebrow">
          Amount · {MIN}–{MAX.toLocaleString('en-US')} GRAM
        </label>
        <div className="relative">
          <TonIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-god-gold" />
          <input
            type="number"
            inputMode="numeric"
            min={MIN}
            max={MAX}
            value={amount}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              setAmount(isNaN(n) ? 0 : Math.min(MAX, Math.max(0, n)));
            }}
            className={cn('input-field pl-10 text-lg font-bold', amount > 0 && amount < MIN && 'border-god-danger/50')}
          />
        </div>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setAmount(p)}
              className={cn(
                'flex items-center justify-center gap-1 rounded-xl border py-2 text-sm font-medium transition-all',
                amount === p
                  ? 'border-transparent bg-gold-gradient text-god-bg'
                  : 'border-god-border bg-god-surface text-god-muted hover:text-god-cream',
              )}
            >
              <TonIcon size={12} />
              {p.toLocaleString('en-US')}
            </button>
          ))}
        </div>
      </div>

      {/* Quote */}
      {quote && (
        <div className={cn('transition-opacity', quoting && 'opacity-50')}>
          <FeeBreakdown
            costLabel={`${amount.toLocaleString('en-US')} GRAM top-up`}
            costNano={quote.costNano}
            feeNano={quote.feeNano}
            totalNano={quote.totalNano}
            effectivePct={quote.effectivePct}
            tonUsd={tonUsd}
            estimated={quote.estimated}
          />
        </div>
      )}

      <Button fullWidth loading={busy} disabled={amount < MIN} onClick={buy} leftIcon={<Zap className="h-4 w-4" />}>
        Top up {amount.toLocaleString('en-US')} GRAM
      </Button>

      <div className="flex items-center justify-center gap-4 pt-1 text-[11px] text-god-faint">
        <span className="flex items-center gap-1">
          <ShieldCheck className="h-3.5 w-3.5 text-god-gold/70" /> No KYC
        </span>
        <span className="flex items-center gap-1">
          <Zap className="h-3.5 w-3.5 text-god-gold/70" /> Instant
        </span>
        <span className="flex items-center gap-1">
          <Megaphone className="h-3.5 w-3.5 text-god-gold/70" /> For ads &amp; more
        </span>
      </div>
    </div>
  );
}

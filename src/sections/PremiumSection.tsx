import { useEffect, useMemo, useState } from 'react';
import { Crown, AtSign, Gift, Check } from 'lucide-react';
import { Button, Segmented } from '@/components/ui';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { SectionHero } from './StarsSection';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { quotePremium } from '@/lib/api';
import { commentPayload } from '@/lib/comment';
import { getInitData } from '@/lib/telegram';
import type { PremiumQuote } from '@/types';

const PLANS = [
  { months: 3, label: '3 months' },
  { months: 6, label: '6 months' },
  { months: 12, label: '1 year' },
] as const;

const PERKS = [
  'Doubled limits on everything',
  'No ads, faster downloads',
  'Exclusive stickers & reactions',
  'Premium badge & app icons',
];

export function PremiumSection({ tonUsd }: { tonUsd: number }) {
  const [recipient, setRecipient] = useState('');
  const [months, setMonths] = useState<number>(3);
  const [quote, setQuote] = useState<PremiumQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const { pay } = usePayment();

  useEffect(() => {
    let alive = true;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quotePremium(recipient || 'preview', months, getInitData(), tonUsd);
        if (alive) setQuote(q);
      } finally {
        if (alive) setQuoting(false);
      }
    }, 200);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [months, recipient, tonUsd]);

  const recipientOk = useMemo(() => /^@?[a-zA-Z0-9_]{4,32}$/.test(recipient.trim()), [recipient]);

  async function buy() {
    if (!recipientOk) return toast('error', 'Enter a valid @username');
    if (!quote) return;
    setBusy(true);
    try {
      const res = await pay([
        { address: quote.hotWallet, amount: quote.costNano.toString(), payload: commentPayload(quote.ref) },
        { address: quote.treasury, amount: quote.feeNano.toString(), payload: commentPayload(quote.ref) },
      ]);
      if (res.status === 'sent') toast('success', `Premium (${months}mo) on its way to @${recipient.replace('@', '')}`);
      else if (res.status === 'demo') toast('info', 'Demo — connect the backend to deliver Premium');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-app space-y-5 py-5">
      <SectionHero
        icon={<Crown className="h-6 w-6" />}
        title="Gift Telegram Premium"
        subtitle="Send Premium to any @username with a flat 1 GRAM fee — the lowest around. No KYC required."
      />

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

      <div className="space-y-2">
        <label className="label-eyebrow">Duration</label>
        <Segmented
          value={months}
          onChange={setMonths}
          options={PLANS.map((p) => ({ value: p.months, label: p.label }))}
        />
      </div>

      <div className="card p-4">
        <div className="label-eyebrow mb-2">What they get</div>
        <ul className="grid grid-cols-1 gap-2">
          {PERKS.map((perk) => (
            <li key={perk} className="flex items-center gap-2 text-sm text-god-cream/85">
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-god-gold/15">
                <Check className="h-3 w-3 text-god-gold" />
              </span>
              {perk}
            </li>
          ))}
        </ul>
      </div>

      {quote && (
        <div className={quoting ? 'opacity-50 transition-opacity' : 'transition-opacity'}>
          <FeeBreakdown
            costLabel={`Premium · ${months} months`}
            costNano={quote.costNano}
            feeNano={quote.feeNano}
            totalNano={quote.totalNano}
            effectivePct={quote.effectivePct}
            tonUsd={tonUsd}
            estimated={quote.estimated}
          />
        </div>
      )}

      <Button fullWidth loading={busy} onClick={buy} leftIcon={<Gift className="h-4 w-4" />}>
        Gift Premium
      </Button>
    </div>
  );
}

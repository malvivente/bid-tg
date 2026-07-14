import { TonIcon } from './TonIcon';
import { fmtTon, fmtUsd } from '@/lib/format';
import { cn } from '@/lib/cn';

interface Props {
  costNano: bigint;
  feeNano: bigint;
  totalNano: bigint;
  effectivePct: number;
  tonUsd: number;
  costLabel?: string;
  /** optional "vs Fragment" comparison figure in nanoTON to show savings */
  fragmentNano?: bigint;
  /** true when the cost is a client-side estimate (mock mode) */
  estimated?: boolean;
}

function Amount({
  nano,
  tonUsd,
  strong,
  approx,
}: {
  nano: bigint;
  tonUsd: number;
  strong?: boolean;
  approx?: boolean;
}) {
  return (
    <span className="flex flex-col items-end">
      <span className={cn('flex items-center gap-1', strong ? 'text-god-gold' : 'text-god-cream/90')}>
        <TonIcon size={strong ? 15 : 13} />
        <span className={cn('font-mono tabular-nums', strong && 'text-base font-bold')}>
          {approx ? '~' : ''}
          {fmtTon(nano)}
        </span>
      </span>
      <span className="text-[10px] text-god-faint">${fmtUsd(nano, tonUsd)}</span>
    </span>
  );
}

export function FeeBreakdown({
  costNano,
  feeNano,
  totalNano,
  effectivePct,
  tonUsd,
  costLabel = 'Cost',
  fragmentNano,
  estimated,
}: Props) {
  const saving = fragmentNano != null ? fragmentNano - totalNano : null;
  return (
    <div className="rounded-2xl border border-god-border bg-god-surface/60 p-4">
      <div className="flex items-center justify-between py-1.5">
        <span className="text-sm text-god-muted">{costLabel}</span>
        <Amount nano={costNano} tonUsd={tonUsd} approx={estimated} />
      </div>
      <div className="flex items-center justify-between py-1.5">
        <span className="flex items-center gap-1.5 text-sm text-god-muted">
          bid.tg fee
          <span className="chip px-1.5 py-0 text-[10px]">{effectivePct.toFixed(2)}%</span>
        </span>
        <Amount nano={feeNano} tonUsd={tonUsd} />
      </div>
      <div className="my-2 divider" />
      <div className="flex items-center justify-between py-0.5">
        <span className="text-sm font-semibold text-god-cream">Total</span>
        <Amount nano={totalNano} tonUsd={tonUsd} strong approx={estimated} />
      </div>
      {saving != null && saving > 0n && (
        <div className="mt-2 flex items-center justify-center gap-1 rounded-lg bg-god-success/10 py-1.5 text-[11px] font-medium text-god-success">
          You save ~{fmtTon(saving)} GRAM vs Fragment
        </div>
      )}
      {estimated && (
        <p className="mt-2 text-center text-[10px] leading-relaxed text-god-faint">
          Estimated price — the exact amount is confirmed by Fragment at checkout.
        </p>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { useTonWallet } from '@tonconnect/ui-react';
import { Rocket, Info, AtSign, Hash } from 'lucide-react';
import { Sheet } from '@/components/Sheet';
import { Button, Skeleton } from '@/components/ui';
import { FeeBreakdown } from '@/components/FeeBreakdown';
import { TonIcon } from '@/components/TonIcon';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { getStartInfo, prepareStart, type StartInfo } from '@/lib/api';
import { commentPayload } from '@/lib/comment';
import { feeStartAuction } from '@/lib/fee';
import { toNano, toTon, fmtTon, itemLabel } from '@/lib/format';
import { getInitData } from '@/lib/telegram';
import type { ItemKind } from '@/types';
import { cn } from '@/lib/cn';

const USERNAME_RE = /^@?[a-zA-Z0-9_]{4,32}$/;
const NUMBER_RE = /^888\d{7,10}$/;

export function StartAuctionSheet({
  username,
  open,
  onClose,
  tonUsd,
  kind = 'username',
}: {
  username: string | null;
  open: boolean;
  onClose: () => void;
  tonUsd: number;
  kind?: ItemKind;
}) {
  const toast = useToast();
  const { pay } = usePayment();
  const wallet = useTonWallet();
  const isNumber = kind === 'number';
  const [name, setName] = useState('');
  const [info, setInfo] = useState<StartInfo | null>(null);
  const [infoError, setInfoError] = useState<string | null>(null);
  const [loadingInfo, setLoadingInfo] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);

  // seed the id field when the sheet opens
  useEffect(() => {
    if (open) {
      setName((username ?? '').replace(isNumber ? /\D/g : /@/g, ''));
      setInfo(null);
      setInfoError(null);
      setAmount('');
    }
  }, [open, username, isNumber]);

  const nameOk = isNumber ? NUMBER_RE.test(name.replace(/\D/g, '')) : USERNAME_RE.test(name.trim());
  const label = itemLabel({ kind, username: info?.username ?? name, display: info?.display });

  // fetch Fragment start info once the id looks valid (debounced)
  useEffect(() => {
    if (!open || !nameOk) {
      setInfo(null);
      setInfoError(null);
      return;
    }
    let alive = true;
    setLoadingInfo(true);
    setInfo(null);
    setInfoError(null);
    const t = setTimeout(async () => {
      try {
        const i = await getStartInfo(name.trim(), getInitData(), kind);
        if (alive) setInfo(i);
      } catch (e) {
        // Without this catch the failure was swallowed: info stayed null, the spinner
        // stopped, and the sheet just sat there empty with no reason given.
        if (alive) setInfoError(e instanceof Error ? e.message : 'Could not load Fragment info');
      } finally {
        if (alive) setLoadingInfo(false);
      }
    }, 350);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [name, nameOk, open, kind]);

  const minNano = info ? BigInt(info.initialMinNano) : 0n;
  const minTon = toTon(minNano);
  // Round the default opening bid UP to cents — Math.round could land below the Fragment
  // minimum and get rejected as too small (same fix as BidSheet).
  const shown = amount === '' && info ? String(Math.ceil(minTon * 100) / 100) : amount;
  const parsed = parseFloat(shown);
  const valid = !!info && !isNaN(parsed) && toNano(parsed) >= minNano;
  const fee = useMemo(
    () => feeStartAuction(valid ? toNano(parsed) : minNano),
    [parsed, valid, minNano],
  );

  async function confirm() {
    if (!info || !valid) return toast('error', `Opening bid must be ≥ ${fmtTon(minNano)} GRAM`);
    const userAddress = wallet?.account?.address;
    if (!userAddress) return toast('info', 'Connect your wallet — the collectible is sent there if you win');
    setBusy(true);
    try {
      // Create the tracked order, then pay ONE message (opening bid + fee) to the auction wallet.
      const prep = await prepareStart(info.username, kind, toNano(parsed), userAddress, getInitData());
      const res = await pay([
        { address: prep.hotWallet, amount: prep.totalNano, payload: commentPayload(prep.ref) },
      ]);
      if (res.status === 'sent') {
        toast('success', `Starting the auction for ${label}…`);
        onClose();
      } else if (res.status === 'demo') {
        toast('info', 'Demo — connect the backend to start the auction via Fragment');
      } else if (res.status === 'need_connect') {
        toast('info', 'Connect your wallet to start the auction');
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not start auction');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Start an auction">
      <div className="space-y-5">
        <div className="space-y-2">
          <label className="label-eyebrow">{isNumber ? 'Fragment +888 number' : 'Fragment username'}</label>
          <div className="relative">
            {isNumber ? (
              <Hash className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-god-gold/70" />
            ) : (
              <AtSign className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-god-gold/70" />
            )}
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={isNumber ? 'e.g. 88801234567' : 'e.g. json1'}
              inputMode={isNumber ? 'numeric' : undefined}
              spellCheck={false}
              autoCapitalize="none"
              className="input-field pl-10"
            />
          </div>
          <p className="text-[11px] text-god-faint">
            {isNumber
              ? "Any +888 number listed on Fragment that isn't at auction yet."
              : "Any username listed on Fragment that isn't at auction yet."}
          </p>
        </div>

        {nameOk && loadingInfo && (
          <div className="space-y-3">
            <Skeleton className="h-14 w-full" />
            <Skeleton className="h-28 w-full" />
          </div>
        )}

        {nameOk && !loadingInfo && infoError && (
          <div className="rounded-2xl border border-god-danger/40 bg-god-danger/10 p-4 text-center text-sm text-god-danger">
            {infoError}
          </div>
        )}

        {nameOk && info && info.status && info.status !== 'available' ? (
          <div className="rounded-2xl border border-god-border bg-god-elevated/50 p-4 text-center text-sm text-god-muted">
            <b className="text-god-cream">{label}</b> is{' '}
            <b className="text-god-gold">{info.status}</b> on Fragment — you can only start an auction
            on an <b>available</b> {isNumber ? 'number' : 'username'}.
          </div>
        ) : nameOk && info ? (
          <>
            <div className="flex items-center justify-between rounded-2xl border border-god-border bg-god-surface/60 px-4 py-3">
              <span className="text-sm text-god-muted">Fragment minimum</span>
              <span className="flex items-center gap-1 font-mono font-semibold text-god-gold">
                <TonIcon size={14} />
                {fmtTon(minNano)}
              </span>
            </div>

            <div className="space-y-2">
              <label className="label-eyebrow">Opening bid (GRAM)</label>
              <div className="relative">
                <TonIcon size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-god-gold" />
                <input
                  type="number"
                  inputMode="decimal"
                  value={shown}
                  onChange={(e) => setAmount(e.target.value)}
                  min={minTon}
                  step="0.01"
                  className={cn('input-field pl-10 text-lg font-bold', !valid && 'border-god-danger/50')}
                />
              </div>
            </div>

            <FeeBreakdown
              costLabel="Opening bid"
              costNano={valid ? toNano(parsed) : minNano}
              feeNano={fee.feeNano}
              totalNano={fee.totalNano}
              effectivePct={fee.effectivePct}
              tonUsd={tonUsd}
            />

            <div className="flex items-start gap-2 rounded-xl bg-god-elevated/50 p-3 text-[11px] leading-relaxed text-god-faint">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-god-gold/70" />
              We start the 7-day auction with our verified account. You prepay the opening bid + fee;
              if you win, the collectible is transferred to your wallet — if you're outbid, your bid
              is refunded (the fee covers starting the auction).
            </div>

            <Button fullWidth loading={busy} onClick={confirm} leftIcon={<Rocket className="h-4 w-4" />}>
              Start auction
            </Button>
          </>
        ) : null}
      </div>
    </Sheet>
  );
}

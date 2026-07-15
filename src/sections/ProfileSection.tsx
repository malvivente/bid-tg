import { useEffect, useState } from 'react';
import { useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { Wallet, Star, Crown, Gavel, ShieldCheck, ExternalLink, Receipt, Package, Loader2, LogOut } from 'lucide-react';
import { ConnectButton } from '@/components/ConnectButton';
import { TelegramLoginButton } from '@/components/TelegramLoginButton';
import { EmptyState, Skeleton } from '@/components/ui';
import { AuctionItemSheet } from '@/components/auctions/AuctionItemSheet';
import { useToast } from '@/components/Toast';
import { usePayment } from '@/hooks/usePayment';
import { cancelAuctionMessage } from '@/lib/auction';
import { getTgUser, isTelegram } from '@/lib/telegram';
import { useAuth } from '@/lib/auth';
import { webLoginAvailable } from '@/lib/api';
import { fetchOwnedUsernames, auctionStatusOf, type OwnedItem, type AuctionStatus } from '@/lib/fragment-data';
import { shortAddr, endsText } from '@/lib/format';

const FEES = [
  { icon: Star, label: 'Stars', value: '1% · min 0.05 GRAM' },
  { icon: Crown, label: 'Premium', value: 'flat 1 GRAM' },
  { icon: Gavel, label: 'Bids (live auction)', value: '0.15% · min 0.1 GRAM' },
];

export function ProfileSection() {
  const wallet = useTonWallet();
  const address = useTonAddress();
  const auth = useAuth();
  // Identity comes from the Mini App (getTgUser) OR the web login (auth.user), whichever applies.
  const person = auth.user ?? getTgUser();
  const inTelegram = isTelegram();

  const { pay } = usePayment();
  const toast = useToast();

  async function handleLogin(payload: Record<string, unknown>) {
    try {
      await auth.login(payload);
      toast('success', 'Signed in with Telegram');
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Login failed');
    }
  }
  const [assets, setAssets] = useState<OwnedItem[] | null>(null);
  const [auctioning, setAuctioning] = useState<OwnedItem | null>(null);
  const [statuses, setStatuses] = useState<Record<string, AuctionStatus>>({});
  const [cancelling, setCancelling] = useState<string | null>(null);

  // Load the usernames the connected wallet owns (for the "auction your own" flow).
  useEffect(() => {
    if (!address) {
      setAssets(null);
      setStatuses({});
      return;
    }
    let alive = true;
    setAssets(null);
    setStatuses({});
    fetchOwnedUsernames(address).then((a) => alive && setAssets(a));
    return () => {
      alive = false;
    };
  }, [address]);

  // Per-item on-chain auction status → decides Auction vs Cancel vs locked. Sequential (owned
  // lists are small) to avoid a TonAPI burst; buttons resolve as each status lands.
  useEffect(() => {
    if (!assets || assets.length === 0) return;
    let alive = true;
    (async () => {
      for (const it of assets) {
        if (!alive) return;
        const st = await auctionStatusOf(it.nftAddress);
        if (alive) setStatuses((s) => ({ ...s, [it.nftAddress]: st }));
      }
    })();
    return () => {
      alive = false;
    };
  }, [assets]);

  async function cancelAuction(it: OwnedItem) {
    setCancelling(it.nftAddress);
    try {
      // Re-check right before signing: a bid may have landed since the list loaded, and the
      // contract throws 221 on cancel-after-bid. Cheaper to catch it here than to bounce.
      const st = await auctionStatusOf(it.nftAddress);
      if (st.kind !== 'cancellable') {
        setStatuses((s) => ({ ...s, [it.nftAddress]: st }));
        toast('error', st.kind === 'live' || st.kind === 'ended' ? `${it.name} already has bids — it can no longer be cancelled` : `No cancellable auction on ${it.name}`);
        return;
      }
      const res = await pay([cancelAuctionMessage(it.nftAddress)]);
      if (res.status === 'sent') {
        toast('success', `Auction for ${it.name} cancelled`);
        setStatuses((s) => ({ ...s, [it.nftAddress]: { kind: 'free' } }));
      } else if (res.status === 'need_connect') {
        toast('info', 'Connect your wallet to cancel');
      }
    } catch (e) {
      toast('error', e instanceof Error ? e.message : 'Could not cancel the auction');
    } finally {
      setCancelling(null);
    }
  }

  return (
    <div className="container-app space-y-5 py-5">
      {/* Identity */}
      <div className="card animate-fade-up p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-gold-gradient text-xl font-bold text-god-bg">
            {person?.photo_url ? (
              <img src={person.photo_url} alt="" className="h-full w-full object-cover" />
            ) : (
              (person?.first_name?.[0] ?? 'G').toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold text-god-cream">
              {person ? `${person.first_name ?? ''} ${person.last_name ?? ''}`.trim() || 'Telegram user' : 'Guest'}
            </div>
            <div className="text-xs text-god-muted">
              {person?.username
                ? `@${person.username}`
                : person
                  ? 'Signed in'
                  : inTelegram
                    ? 'Loading your Telegram account…'
                    : 'Sign in to save your orders'}
            </div>
          </div>
          {auth.loggedIn && (
            <button
              onClick={() => {
                auth.logout();
                toast('info', 'Signed out');
              }}
              aria-label="Log out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-god-border text-god-muted transition-colors hover:text-god-danger"
            >
              <LogOut className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Web login — shown only in a browser (not the Mini App) when not yet signed in */}
      {!inTelegram && !auth.loggedIn && webLoginAvailable && (
        <div className="space-y-2">
          <label className="label-eyebrow">Sign in</label>
          <div className="card flex flex-col items-center gap-2 p-4">
            <p className="text-center text-[11px] text-god-faint">
              Connect your Telegram account to keep your orders and bids across devices.
            </p>
            <TelegramLoginButton onAuth={handleLogin} />
          </div>
        </div>
      )}

      {/* Wallet */}
      <div className="space-y-2">
        <label className="label-eyebrow">Wallet</label>
        <div className="card flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-god-elevated text-god-gold">
              <Wallet className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-medium text-god-cream">
                {wallet ? shortAddr(address) : 'Not connected'}
              </div>
              <div className="text-[11px] text-god-faint">
                {wallet?.device.appName ?? 'TON Connect'}
              </div>
            </div>
          </div>
          <ConnectButton />
        </div>
      </div>

      {/* Fees */}
      <div className="space-y-2">
        <label className="label-eyebrow">bid.tg fees — the lowest around</label>
        <div className="card divide-y divide-god-border/40">
          {FEES.map(({ icon: Icon, label, value }) => (
            <div key={label} className="flex items-center justify-between px-4 py-3">
              <span className="flex items-center gap-2.5 text-sm text-god-cream/90">
                <Icon className="h-4 w-4 text-god-gold/80" />
                {label}
              </span>
              <span className="text-xs font-medium text-god-muted">{value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Owned assets — auction your own collectibles */}
      {wallet && (
        <div className="space-y-2">
          <label className="label-eyebrow">Your usernames</label>
          <div className="card">
            {assets === null ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : assets.length === 0 ? (
              <EmptyState icon={<Package className="h-7 w-7" />} title="No usernames here" hint="Usernames you own on this wallet can be put up for auction from here." />
            ) : (
              <div className="divide-y divide-god-border/40">
                {assets.map((it) => {
                  const st = statuses[it.nftAddress];
                  return (
                    <div key={it.nftAddress} className="flex items-center justify-between gap-2 px-4 py-3">
                      <span className="flex items-center gap-2.5 min-w-0">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-god-elevated font-display text-xs font-bold text-god-goldDeep">
                          {it.username.slice(0, 2).toLowerCase()}
                        </span>
                        <span className="truncate text-sm font-medium text-god-cream">{it.name}</span>
                      </span>
                      <AssetAction
                        status={st}
                        busy={cancelling === it.nftAddress}
                        onAuction={() => setAuctioning(it)}
                        onCancel={() => cancelAuction(it)}
                      />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Orders */}
      <div className="space-y-2">
        <label className="label-eyebrow">Your orders</label>
        <div className="card">
          <EmptyState icon={<Receipt className="h-7 w-7" />} title="No orders yet" hint="Your Stars, Premium and bids will show up here." />
        </div>
      </div>

      <AuctionItemSheet item={auctioning} open={!!auctioning} onClose={() => setAuctioning(null)} />

      <div className="flex flex-col gap-2 pt-1">
        <a href="https://fragment.com/about" target="_blank" rel="noreferrer" className="btn-ghost justify-between">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-god-gold/70" /> How bid.tg works
          </span>
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      <p className="pb-2 text-center text-[10px] text-god-faint">bid.tg · powered by TON &amp; Fragment</p>
    </div>
  );
}

/** The right-hand action for an owned item, chosen by its live on-chain auction status. */
function AssetAction({
  status,
  busy,
  onAuction,
  onCancel,
}: {
  status?: AuctionStatus;
  busy: boolean;
  onAuction: () => void;
  onCancel: () => void;
}) {
  if (!status) return <span className="shrink-0 text-[11px] text-god-faint">…</span>;
  if (status.kind === 'cancellable') {
    return (
      <button
        onClick={onCancel}
        disabled={busy}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-god-danger/50 px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-god-danger transition-colors hover:bg-god-danger/10 disabled:opacity-50"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
        Cancel
      </button>
    );
  }
  if (status.kind === 'live' || status.kind === 'ended') {
    const ends = status.endsAt ? endsText(status.endsAt) : null;
    return (
      <span className="chip shrink-0 border-god-goldDeep/30 text-god-goldDeep">
        {status.kind === 'live' && ends && !ends.closed ? `Live · ${ends.text}` : 'On auction'}
      </span>
    );
  }
  // 'free' or 'unknown' — offer to start one (the sheet re-checks before signing anyway)
  return (
    <button className="btn-outline shrink-0 px-3 py-1.5 text-xs" onClick={onAuction}>
      Auction
    </button>
  );
}

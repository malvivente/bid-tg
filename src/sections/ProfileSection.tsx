import { useEffect, useState } from 'react';
import { useTonAddress, useTonWallet } from '@tonconnect/ui-react';
import { Wallet, Star, Crown, Gavel, ShieldCheck, ExternalLink, Receipt, Package } from 'lucide-react';
import { ConnectButton } from '@/components/ConnectButton';
import { EmptyState, Skeleton } from '@/components/ui';
import { AuctionItemSheet } from '@/components/auctions/AuctionItemSheet';
import { getTgUser } from '@/lib/telegram';
import { fetchOwnedUsernames, type OwnedItem } from '@/lib/fragment-data';
import { shortAddr } from '@/lib/format';

const FEES = [
  { icon: Star, label: 'Stars', value: '1% · min 0.05 GRAM' },
  { icon: Crown, label: 'Premium', value: 'flat 1 GRAM' },
  { icon: Gavel, label: 'Bids (live auction)', value: '0.15% · min 0.1 GRAM' },
];

export function ProfileSection() {
  const wallet = useTonWallet();
  const address = useTonAddress();
  const user = getTgUser();

  const [assets, setAssets] = useState<OwnedItem[] | null>(null);
  const [auctioning, setAuctioning] = useState<OwnedItem | null>(null);

  // Load the usernames the connected wallet owns (for the "auction your own" flow).
  useEffect(() => {
    if (!address) {
      setAssets(null);
      return;
    }
    let alive = true;
    setAssets(null);
    fetchOwnedUsernames(address).then((a) => alive && setAssets(a));
    return () => {
      alive = false;
    };
  }, [address]);

  return (
    <div className="container-app space-y-5 py-5">
      {/* Identity */}
      <div className="card animate-fade-up p-5">
        <div className="flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold-gradient text-xl font-bold text-god-bg">
            {user?.photo_url ? (
              <img src={user.photo_url} alt="" className="h-full w-full rounded-2xl object-cover" />
            ) : (
              (user?.first_name?.[0] ?? 'G').toUpperCase()
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-display text-lg font-bold text-god-cream">
              {user ? `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim() : 'Guest'}
            </div>
            <div className="text-xs text-god-muted">
              {user?.username ? `@${user.username}` : 'Open in Telegram to sign in'}
            </div>
          </div>
        </div>
      </div>

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
                {assets.map((it) => (
                  <div key={it.nftAddress} className="flex items-center justify-between px-4 py-3">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-god-elevated font-display text-xs font-bold text-god-goldDeep">
                        {it.username.slice(0, 2).toLowerCase()}
                      </span>
                      <span className="truncate text-sm font-medium text-god-cream">{it.name}</span>
                    </span>
                    <button className="btn-outline shrink-0 px-3 py-1.5 text-xs" onClick={() => setAuctioning(it)}>
                      Auction
                    </button>
                  </div>
                ))}
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

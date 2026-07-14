import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, RefreshCw, Gift, Layers, SlidersHorizontal, Check } from 'lucide-react';
import { BidSheet } from '@/components/auctions/BidSheet';
import { BuyNowSheet } from '@/components/auctions/BuyNowSheet';
import { Sheet } from '@/components/Sheet';
import { TonIcon } from '@/components/TonIcon';
import { Segmented, Skeleton, EmptyState, Button } from '@/components/ui';
import {
  listGiftCollections,
  searchGifts,
  giftAttributes,
  type GiftCollection,
  type GiftItem,
  type GiftFilter,
  type GiftAttributes,
} from '@/lib/api';
import { getInitData } from '@/lib/telegram';
import { fmtTon, fmtUsd } from '@/lib/format';
import type { Auction } from '@/types';
import { cn } from '@/lib/cn';

const ALL = 'all';
type SortKey = 'price_asc' | 'price_desc';
const emptyAttrs = (): GiftAttributes => ({ Model: [], Backdrop: [], Symbol: [] });

function giftAuction(it: GiftItem): Auction {
  const price = Number(it.priceNano);
  return {
    domain: it.slug,
    username: it.slug,
    kind: 'gift',
    display: `${it.name} #${it.num}`,
    priceNano: price,
    endsAt: 0,
    minNextBidNano: Math.ceil(price * 1.05),
    bidStep: 0.05,
  };
}

export function GiftsSection({ tonUsd }: { tonUsd: number }) {
  const [collections, setCollections] = useState<GiftCollection[]>([]);
  const [loadingCollections, setLoadingCollections] = useState(true);

  // active catalog target: null = collection grid; else a slug or ALL
  const [collection, setCollection] = useState<string | null>(null);
  const [collectionName, setCollectionName] = useState('');

  const [filter, setFilter] = useState<GiftFilter>('sale');
  const [sort, setSort] = useState<SortKey>('price_asc');
  const [selected, setSelected] = useState<GiftAttributes>(emptyAttrs());

  const [items, setItems] = useState<GiftItem[]>([]);
  const [nextOffset, setNextOffset] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const [attrOptions, setAttrOptions] = useState<GiftAttributes>(emptyAttrs());
  const [filterOpen, setFilterOpen] = useState(false);
  const [bidding, setBidding] = useState<Auction | null>(null);
  const [buying, setBuying] = useState<Auction | null>(null);

  const attrKey = useMemo(() => JSON.stringify(selected), [selected]);
  const attrCount = selected.Model.length + selected.Backdrop.length + selected.Symbol.length;
  const isAll = collection === ALL;

  // collections index
  useEffect(() => {
    let alive = true;
    setLoadingCollections(true);
    listGiftCollections(getInitData())
      .then((c) => alive && setCollections(c))
      .finally(() => alive && setLoadingCollections(false));
    return () => {
      alive = false;
    };
  }, []);

  function openCatalog(slug: string, name: string) {
    setCollection(slug);
    setCollectionName(name);
    setFilter('sale');
    setSort('price_asc');
    setSelected(emptyAttrs());
    setAttrOptions(emptyAttrs());
    setItems([]);
    setNextOffset(null);
    if (slug !== ALL) giftAttributes(slug, getInitData()).then(setAttrOptions).catch(() => {});
  }

  function back() {
    setCollection(null);
    setItems([]);
  }

  // (re)load page 1 whenever the query changes
  useEffect(() => {
    if (!collection) return;
    let alive = true;
    setLoading(true);
    searchGifts({ collection, filter, sort, offset: 0, attrs: selected }, getInitData())
      .then((r) => {
        if (!alive) return;
        setItems(r.items);
        setNextOffset(r.nextOffset);
      })
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [collection, filter, sort, attrKey]);

  const loadMore = useCallback(async () => {
    if (nextOffset == null || loadingMore || loading || !collection) return;
    setLoadingMore(true);
    try {
      const r = await searchGifts({ collection, filter, sort, offset: nextOffset, attrs: selected }, getInitData());
      setItems((prev) => {
        const have = new Set(prev.map((p) => p.slug));
        return [...prev, ...r.items.filter((i) => !have.has(i.slug))];
      });
      setNextOffset(r.nextOffset);
    } finally {
      setLoadingMore(false);
    }
  }, [nextOffset, loadingMore, loading, collection, filter, sort, selected]);

  // infinite scroll sentinel
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && loadMore(), { rootMargin: '600px' });
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  function openItem(it: GiftItem) {
    if (it.status === 'auction') setBidding(giftAuction(it));
    else setBuying(giftAuction(it));
  }

  // ── collection grid ──
  if (!collection) {
    return (
      <div className="container-app space-y-4 py-5">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-god-cream">Collectible gifts</h2>
            <p className="text-xs text-god-muted">
              {loadingCollections ? 'Loading collections…' : `${collections.length} collections on Fragment`}
            </p>
          </div>
        </div>

        <button
          onClick={() => openCatalog(ALL, 'All gifts')}
          className="card card-hover flex w-full items-center gap-3 px-4 py-3.5"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-gradient text-god-bg">
            <Layers className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 text-left">
            <div className="text-sm font-medium text-god-cream">All gifts</div>
            <div className="text-[11px] text-god-faint">Every collection · buy-now & auctions · infinite scroll</div>
          </div>
          <ChevronLeft className="h-4 w-4 rotate-180 text-god-faint" />
        </button>

        {loadingCollections ? (
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="aspect-square w-full rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {collections.map((c) => (
              <button
                key={c.slug}
                onClick={() => openCatalog(c.slug, c.name)}
                className="card card-hover flex flex-col items-center gap-1.5 p-3 text-center"
              >
                <img
                  src={c.image}
                  alt={c.name}
                  loading="lazy"
                  className="h-14 w-14 rounded-xl object-cover"
                  onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
                />
                <span className="line-clamp-1 text-[11px] font-medium text-god-cream">{c.name}</span>
                <span className="text-[10px] text-god-faint">{c.count.toLocaleString('en-US')}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── catalog view ──
  return (
    <div className="container-app space-y-3 py-5">
      <div className="flex items-center gap-2">
        <button
          onClick={back}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-god-border text-god-muted hover:text-god-gold"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="truncate font-display text-lg font-bold text-god-cream">{collectionName}</h2>
          <p className="text-xs text-god-muted">
            {loading ? 'Loading…' : `${items.length}${nextOffset != null ? '+' : ''} ${filter === 'auction' ? 'on auction' : 'for sale'}`}
          </p>
        </div>
        <button
          onClick={() => openCatalog(collection, collectionName)}
          className="flex h-9 w-9 items-center justify-center rounded-xl border border-god-border text-god-muted hover:text-god-gold"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* controls */}
      <div className="flex items-center gap-2">
        <Segmented<GiftFilter>
          className="flex-1"
          value={filter}
          onChange={(v) => setFilter(v)}
          options={[
            { value: 'sale', label: 'Buy now' },
            { value: 'auction', label: 'Auctions' },
          ]}
        />
        <button
          onClick={() => setSort((s) => (s === 'price_asc' ? 'price_desc' : 'price_asc'))}
          className="shrink-0 rounded-xl border border-god-border px-3 py-2 text-xs font-medium text-god-muted hover:text-god-cream"
          title="Toggle price sort"
        >
          {sort === 'price_asc' ? '↑ Cheapest' : '↓ Priciest'}
        </button>
        {!isAll && (attrOptions.Model.length > 0 || attrOptions.Backdrop.length > 0 || attrOptions.Symbol.length > 0) && (
          <button
            onClick={() => setFilterOpen(true)}
            className={cn(
              'relative shrink-0 rounded-xl border px-3 py-2 text-god-muted hover:text-god-cream',
              attrCount > 0 ? 'border-god-gold/50 bg-god-gold/10 text-god-gold' : 'border-god-border',
            )}
          >
            <SlidersHorizontal className="h-4 w-4" />
            {attrCount > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-god-gold px-1 text-[9px] font-bold text-god-bg">
                {attrCount}
              </span>
            )}
          </button>
        )}
      </div>

      {/* grid */}
      {loading ? (
        <div className="grid grid-cols-2 gap-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-[132px] w-full rounded-2xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Gift className="h-8 w-8" />}
          title={filter === 'auction' ? 'No auctions' : 'Nothing for sale'}
          hint={attrCount > 0 ? 'Try loosening the filters.' : 'Check back soon.'}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2">
            {items.map((it) => (
              <GiftCard key={it.slug} item={it} tonUsd={tonUsd} onClick={() => openItem(it)} />
            ))}
          </div>
          <div ref={sentinel} className="h-8" />
          {loadingMore && (
            <div className="grid grid-cols-2 gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-[132px] w-full rounded-2xl" />
              ))}
            </div>
          )}
          {nextOffset == null && <p className="py-2 text-center text-[11px] text-god-faint">— end —</p>}
        </>
      )}

      <FilterSheet
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        options={attrOptions}
        selected={selected}
        onApply={(s) => {
          setSelected(s);
          setFilterOpen(false);
        }}
      />
      <BidSheet key={bidding?.domain ?? 'bid'} auction={bidding} open={!!bidding} onClose={() => setBidding(null)} tonUsd={tonUsd} />
      <BuyNowSheet key={buying?.domain ?? 'buy'} auction={buying} open={!!buying} onClose={() => setBuying(null)} tonUsd={tonUsd} />
    </div>
  );
}

function FilterSheet({
  open,
  onClose,
  options,
  selected,
  onApply,
}: {
  open: boolean;
  onClose: () => void;
  options: GiftAttributes;
  selected: GiftAttributes;
  onApply: (s: GiftAttributes) => void;
}) {
  const [pending, setPending] = useState<GiftAttributes>(selected);
  useEffect(() => {
    if (open) setPending(selected);
  }, [open, selected]);

  const toggle = (type: keyof GiftAttributes, v: string) =>
    setPending((p) => ({
      ...p,
      [type]: p[type].includes(v) ? p[type].filter((x) => x !== v) : [...p[type], v],
    }));

  const total = pending.Model.length + pending.Backdrop.length + pending.Symbol.length;

  return (
    <Sheet open={open} onClose={onClose} title="Filter traits">
      <div className="space-y-5">
        {(['Model', 'Backdrop', 'Symbol'] as (keyof GiftAttributes)[]).map((type) =>
          options[type].length ? (
            <div key={type} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="label-eyebrow">{type}</label>
                {pending[type].length > 0 && (
                  <button className="text-[11px] text-god-gold" onClick={() => setPending((p) => ({ ...p, [type]: [] }))}>
                    clear
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {options[type].map((v) => {
                  const on = pending[type].includes(v);
                  return (
                    <button
                      key={v}
                      onClick={() => toggle(type, v)}
                      className={cn(
                        'flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs transition-colors',
                        on ? 'border-god-gold/60 bg-god-gold/15 text-god-gold' : 'border-god-border text-god-muted hover:text-god-cream',
                      )}
                    >
                      {on && <Check className="h-3 w-3" />}
                      {v}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null,
        )}
        <div className="flex gap-2">
          <button
            onClick={() => setPending({ Model: [], Backdrop: [], Symbol: [] })}
            className="rounded-2xl border border-god-border px-4 py-3 text-sm font-medium text-god-muted"
          >
            Clear all
          </button>
          <Button fullWidth onClick={() => onApply(pending)}>
            Show {total > 0 ? `(${total})` : 'all'}
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

function GiftCard({ item, tonUsd, onClick }: { item: GiftItem; tonUsd: number; onClick: () => void }) {
  const price = Number(item.priceNano);
  return (
    <button onClick={onClick} className="card card-hover overflow-hidden p-0 text-left">
      <div className="relative aspect-square w-full bg-god-elevated">
        <img
          src={item.image}
          alt={`${item.name} #${item.num}`}
          loading="lazy"
          className="h-full w-full object-cover"
          onError={(e) => (e.currentTarget.style.visibility = 'hidden')}
        />
        <span className="absolute right-1.5 top-1.5 rounded-md bg-god-bg/80 px-1.5 py-0.5 text-[10px] font-medium text-god-cream backdrop-blur">
          {item.status === 'auction' ? 'Auction' : 'Buy now'}
        </span>
      </div>
      <div className="flex items-center justify-between px-3 py-2">
        <span className="truncate text-[11px] text-god-muted">#{item.num}</span>
        <div className="text-right">
          <div className="flex items-center justify-end gap-1 font-mono text-sm font-bold text-god-gold">
            <TonIcon size={12} />
            {fmtTon(price)}
          </div>
          <div className="text-[9px] text-god-faint">${fmtUsd(price, tonUsd)}</div>
        </div>
      </div>
    </button>
  );
}

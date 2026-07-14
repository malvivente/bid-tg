import { useCallback, useEffect, useState } from 'react';
import type { Auction } from '@/types';
import { fetchAuctions, fetchTonUsd } from '@/lib/fragment-data';

export type SortKey = 'bid' | 'username' | 'ends';

export function useAuctions() {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [tonUsd, setTonUsd] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('bid');
  const [sortAsc, setSortAsc] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [list, rate] = await Promise.all([fetchAuctions(), fetchTonUsd()]);
      setAuctions(list);
      setTonUsd(rate);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load auctions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) setSortAsc((v) => !v);
    else {
      setSortKey(key);
      setSortAsc(key !== 'bid');
    }
  };

  const filtered = auctions
    .filter((a) => (query ? a.username.toLowerCase().includes(query.toLowerCase().replace('@', '')) : true))
    .sort((a, b) => {
      switch (sortKey) {
        case 'username':
          return sortAsc ? a.username.localeCompare(b.username) : b.username.localeCompare(a.username);
        case 'ends':
          return sortAsc ? a.endsAt - b.endsAt : b.endsAt - a.endsAt;
        case 'bid':
        default:
          return sortAsc ? a.priceNano - b.priceNano : b.priceNano - a.priceNano;
      }
    });

  return {
    auctions: filtered,
    total: auctions.length,
    tonUsd,
    loading,
    error,
    query,
    setQuery,
    sortKey,
    sortAsc,
    toggleSort,
    reload: load,
  };
}

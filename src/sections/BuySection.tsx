import { useState } from 'react';
import { Segmented } from '@/components/ui';
import { StarsSection } from '@/sections/StarsSection';
import { PremiumSection } from '@/sections/PremiumSection';
import { TopupSection } from '@/sections/TopupSection';
import type { BuyView } from '@/types';

/**
 * "Buy" hub — the custodial, operator-fronted products (gift value to any @username
 * without KYC). Stars / Premium / Ads-GRAM top-up share this tab via a segmented switch.
 */
export function BuySection({ tonUsd }: { tonUsd: number }) {
  const [view, setView] = useState<BuyView>('stars');

  return (
    <div>
      <div className="container-app pt-4">
        <Segmented<BuyView>
          value={view}
          onChange={setView}
          options={[
            { value: 'stars', label: 'Stars' },
            { value: 'premium', label: 'Premium' },
            { value: 'topup', label: 'Top-up' },
          ]}
        />
      </div>
      {view === 'stars' && <StarsSection tonUsd={tonUsd} />}
      {view === 'premium' && <PremiumSection tonUsd={tonUsd} />}
      {view === 'topup' && <TopupSection tonUsd={tonUsd} />}
    </div>
  );
}

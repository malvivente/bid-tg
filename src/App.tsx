import { useEffect, useState } from 'react';
import { TonConnectProvider } from '@/providers/TonConnectProvider';
import { ToastProvider } from '@/components/Toast';
import { Header } from '@/components/Header';
import { BottomNav } from '@/components/BottomNav';
import { AuctionsSection } from '@/sections/AuctionsSection';
import { NumbersSection } from '@/sections/NumbersSection';
import { GiftsSection } from '@/sections/GiftsSection';
import { BuySection } from '@/sections/BuySection';
import { ProfileSection } from '@/sections/ProfileSection';
import { initTelegram } from '@/lib/telegram';
import { fetchTonUsd } from '@/lib/fragment-data';
import type { TabType } from '@/types';

function AppContent() {
  const [tab, setTab] = useState<TabType>('auctions');
  const [tonUsd, setTonUsd] = useState(0);

  useEffect(() => {
    initTelegram();
    let alive = true;
    const load = () => fetchTonUsd().then((r) => alive && setTonUsd(r)).catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <Header tonUsd={tonUsd} />
      <main
        key={tab}
        className="animate-fade-up pb-[86px] pt-[calc(58px+var(--safe-top))]"
      >
        {tab === 'auctions' && <AuctionsSection />}
        {tab === 'numbers' && <NumbersSection tonUsd={tonUsd} />}
        {tab === 'gifts' && <GiftsSection tonUsd={tonUsd} />}
        {tab === 'buy' && <BuySection tonUsd={tonUsd} />}
        {tab === 'profile' && <ProfileSection />}
      </main>
      <BottomNav activeTab={tab} onTabChange={setTab} />
    </div>
  );
}

export default function App() {
  return (
    <TonConnectProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </TonConnectProvider>
  );
}

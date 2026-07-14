import { Gavel, Hash, Gift, Wallet, User } from 'lucide-react';
import type { TabType } from '@/types';
import { cn } from '@/lib/cn';
import { haptic } from '@/lib/telegram';

const TABS: { id: TabType; label: string; Icon: typeof Wallet }[] = [
  { id: 'auctions', label: 'Names', Icon: Gavel },
  { id: 'numbers', label: 'Numbers', Icon: Hash },
  { id: 'gifts', label: 'Gifts', Icon: Gift },
  { id: 'buy', label: 'Buy', Icon: Wallet },
  { id: 'profile', label: 'Profile', Icon: User },
];

export function BottomNav({
  activeTab,
  onTabChange,
}: {
  activeTab: TabType;
  onTabChange: (t: TabType) => void;
}) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-god-border/70 bg-god-bg/90 backdrop-blur-xl">
      <div className="container-app grid grid-cols-5 gap-1 pb-[max(0.4rem,var(--safe-bottom))] pt-2">
        {TABS.map(({ id, label, Icon }) => {
          const active = id === activeTab;
          return (
            <button
              key={id}
              onClick={() => {
                haptic.select();
                onTabChange(id);
              }}
              className="group relative flex flex-col items-center gap-1 rounded-xl py-1.5"
            >
              <span
                className={cn(
                  'flex h-9 w-9 items-center justify-center rounded-xl transition-all duration-200',
                  active ? 'bg-god-gold/12 text-god-gold' : 'text-god-faint group-hover:text-god-muted',
                )}
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={active ? 2.4 : 2} />
              </span>
              <span
                className={cn(
                  'text-[10px] font-medium tracking-wide transition-colors',
                  active ? 'text-god-gold' : 'text-god-faint',
                )}
              >
                {label}
              </span>
              {active && (
                <span className="absolute -top-2 h-0.5 w-8 rounded-full bg-gold-gradient" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}

import { useTonAddress, useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { Wallet, LogOut } from 'lucide-react';
import { shortAddr } from '@/lib/format';
import { cn } from '@/lib/cn';

export function ConnectButton({ className }: { className?: string }) {
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonWallet();
  const address = useTonAddress();

  if (wallet && address) {
    return (
      <button
        onClick={() => tonConnectUI.disconnect()}
        className={cn(
          'chip group border-god-borderStrong text-god-cream hover:border-god-gold',
          className,
        )}
        title="Disconnect"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-god-success shadow-[0_0_8px] shadow-god-success" />
        <span className="font-mono">{shortAddr(address)}</span>
        <LogOut className="h-3 w-3 text-god-muted transition-colors group-hover:text-god-danger" />
      </button>
    );
  }

  return (
    <button
      onClick={() => tonConnectUI.openModal()}
      className={cn('btn-outline px-4 py-2 text-xs', className)}
    >
      <Wallet className="h-3.5 w-3.5" />
      Connect
    </button>
  );
}

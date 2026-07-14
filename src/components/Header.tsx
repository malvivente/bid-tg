import { TonIcon } from './TonIcon';
import { ConnectButton } from './ConnectButton';

// The safe-area padding sits on the OUTER <header> so it ADDS to its height. On the inner
// h-[58px] row it would (border-box) shove the content out below the border — straight under
// Telegram's fullscreen Close/menu buttons.
export function Header({ tonUsd }: { tonUsd: number }) {
  return (
    <header className="fixed inset-x-0 top-0 z-40 border-b border-god-border/70 bg-god-bg/85 pt-[var(--safe-top)] backdrop-blur-xl">
      <div className="container-app flex h-[58px] items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-god-borderStrong bg-god-elevated text-god-goldDeep shadow-gold">
            <span className="font-arcade text-2xl leading-none">&gt;</span>
          </div>
          <div className="leading-none">
            <div className="flex items-center font-arcade text-2xl leading-none tracking-wide text-god-cream text-glow">
              bid<span className="text-god-goldDeep">.tg</span>
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-[10px] text-god-faint">
              <TonIcon size={9} className="text-god-goldDeep" />
              <span>GRAM ${tonUsd ? tonUsd.toFixed(2) : '—'}</span>
              <span className="ml-0.5 h-1 w-1 rounded-full bg-god-success" />
            </div>
          </div>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}

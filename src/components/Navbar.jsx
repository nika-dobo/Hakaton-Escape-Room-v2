import React from 'react';
import { Shield, Terminal, ExternalLink, Radio } from 'lucide-react';

export default function Navbar({
  activeView,
  onSelectView,
  playerCount,
  activeCount,
  onOpenAdminTab,
}) {
  return (
    <header className="sticky top-0 z-40 border-b border-cyber-border bg-cyber-bg/90 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-cyber-cyan/40 bg-cyber-cyan/10 text-cyber-cyan shadow-[0_0_16px_rgba(0,240,255,0.2)]">
            <Terminal className="h-5 w-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono text-base font-bold tracking-tight text-cyber-text sm:text-lg">
                CIPHER//50
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-cyber-emerald/30 bg-cyber-emerald/10 px-2 py-0.5 font-mono text-[11px] font-medium text-cyber-emerald">
                <Radio className="h-3 w-3 animate-pulse" aria-hidden="true" />
                LIVE SYNC
              </span>
            </div>
            <p className="text-xs text-cyber-muted">
              50-Room Web Engineering Escape Arena
            </p>
          </div>
        </div>

        <nav
          aria-label="Primary mode navigation"
          className="flex flex-wrap items-center gap-2"
        >
          <button
            type="button"
            onClick={() => onSelectView('player')}
            aria-current={activeView === 'player' ? 'page' : undefined}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-150 ${
              activeView === 'player'
                ? 'border-cyber-cyan/70 bg-cyber-cyan/15 text-cyber-cyan shadow-[0_0_15px_rgba(0,240,255,0.18)]'
                : 'border-cyber-border bg-cyber-surface text-cyber-muted hover:border-slate-600 hover:text-cyber-text'
            }`}
          >
            <Terminal className="h-4 w-4" aria-hidden="true" />
            Player View
          </button>

          <button
            type="button"
            onClick={() => onSelectView('admin')}
            aria-current={activeView === 'admin' ? 'page' : undefined}
            className={`inline-flex min-h-[44px] items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition-all duration-150 ${
              activeView === 'admin'
                ? 'border-cyber-emerald/70 bg-cyber-emerald/15 text-cyber-emerald shadow-[0_0_15px_rgba(16,185,129,0.18)]'
                : 'border-cyber-border bg-cyber-surface text-cyber-muted hover:border-slate-600 hover:text-cyber-text'
            }`}
          >
            <Shield className="h-4 w-4" aria-hidden="true" />
            Admin Panel
            <span className="tabular-nums rounded bg-cyber-bg/80 px-1.5 py-0.5 font-mono text-xs text-cyber-text">
              {activeCount > 0 ? `${activeCount} live` : playerCount}
            </span>
          </button>

          <button
            type="button"
            onClick={onOpenAdminTab}
            title="Open Admin Dashboard in a separate browser tab to watch live cross-tab updates"
            className="hidden min-h-[44px] items-center gap-1.5 rounded-lg border border-cyber-border bg-cyber-surface px-3 py-2 text-xs font-medium text-cyber-muted transition-colors hover:border-cyber-cyan/50 hover:text-cyber-cyan sm:inline-flex"
          >
            <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
            Pop-out Admin
          </button>
        </nav>
      </div>
    </header>
  );
}

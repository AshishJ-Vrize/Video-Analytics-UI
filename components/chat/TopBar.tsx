'use client';

import { useState } from 'react';
import { useMsal } from '@azure/msal-react';

interface TopBarProps {
  onToggleSidebar: () => void;
}

export default function TopBar({ onToggleSidebar }: TopBarProps) {
  const { instance, accounts } = useMsal();
  const user = accounts[0];
  const [menuOpen, setMenuOpen] = useState(false);

  const initials = user?.name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() ?? 'U';

  const handleSignOut = () => {
    localStorage.removeItem('va_chat_active');
    instance.logoutRedirect({ postLogoutRedirectUri: '/login' });
  };

  return (
    <div className="flex items-center h-14 px-4 shrink-0 relative z-10">

      {/* Sidebar toggle */}
      <button
        onClick={onToggleSidebar}
        className="p-1.5 rounded-md text-muted hover:text-foreground transition-colors"
        aria-label="Toggle sidebar"
      >
        <MenuIcon className="w-5 h-5" />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* User menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen((o) => !o)}
          className="flex items-center gap-2.5 rounded-lg px-2 py-1.5 hover:bg-accent/6 transition-colors"
        >
          <span className="text-sm text-muted hidden sm:block">{user?.name ?? 'User'}</span>
          <div className="h-8 w-8 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {initials}
          </div>
        </button>

        {/* Dropdown */}
        {menuOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute right-0 top-full mt-1 z-20 w-52 rounded-xl bg-surface border border-border shadow-xl py-1">
              <div className="px-4 py-2 border-b border-border">
                <p className="text-xs font-medium text-foreground truncate">{user?.name}</p>
                <p className="text-xs text-muted truncate">{user?.username}</p>
              </div>
              <button
                onClick={handleSignOut}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-muted hover:text-accent hover:bg-accent/5 transition-colors"
              >
                <SignOutIcon className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="6"  x2="21" y2="6" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </svg>
  );
}

function SignOutIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

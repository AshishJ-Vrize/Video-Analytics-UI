'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { useTheme } from 'next-themes';
import { loginRequest } from '@/lib/msal-config';

export default function LoginPage() {
  const { instance, inProgress, accounts } = useMsal();
  const { theme, setTheme } = useTheme();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  const busy = inProgress !== InteractionStatus.None;

  // After loginRedirect completes, Microsoft sends the browser back to /login
  // with #code=... in the URL. MsalProvider processes it (handleRedirectPromise),
  // populates `accounts`, then inProgress returns to None.
  // At that point we acquire a token silently and call auth/me.
  useEffect(() => {
    if (accounts.length === 0 || inProgress !== InteractionStatus.None) return;

    const account = accounts[0];
    instance
      .acquireTokenSilent({ ...loginRequest, account })
      .then((result) =>
        fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/auth/me`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${result.idToken}` },
        })
      )
      .then((resp) => {
        if (resp.ok) {
          router.replace('/chat');
        } else {
          setError('Authentication failed. Your account may not be registered on this platform.');
        }
      })
      .catch((err) => {
        console.error(err);
        setError('Authentication error. Please try again.');
      });
  }, [accounts, inProgress, instance, router]);

  const handleSignIn = async () => {
    if (busy) return;
    setError(null);
    try {
      // loginRedirect: full-page redirect — no popup, no cross-window MSAL state issues.
      // Microsoft redirects back to redirectUri (/login) with the auth code.
      await instance.loginRedirect(loginRequest);
    } catch (e) {
      console.error(e);
      setError('Sign-in was cancelled or an error occurred. Please try again.');
    }
  };

  return (
    <main className="relative min-h-screen flex items-center justify-center bg-bg px-4">
      {/* Subtle red radial glow — dark mode only */}
      <div aria-hidden className="login-glow fixed inset-0 pointer-events-none" />

      <div className="relative z-10 w-full max-w-md rounded-2xl bg-surface border-t-4 border-accent shadow-2xl p-8 flex flex-col items-center gap-6">

        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="absolute top-4 right-4 p-1.5 rounded-md text-muted hover:text-foreground transition-colors"
          aria-label="Toggle theme"
        >
          {theme !== 'light' ? <SunIcon /> : <MoonIcon />}
        </button>

        {/* Shield icon */}
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/8">
          <ShieldCheckIcon className="w-6 h-6 text-accent" />
        </div>

        {/* Title + subtitle */}
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground">Video Analytics</h1>
          <p className="text-sm text-muted mt-1">Meeting Intelligence Platform</p>
        </div>

        {/* Sign in with Microsoft */}
        <button
          onClick={handleSignIn}
          disabled={busy}
          className="flex items-center justify-center gap-3 w-full rounded-xl border border-accent/40 bg-surface px-4 py-3 text-foreground font-normal hover:border-accent hover:bg-accent/5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <MicrosoftIcon />
          {busy ? 'Signing in…' : 'Sign in with Microsoft'}
        </button>

        {error && (
          <p className="text-xs text-red-500 text-center -mt-2">{error}</p>
        )}

        {/* Footer */}
        <div className="text-center flex flex-col gap-1">
          <p className="text-xs text-foreground/50">Protected by enterprise security.</p>
          <div className="flex items-center justify-center gap-3 text-xs text-foreground/50">
            <a href="#" className="hover:text-foreground transition-colors">Privacy</a>
            <span>•</span>
            <a href="#" className="hover:text-foreground transition-colors">Terms</a>
          </div>
        </div>
      </div>
    </main>
  );
}

function ShieldCheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L3 6v6c0 5.25 3.9 10.15 9 11.35C17.1 22.15 21 17.25 21 12V6L12 2z" />
      <polyline points="9 12 11 14 15 10" />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 21 21" fill="none">
      <rect x="1"  y="1"  width="9" height="9" fill="#f25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7fba00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00a4ef" />
      <rect x="11" y="11" width="9" height="9" fill="#ffb900" />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1"  x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22"   x2="5.64"  y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1"  y1="12" x2="3"  y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36" />
      <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

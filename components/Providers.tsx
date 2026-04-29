'use client';

import { useState } from 'react';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { ThemeProvider } from 'next-themes';
import { msalConfig } from '@/lib/msal-config';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [msalInstance] = useState(() => new PublicClientApplication(msalConfig));

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <MsalProvider instance={msalInstance}>
        {children}
      </MsalProvider>
    </ThemeProvider>
  );
}

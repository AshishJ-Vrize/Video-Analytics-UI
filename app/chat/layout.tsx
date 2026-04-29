'use client';

import { MsalAuthenticationTemplate } from '@azure/msal-react';
import { InteractionType } from '@azure/msal-browser';
import { loginRequest } from '@/lib/msal-config';

const DEV_PREVIEW = process.env.NODE_ENV === 'development' && !process.env.NEXT_PUBLIC_AZURE_CLIENT_ID;

export default function ChatLayout({ children }: { children: React.ReactNode }) {
  const shell = <div className="flex h-screen overflow-hidden bg-bg">{children}</div>;

  if (DEV_PREVIEW) return shell;

  return (
    <MsalAuthenticationTemplate
      interactionType={InteractionType.Redirect}
      authenticationRequest={loginRequest}
    >
      {shell}
    </MsalAuthenticationTemplate>
  );
}

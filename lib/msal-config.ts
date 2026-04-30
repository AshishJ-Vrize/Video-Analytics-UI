import { Configuration, LogLevel } from '@azure/msal-browser';

export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID!,
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID ?? 'common'}`,
    redirectUri: '/login',
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
  system: {
    loggerOptions: {
      loggerCallback: (_level, message, containsPii) => {
        if (containsPii || process.env.NODE_ENV !== 'development') return;
        console.log(message);
      },
      logLevel: LogLevel.Warning,
    },
  },
};

export const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

// Used only on the ingest page — acquires a delegated Graph token so the backend
// can call OnlineMeetings.Read + OnlineMeetingTranscript.Read.All on the user's behalf.
export const graphRequest = {
  scopes: [
    'User.Read',
    'OnlineMeetings.Read',
    'OnlineMeetingTranscript.Read.All',
    'Calendars.Read',
  ],
};

// Switch to this once "Expose an API → access_as_user" is configured in Azure:
// export const loginRequest = {
//   scopes: [`api://${process.env.NEXT_PUBLIC_AZURE_CLIENT_ID}/access_as_user`],
// };

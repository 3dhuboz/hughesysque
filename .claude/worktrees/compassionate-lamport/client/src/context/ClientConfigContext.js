import React, { createContext, useContext } from 'react';

// All config comes from REACT_APP_* build-time env vars — no server needed.
// Per-client customisation is done by setting these in Vercel project settings.
const config = {
  clientMode: process.env.REACT_APP_CLIENT_MODE === 'true',
  enabledApps: process.env.REACT_APP_ENABLED_APPS
    ? process.env.REACT_APP_ENABLED_APPS.split(',').map(s => s.trim())
    : [],
  brandName: process.env.REACT_APP_BRAND_NAME || '',
  brandTagline: process.env.REACT_APP_BRAND_TAGLINE || '',
  primaryColor: process.env.REACT_APP_PRIMARY_COLOR || '#f59e0b',
  loading: false,
};

const ClientConfigContext = createContext(config);

export const ClientConfigProvider = ({ children }) => (
  <ClientConfigContext.Provider value={config}>
    {children}
  </ClientConfigContext.Provider>
);

export const useClientConfig = () => useContext(ClientConfigContext);

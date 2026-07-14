import { configureAuth } from '@readysetcloud/ui/auth';

// Wires the shared @readysetcloud/ui auth to this app's Cognito app client.
// Importing this module configures auth as a side effect (see main.tsx).
// Mirrors content-tracking's ui/src/auth/config.ts.

function required(name: keyof ImportMetaEnv): string {
  const value = import.meta.env[name];
  if (!value) {
    console.error(`Missing required env var ${name}. Set it in .env.local.`);
  }
  return value ?? '';
}

export const env = {
  apiBaseUrl: required('VITE_API_BASE_URL'),
  region: required('VITE_AWS_REGION'),
  clientId: required('VITE_USER_POOL_CLIENT_ID'),
};

configureAuth({ region: env.region, clientId: env.clientId });

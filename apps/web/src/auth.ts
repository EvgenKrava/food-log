import { WebStorageStateStore } from 'oidc-client-ts';
import type { AuthProviderProps } from 'react-oidc-context';
import { config } from './config';

export const oidcConfig: AuthProviderProps = {
  authority: config.authority,
  client_id: config.clientId,
  redirect_uri: `${config.appUrl}/callback`,
  post_logout_redirect_uri: `${config.appUrl}/`,
  response_type: 'code',
  scope: 'openid email profile',
  automaticSilentRenew: true,
  loadUserInfo: false,
  // localStorage keeps the 30-day refresh token across PWA launches (iOS starts with a fresh sessionStorage).
  userStore: new WebStorageStateStore({ store: window.localStorage }),
  onSigninCallback: (user) => {
    const state = user?.state as { returnTo?: unknown } | undefined;
    const to = typeof state?.returnTo === 'string' && state.returnTo.startsWith('/') && !state.returnTo.startsWith('//') ? state.returnTo : '/';
    window.history.replaceState({}, document.title, to);
    window.dispatchEvent(new PopStateEvent('popstate'));
  },
};

export const logoutUrl = () =>
  `${config.authDomain}/logout?client_id=${encodeURIComponent(config.clientId)}&logout_uri=${encodeURIComponent(`${config.appUrl}/`)}`;

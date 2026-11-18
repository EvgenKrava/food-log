export const config = {
  authority: import.meta.env.VITE_COGNITO_AUTHORITY as string,
  clientId: import.meta.env.VITE_COGNITO_CLIENT_ID as string,
  authDomain: import.meta.env.VITE_COGNITO_DOMAIN as string,
  appUrl: window.location.origin,
  hubUrl: 'https://onlytools.click',
};

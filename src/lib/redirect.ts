// only internal paths, so a crafted ?redirect= cannot send users to another site
export const safeRedirect = (value: string | null | undefined) =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : null;

export const withRedirect = (path: string, redirect: string | null) =>
  redirect ? `${path}?redirect=${encodeURIComponent(redirect)}` : path;

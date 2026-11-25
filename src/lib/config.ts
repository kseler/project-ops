// The API server for auth and realtime. The e2e tests point it at their own server via VITE_API_URL.
export const API_URL: string = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

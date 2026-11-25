// The e2e servers run on their own ports, so they never reuse the dev servers (or their database).
export const API_PORT = 3101;
export const WEB_PORT = 5273;

export const API_URL = `http://localhost:${API_PORT}`;
export const APP_URL = `http://localhost:${WEB_PORT}`;

import { io } from 'socket.io-client';

import { API_URL } from '@/lib/config';

export const socket = io(API_URL, {
  autoConnect: false,
  withCredentials: true,
});
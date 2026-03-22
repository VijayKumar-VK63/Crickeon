import { io } from 'socket.io-client';

export const socket = io(import.meta.env.VITE_SOCKET_URL ?? 'http://localhost:3006/live', {
  transports: ['websocket'],
  autoConnect: false,
  auth: {
    token: localStorage.getItem('lamcl_token') ?? ''
  }
});

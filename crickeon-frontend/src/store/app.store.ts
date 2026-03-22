import { create } from 'zustand';

type AuctionState = {
  roomId: string;
  auctionId: string;
  matchId: string;
  ownerId: string;
  token: string;
  logs: string[];
  leaderboard: Array<{ userId: string; displayName: string; eloRating: number; matches: number; wins: number }>;
  setSession: (payload: { ownerId: string; token: string }) => void;
  setRoom: (roomId: string) => void;
  setAuction: (auctionId: string) => void;
  setMatch: (matchId: string) => void;
  pushLog: (message: string) => void;
  setLeaderboard: (rows: AuctionState['leaderboard']) => void;
};

export const useAppStore = create<AuctionState>((set) => ({
  roomId: '',
  auctionId: '',
  matchId: 'match-001',
  ownerId: localStorage.getItem('lamcl_owner') ?? '',
  token: localStorage.getItem('lamcl_token') ?? '',
  logs: [],
  leaderboard: [],
  setSession: ({ ownerId, token }) =>
    set(() => {
      localStorage.setItem('lamcl_owner', ownerId);
      localStorage.setItem('lamcl_token', token);
      return { ownerId, token };
    }),
  setRoom: (roomId) => set(() => ({ roomId })),
  setAuction: (auctionId) => set(() => ({ auctionId })),
  setMatch: (matchId) => set(() => ({ matchId })),
  pushLog: (message) =>
    set((state) => ({ logs: [`${new Date().toLocaleTimeString()} — ${message}`, ...state.logs].slice(0, 50) })),
  setLeaderboard: (leaderboard) => set(() => ({ leaderboard }))
}));

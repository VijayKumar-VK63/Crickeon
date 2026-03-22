import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import { useAppStore } from '../store/app.store';

export function LobbyPage() {
  const { ownerId, roomId, auctionId, setRoom, setAuction, pushLog } = useAppStore();
  const [timer, setTimer] = useState<number | null>(null);
  const [entryFee, setEntryFee] = useState(99);

  useEffect(() => {
    socket.connect();
    socket.on('bid_updated', (payload: unknown) => pushLog(`Bid: ${JSON.stringify(payload)}`));
    socket.on('auction_timer', (payload: unknown) => pushLog(`Timer: ${JSON.stringify(payload)}`));
    socket.on('player_joined', (payload: unknown) => pushLog(`Joined: ${JSON.stringify(payload)}`));

    return () => {
      socket.disconnect();
    };
  }, [pushLog]);

  async function createRoom() {
    const response = await api.post('/rooms/create', { ownerId });
    setRoom(response.data.id);
    socket.emit('subscribe_room', { roomId: response.data.id });
    pushLog(`Room created ${response.data.id}`);
  }

  async function bid() {
    const response = await api.post('/auction/bid', {
      roomId,
      auctionId,
      cricketPlayerId: 'cric-001',
      ownerId,
      amount: 450000,
      idempotencyKey: crypto.randomUUID()
    });
    pushLog(`Bid accepted: ${JSON.stringify(response.data)}`);
  }

  async function openAuction() {
    if (!roomId) return;
    const response = await api.post('/auction/open', {
      roomId,
      cricketPlayerId: 'cric-001',
      role: 'batsman'
    });
    setAuction(response.data.id);
    pushLog(`Auction opened: ${response.data.id}`);
  }

  async function refreshTimer() {
    if (!auctionId) return;
    const response = await api.get(`/auction/${auctionId}/timer`);
    setTimer(response.data.remainingMs);
  }

  async function loadHistory() {
    if (!auctionId) return;
    const response = await api.get(`/auction/${auctionId}/history`);
    pushLog(`History count: ${response.data.bidCount}`);
  }

  async function payEntryFee() {
    await api.post('/league/entry', { roomId, ownerId, entryFee });
    pushLog(`Paid entry fee ₹${entryFee}`);
  }

  async function claimDailyReward() {
    const response = await api.post(`/growth/daily-reward/${ownerId}`);
    pushLog(`Daily reward +₹${response.data.rewardCoins} | streak ${response.data.streak}`);
  }

  return (
    <motion.section className="space-y-4 rounded-2xl bg-slate-900/80 p-6 shadow-xl" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-semibold text-white">Lobby</h2>
      <div className="flex flex-wrap gap-3">
        <button onClick={createRoom} className="rounded-md bg-brand-600 px-4 py-2 text-white">Create Room</button>
        <button onClick={openAuction} disabled={!roomId} className="rounded-md bg-indigo-600 px-4 py-2 text-white disabled:opacity-50">Open Auction</button>
        <button onClick={bid} disabled={!roomId || !auctionId} className="rounded-md bg-emerald-600 px-4 py-2 text-white disabled:opacity-50">Quick Bid</button>
        <button onClick={refreshTimer} disabled={!auctionId} className="rounded-md bg-slate-700 px-4 py-2 text-white disabled:opacity-50">Refresh Timer</button>
        <button onClick={loadHistory} disabled={!auctionId} className="rounded-md bg-slate-700 px-4 py-2 text-white disabled:opacity-50">Bid History</button>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <p className="rounded-md bg-slate-950/70 p-3 text-slate-200">Room: {roomId || 'N/A'}</p>
        <p className="rounded-md bg-slate-950/70 p-3 text-slate-200">Auction: {auctionId || 'N/A'}</p>
        <p className="rounded-md bg-slate-950/70 p-3 text-slate-200">Timer: {timer ?? 'N/A'} ms</p>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/70 p-3">
        <input type="number" value={entryFee} onChange={(event) => setEntryFee(Number(event.target.value))} className="rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100" />
        <button onClick={payEntryFee} disabled={!roomId} className="rounded-md bg-amber-600 px-4 py-2 text-white disabled:opacity-50">Pay Entry Fee</button>
        <button onClick={claimDailyReward} className="rounded-md bg-purple-600 px-4 py-2 text-white">Claim Daily Reward</button>
      </div>
    </motion.section>
  );
}

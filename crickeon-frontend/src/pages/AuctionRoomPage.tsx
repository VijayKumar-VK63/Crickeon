import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAppStore } from '../store/app.store';

const personalities = ['conservative', 'aggressive', 'moneyball'] as const;

export function AuctionRoomPage() {
  const { roomId, auctionId, ownerId, pushLog } = useAppStore();
  const [amount, setAmount] = useState(450000);
  const [personality, setPersonality] = useState<(typeof personalities)[number]>('moneyball');
  const [coachTip, setCoachTip] = useState<string>('');

  const disabled = useMemo(() => !roomId || !auctionId || !ownerId, [roomId, auctionId, ownerId]);

  async function placeBid() {
    const response = await api.post('/auction/bid', {
      roomId,
      auctionId,
      cricketPlayerId: 'cric-001',
      ownerId,
      amount,
      idempotencyKey: crypto.randomUUID()
    });
    pushLog(`Bid placed ₹${response.data.auction.currentPrice}`);
  }

  async function coachRecommend() {
    const response = await api.post('/auction/ai/recommend', {
      roomId,
      auctionId,
      cricketPlayerId: 'cric-001',
      ownerId,
      personality
    });
    const decision = response.data.decision;
    setCoachTip(`${decision.reason} | confidence=${decision.confidence} | bid=${decision.bidAmount}`);
    pushLog(`Coach (${personality}): ${decision.reason}`);
  }

  async function triggerAutoBid() {
    const response = await api.post('/auction/ai/autobid', {
      roomId,
      auctionId,
      cricketPlayerId: 'cric-001',
      ownerId,
      personality,
      idempotencyKey: crypto.randomUUID()
    });
    pushLog(`Auto-bid queued: ${response.data.queued}`);
  }

  return (
    <motion.section className="space-y-4 rounded-2xl bg-slate-900/80 p-6 shadow-xl" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-semibold text-white">Auction Room</h2>
      <div className="grid gap-3 md:grid-cols-3">
        <input
          type="number"
          className="rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100"
          value={amount}
          onChange={(event) => setAmount(Number(event.target.value))}
        />
        <select
          className="rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100"
          value={personality}
          onChange={(event) => setPersonality(event.target.value as (typeof personalities)[number])}
        >
          {personalities.map((item) => (
            <option key={item} value={item}>{item}</option>
          ))}
        </select>
        <div className="text-sm text-slate-400">Room: {roomId || 'N/A'} | Auction: {auctionId || 'N/A'}</div>
      </div>

      <div className="flex flex-wrap gap-3">
        <button disabled={disabled} onClick={placeBid} className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white disabled:opacity-40">Place Bid</button>
        <button disabled={disabled} onClick={coachRecommend} className="rounded-md bg-indigo-600 px-4 py-2 font-medium text-white disabled:opacity-40">AI Coach</button>
        <button disabled={disabled} onClick={triggerAutoBid} className="rounded-md bg-emerald-600 px-4 py-2 font-medium text-white disabled:opacity-40">AI Auto-Bid</button>
      </div>

      {coachTip ? <p className="rounded-md bg-slate-800 p-3 text-sm text-slate-200">{coachTip}</p> : null}
    </motion.section>
  );
}

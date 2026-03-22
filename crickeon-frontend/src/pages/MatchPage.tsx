import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { socket } from '../lib/socket';
import { api } from '../lib/api';
import { useAppStore } from '../store/app.store';

export function MatchPage() {
  const [updates, setUpdates] = useState<string[]>([]);
  const { matchId } = useAppStore();
  const teamAId = '22222222-2222-2222-2222-222222222222';
  const teamBId = '33333333-3333-3333-3333-333333333333';

  useEffect(() => {
    socket.connect();
    socket.on('match_update', (payload: unknown) => setUpdates((s: string[]) => [`Match: ${JSON.stringify(payload)}`, ...s].slice(0, 20)));
    socket.on('score_update', (payload: unknown) => setUpdates((s: string[]) => [`Score: ${JSON.stringify(payload)}`, ...s].slice(0, 20)));

    return () => {
      socket.disconnect();
    };
  }, []);

  async function runToss() {
    const response = await api.post('/match/toss', { matchId, teamA: teamAId, teamB: teamBId, seed: 42 });
    setUpdates((s: string[]) => [`Toss: ${JSON.stringify(response.data)}`, ...s].slice(0, 20));
  }

  async function startMatch() {
    const response = await api.post('/match/start', {
      matchId,
      teamAId,
      teamBId,
      tossWinner: teamAId,
      decision: 'bat',
      seed: 42,
      pitch: 'flat'
    });
    setUpdates((s: string[]) => [`Start: ${JSON.stringify(response.data)}`, ...s].slice(0, 20));
  }

  async function simulateBall() {
    const response = await api.post('/match/ball', {
      matchId,
      innings: 1,
      over: 18,
      ball: 3,
      batsmanId: 'cric-001',
      bowlerId: 'cric-002',
      batsman: { batting: 89, bowling: 5, form: 1.05, fatigue: 0.25 },
      bowler: { batting: 20, bowling: 92, form: 1.1, fatigue: 0.2 },
      pressureIndex: 0.82,
      pitch: 'flat',
      seed: 42
    });
    setUpdates((s: string[]) => [`Ball: ${JSON.stringify(response.data)}`, ...s].slice(0, 20));
  }

  async function deathOverDecision() {
    const response = await api.post('/match/death-over/decision', {
      matchId,
      aggressiveness: 0.9,
      yorkerPlan: 0.8
    });
    setUpdates((s: string[]) => [`Decision: ${JSON.stringify(response.data)}`, ...s].slice(0, 20));
  }

  async function resolveSuperOver() {
    const response = await api.post('/match/super-over/resolve', {
      matchId,
      battingSkill: 86,
      bowlingSkill: 82,
      executionScore: 90,
      seed: 42
    });
    setUpdates((s: string[]) => [`Super Over: ${JSON.stringify(response.data)}`, ...s].slice(0, 20));
  }

  return (
    <motion.section className="space-y-4 rounded-2xl bg-slate-900/80 p-6 shadow-xl" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-semibold text-white">Match Screen</h2>
      <div className="flex flex-wrap gap-3">
        <button onClick={runToss} className="rounded-md bg-sky-600 px-4 py-2 text-white">Run Toss</button>
        <button onClick={startMatch} className="rounded-md bg-brand-600 px-4 py-2 text-white">Start Match</button>
        <button onClick={simulateBall} className="rounded-md bg-emerald-600 px-4 py-2 text-white">Simulate Ball</button>
        <button onClick={deathOverDecision} className="rounded-md bg-amber-600 px-4 py-2 text-white">Death Strategy</button>
        <button onClick={resolveSuperOver} className="rounded-md bg-purple-600 px-4 py-2 text-white">Resolve Super Over</button>
      </div>
      <div className="space-y-2 text-sm text-slate-200">
        {updates.map((u: string) => (
          <p key={u} className="rounded-md border border-slate-800 bg-slate-950/70 p-2">{u}</p>
        ))}
      </div>
    </motion.section>
  );
}

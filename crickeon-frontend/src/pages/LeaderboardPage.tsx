import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAppStore } from '../store/app.store';

export function LeaderboardPage() {
  const { leaderboard, setLeaderboard } = useAppStore();

  useEffect(() => {
    void api.get('/growth/leaderboard').then((response) => setLeaderboard(response.data));
  }, [setLeaderboard]);

  return (
    <motion.section className="rounded-2xl bg-slate-900/80 p-6 shadow-xl" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="mb-4 text-xl font-semibold text-white">Leaderboard</h2>
      <div className="space-y-2 text-sm text-slate-200">
        {leaderboard.map((entry, index) => (
          <div key={entry.userId} className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-950/60 px-3 py-2">
            <span>#{index + 1} {entry.displayName}</span>
            <span>ELO {entry.eloRating} | W {entry.wins}/{entry.matches}</span>
          </div>
        ))}
      </div>
    </motion.section>
  );
}

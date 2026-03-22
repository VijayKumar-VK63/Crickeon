import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';

type Row = Record<string, unknown>;

export function DashboardPage() {
  const [topPlayers, setTopPlayers] = useState<Row[]>([]);
  const [winRates, setWinRates] = useState<Row[]>([]);
  const [roi, setRoi] = useState<Row[]>([]);

  useEffect(() => {
    void Promise.all([
      api.get('/stats/dashboard/top-players'),
      api.get('/stats/dashboard/win-rates'),
      api.get('/stats/dashboard/roi')
    ]).then(([topPlayersRes, winRatesRes, roiRes]) => {
      setTopPlayers(topPlayersRes.data);
      setWinRates(winRatesRes.data);
      setRoi(roiRes.data);
    });
  }, []);

  return (
    <motion.section className="grid gap-5 rounded-2xl bg-slate-900/80 p-6 shadow-xl md:grid-cols-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
      <Card title="Top Players" rows={topPlayers} />
      <Card title="Win Rates" rows={winRates} />
      <Card title="ROI" rows={roi} />
    </motion.section>
  );
}

function Card({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <article className="rounded-lg border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="mb-3 text-base font-semibold text-slate-100">{title}</h3>
      <div className="space-y-2 text-sm text-slate-300">
        {rows.slice(0, 8).map((row, index) => (
          <p key={`${title}-${index}`} className="truncate">{Object.entries(row).map(([k, v]) => `${k}:${v}`).join(' | ')}</p>
        ))}
      </div>
    </article>
  );
}

import { Link, Route, Routes } from 'react-router-dom';
import { AuthPage } from './pages/AuthPage';
import { LobbyPage } from './pages/LobbyPage';
import { MatchPage } from './pages/MatchPage';
import { AuctionRoomPage } from './pages/AuctionRoomPage';
import { DashboardPage } from './pages/DashboardPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { useAppStore } from './store/app.store';

export function App() {
  const { logs } = useAppStore();

  return (
    <div className="mx-auto min-h-screen max-w-7xl bg-slate-950 px-4 py-6 text-slate-100">
      <header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
        <h1 className="text-2xl font-bold">LAMCL Control Center</h1>
        <nav className="flex flex-wrap gap-4 text-sm text-slate-300">
          <Link to="/">Auth</Link>
          <Link to="/lobby">Lobby</Link>
          <Link to="/auction">Auction Room</Link>
          <Link to="/match">Match</Link>
          <Link to="/dashboard">Dashboard</Link>
          <Link to="/leaderboard">Leaderboard</Link>
        </nav>
      </header>
      <main className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
        <Routes>
          <Route path="/" element={<AuthPage />} />
          <Route path="/lobby" element={<LobbyPage />} />
          <Route path="/auction" element={<AuctionRoomPage />} />
          <Route path="/match" element={<MatchPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
        </Routes>
        </div>
        <aside className="h-fit rounded-2xl border border-slate-800 bg-slate-900/80 p-4">
          <h2 className="mb-3 text-base font-semibold">Realtime Feed</h2>
          <div className="max-h-[70vh] space-y-2 overflow-auto text-xs text-slate-300">
            {logs.map((entry) => (
              <p key={entry} className="rounded-md bg-slate-950/70 p-2">{entry}</p>
            ))}
          </div>
        </aside>
      </main>
    </div>
  );
}

import { useState } from 'react';
import { motion } from 'framer-motion';
import { api } from '../lib/api';
import { useAppStore } from '../store/app.store';

export function AuthPage() {
  const [email, setEmail] = useState('owner1@lamcl.com');
  const [password, setPassword] = useState('securepassword123');
  const { setSession } = useAppStore();
  const [token, setToken] = useState(localStorage.getItem('lamcl_token') ?? '');

  async function login() {
    const response = await api.post('/auth/login', { email, password });
    setToken(response.data.accessToken);
    setSession({ ownerId: response.data.user.id, token: response.data.accessToken });
  }

  return (
    <motion.section className="space-y-4 rounded-2xl bg-slate-900/80 p-6 shadow-xl" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <h2 className="text-xl font-semibold text-white">Owner Login</h2>
      <div className="grid gap-3 md:grid-cols-2">
        <input className="rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input className="rounded-md border border-slate-700 bg-slate-950 p-2 text-slate-100" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" type="password" />
      </div>
      <button onClick={login} className="rounded-md bg-brand-600 px-4 py-2 font-medium text-white">Login</button>
      {token ? <p className="text-sm text-emerald-400">Authenticated</p> : null}
    </motion.section>
  );
}

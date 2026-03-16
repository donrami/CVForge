import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Briefcase } from 'lucide-react';

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    if (res.ok) {
      login();
      navigate('/');
    } else {
      setError('Invalid password');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg-base">
      <div className="w-full max-w-sm p-8 bg-bg-surface border border-border rounded shadow-lg">
        <div className="flex flex-col items-center mb-8">
          <div className="text-accent mb-4">
            <Briefcase size={48} />
          </div>
          <h1 className="text-3xl font-serif text-text-primary tracking-tight">CVForge</h1>
          <p className="text-text-secondary text-sm mt-2">Personal CV Generator</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-2 uppercase tracking-wider">
              Master Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-bg-base border border-border rounded-sm px-4 py-2 text-text-primary focus:outline-none focus:border-accent transition-colors"
              placeholder="••••••••"
              autoFocus
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            type="submit"
            className="w-full bg-accent hover:bg-accent-hover text-bg-base font-medium py-2 px-4 rounded-sm transition-colors"
          >
            Access Vault
          </button>
        </form>
      </div>
    </div>
  );
}

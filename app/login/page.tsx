'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/');
      } else {
        setError('密码不正确');
      }
    } catch {
      setError('网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5f5f5]">
      <div className="bg-white rounded-xl shadow-lg p-8 w-[360px] max-w-[90vw]">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900 mb-1">📑 书签导航</h1>
          <p className="text-sm text-gray-400">私人书签管理 · 请输入密码</p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(''); }}
            placeholder="输入访问密码"
            autoFocus
            className="w-full px-4 py-3 text-sm border border-gray-200 rounded-lg outline-none focus:border-gray-400 focus:ring-1 focus:ring-gray-200 transition"
          />

          {error && (
            <p className="mt-2 text-xs text-red-500 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full mt-4 py-2.5 bg-gray-900 text-white text-sm rounded-lg hover:bg-gray-800 disabled:opacity-40 transition font-medium"
          >
            {loading ? '验证中...' : '进入'}
          </button>
        </form>

        <p className="mt-6 text-center text-[11px] text-gray-300">
          私人书签导航 · {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}

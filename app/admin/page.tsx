'use client';

import { useState, useEffect, useCallback } from 'react';

interface Bookmark {
  id: number;
  url: string;
  title: string;
  domain: string;
  category_name: string;
  summary: string;
  description: string;
  tags: string;
  features: string;
  is_dead: boolean;
  is_featured: boolean;
  sort_order: number;
  created_at: string;
}

interface Category {
  id: number;
  name: string;
}

export default function AdminPage() {
  // Data
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');

  // Manual add form
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addCat, setAddCat] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  // Smart import (AI)
  const [smartUrl, setSmartUrl] = useState('');
  const [smartLoading, setSmartLoading] = useState(false);
  const [smartMsg, setSmartMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Delete state
  const [deleting, setDeleting] = useState<number | null>(null);

  // Toggle featured
  const [toggling, setToggling] = useState<number | null>(null);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        fetch('/api/bookmarks?limit=5000'),
        fetch('/api/categories'),
      ]);
      const bData = await bRes.json();
      const cData = await cRes.json();
      setBookmarks(bData.bookmarks || []);
      setCategories(cData.categories || []);
      setLoading(false);
    } catch (err) {
      console.error(err);
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Smart import (AI auto-classify)
  const handleSmartImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!smartUrl.trim()) return;

    setSmartLoading(true);
    setSmartMsg(null);
    try {
      const res = await fetch('/api/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: smartUrl.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setSmartMsg({ type: 'err', text: '❌ ' + data.error });
      } else {
        const b = data.bookmark;
        const auto = data.auto;
        const parts: string[] = [];
        if (auto?.title_fetched) parts.push('自动抓取标题');
        if (auto?.ai_classified) parts.push(`AI 分类: ${b.category_name || '?'}`);
        if (auto?.ai_summarized) parts.push('AI 生成描述');
        setSmartMsg({
          type: 'ok',
          text: `✅ 导入成功 — ${b.title}${parts.length ? ' (' + parts.join(' · ') + ')' : ''}`,
        });
        setSmartUrl('');
        fetchData();
      }
    } catch {
      setSmartMsg({ type: 'err', text: '❌ 网络错误' });
    } finally {
      setSmartLoading(false);
    }
  };

  // Add bookmark (manual)
  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUrl.trim() || !addTitle.trim()) return;

    setAdding(true);
    setAddMsg('');
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: addUrl.trim(), title: addTitle.trim(), category_name: addCat || null }),
      });
      const data = await res.json();
      if (data.error) {
        setAddMsg('❌ ' + data.error);
      } else {
        setAddMsg(`✅ ${data.action === 'created' ? '新增' : '更新'}成功 — ${addTitle}`);
        setAddUrl('');
        setAddTitle('');
        setAddCat('');
        fetchData();
      }
    } catch {
      setAddMsg('❌ 网络错误');
    } finally {
      setAdding(false);
    }
  };

  // Delete bookmark
  const handleDelete = async (b: Bookmark) => {
    if (!confirm(`确认删除「${b.title}」？\n\n此操作不可撤销。`)) return;

    setDeleting(b.id);
    try {
      const res = await fetch(`/api/bookmarks/${b.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.error) {
        alert('删除失败: ' + data.error);
      } else {
        setBookmarks(prev => prev.filter(x => x.id !== b.id));
      }
    } catch {
      alert('网络错误');
    } finally {
      setDeleting(null);
    }
  };

  // Toggle featured
  const handleToggleFeatured = async (b: Bookmark) => {
    setToggling(b.id);
    try {
      const res = await fetch(`/api/bookmarks/${b.id}/feature`, { method: 'PUT' });
      const data = await res.json();
      if (!data.error) {
        setBookmarks(prev => prev.map(x =>
          x.id === b.id ? { ...x, is_featured: data.bookmark.is_featured, sort_order: data.bookmark.sort_order } : x
        ));
      }
    } catch { /* ignore */ }
    finally { setToggling(null); }
  };

  // Reorder featured (move up)
  const handleMoveUp = async (id: number) => {
    const featured = bookmarks.filter(b => b.is_featured).sort((a, b) => a.sort_order - b.sort_order);
    const idx = featured.findIndex(b => b.id === id);
    if (idx <= 0) return;

    const newOrder = [...featured];
    [newOrder[idx - 1], newOrder[idx]] = [newOrder[idx], newOrder[idx - 1]];

    try {
      await fetch('/api/bookmarks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newOrder.map(b => b.id) }),
      });
      fetchData();
    } catch { /* ignore */ }
  };

  // Reorder featured (move down)
  const handleMoveDown = async (id: number) => {
    const featured = bookmarks.filter(b => b.is_featured).sort((a, b) => a.sort_order - b.sort_order);
    const idx = featured.findIndex(b => b.id === id);
    if (idx === -1 || idx >= featured.length - 1) return;

    const newOrder = [...featured];
    [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];

    try {
      await fetch('/api/bookmarks/reorder', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: newOrder.map(b => b.id) }),
      });
      fetchData();
    } catch { /* ignore */ }
  };

  // Filter
  const filtered = bookmarks.filter(b => {
    if (catFilter && b.category_name !== catFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        b.title.toLowerCase().includes(q) ||
        b.url.toLowerCase().includes(q) ||
        b.domain.toLowerCase().includes(q) ||
        (b.category_name || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const deadCount = bookmarks.filter(b => b.is_dead).length;
  const featuredList = bookmarks
    .filter(b => b.is_featured)
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">⚙️ 后台管理</h1>
            <a href="/" className="text-xs text-blue-500 hover:text-blue-700">← 返回导航</a>
            <span className="text-gray-300">|</span>
            <a href="/tools" className="text-xs text-green-500 hover:text-green-700">🔧 工具集</a>
            <span className="text-gray-300">|</span>
            <a href="/dashboard" className="text-xs text-purple-500 hover:text-purple-700">⭐ 常用面板</a>
          </div>
          <div className="flex items-center gap-3">
            {deadCount > 0 && (
              <span className="text-xs text-orange-500">⚠️ {deadCount} 个失效</span>
            )}
            <span className="text-xs text-gray-400">{bookmarks.length} 个书签</span>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* ── AI Smart Import ── */}
        <section className="bg-gradient-to-r from-purple-50 to-white rounded-lg border border-purple-100 p-5 mb-4">
          <h2 className="text-sm font-semibold text-purple-700 mb-1 flex items-center gap-1.5">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            AI 智能导入
          </h2>
          <p className="text-[11px] text-purple-400 mb-3">输入网址，AI 自动抓取标题、判断分类、生成描述</p>
          <form onSubmit={handleSmartImport} className="flex items-center gap-3">
            <input
              type="text"
              value={smartUrl}
              onChange={e => setSmartUrl(e.target.value)}
              placeholder="https://example.com — 粘贴网址即可"
              className="flex-1 px-3 py-2 text-sm border border-purple-200 rounded-md outline-none focus:border-purple-400 bg-white"
              disabled={smartLoading}
            />
            <button
              type="submit"
              disabled={smartLoading || !smartUrl.trim()}
              className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:opacity-40 transition whitespace-nowrap"
            >
              {smartLoading ? <><span className="import-spinner" /> AI 处理中...</> : '🔮 智能导入'}
            </button>
          </form>
          {smartMsg && (
            <p className={`mt-3 text-xs ${smartMsg.type === 'ok' ? 'text-green-600' : 'text-red-500'}`}>
              {smartMsg.text}
            </p>
          )}
        </section>

        {/* ── Manual Add ── */}
        <section className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">➕ 手动新增</h2>
          <form onSubmit={handleAdd} className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] text-gray-400 mb-1">网址 *</label>
              <input
                type="url"
                value={addUrl}
                onChange={e => setAddUrl(e.target.value)}
                placeholder="https://..."
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[11px] text-gray-400 mb-1">标题 *</label>
              <input
                type="text"
                value={addTitle}
                onChange={e => setAddTitle(e.target.value)}
                placeholder="网站名称"
                required
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-400"
              />
            </div>
            <div className="w-[180px]">
              <label className="block text-[11px] text-gray-400 mb-1">分类</label>
              <select
                value={addCat}
                onChange={e => setAddCat(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-blue-400 bg-white"
              >
                <option value="">（不指定）</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              disabled={adding || !addUrl || !addTitle}
              className="px-5 py-2 text-sm font-medium bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-40 transition"
            >
              {adding ? '添加中...' : '添加'}
            </button>
          </form>
          {addMsg && (
            <p className={`mt-3 text-xs ${addMsg.startsWith('✅') ? 'text-green-600' : 'text-red-500'}`}>
              {addMsg}
            </p>
          )}
        </section>

        {/* ── Featured Management ── */}
        {featuredList.length > 0 && (
          <section className="bg-gradient-to-r from-amber-50 to-white rounded-lg border border-amber-100 p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-semibold text-amber-700 flex items-center gap-1.5">
                ⭐ 常用书签管理
                <span className="text-[11px] font-normal text-amber-400">({featuredList.length} 个 — 显示在 /dashboard)</span>
              </h2>
              <a href="/dashboard" className="text-xs text-purple-500 hover:text-purple-700">
                预览面板 →
              </a>
            </div>
            <div className="space-y-1.5">
              {featuredList.map((b, idx) => (
                <div key={b.id} className="flex items-center gap-3 bg-white/60 rounded-md px-3 py-2 text-sm">
                  <span className="text-[11px] text-gray-400 w-6 text-center">{idx + 1}</span>
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-gray-800 truncate block">{b.title}</span>
                  </div>
                  <span className="text-[11px] text-gray-400 hidden sm:inline">{b.category_name}</span>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => handleMoveUp(b.id)}
                      disabled={idx === 0}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-20 transition"
                      title="上移"
                    >↑</button>
                    <button
                      onClick={() => handleMoveDown(b.id)}
                      disabled={idx === featuredList.length - 1}
                      className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded disabled:opacity-20 transition"
                      title="下移"
                    >↓</button>
                    <button
                      onClick={() => handleToggleFeatured(b)}
                      className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition"
                      title="取消常用"
                    >✕</button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Filters ── */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索书签..."
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-md outline-none focus:border-gray-400 bg-white"
          />
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-md outline-none bg-white"
          >
            <option value="">全部分类</option>
            {categories.map(c => (
              <option key={c.id} value={c.name}>{c.name}</option>
            ))}
          </select>
          <span className="text-xs text-gray-400 whitespace-nowrap">{filtered.length} 条</span>
        </div>

        {/* ── Table ── */}
        {loading ? (
          /* Skeleton */
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 bg-gray-50/50">
              {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50">
                  <div className="skeleton-line w-6 h-3" />
                  <div className="skeleton-line h-4 flex-1 max-w-[250px]" />
                  <div className="skeleton-line w-20 h-3 hidden md:block" />
                  <div className="skeleton-line w-16 h-3 hidden lg:block" />
                  <div className="skeleton-line w-10 h-3" />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-left">
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 w-12">#</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500">标题</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 hidden md:table-cell">域名</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 hidden lg:table-cell">分类</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 hidden xl:table-cell">描述</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 hidden xl:table-cell">标签</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 w-12 text-center">⭐</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 w-16">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((b) => (
                    <tr key={b.id} className={`hover:bg-gray-50/50 ${b.is_dead ? 'opacity-40' : ''}`}>
                      <td className="px-4 py-2 text-[11px] text-gray-400">{b.id}</td>
                      <td className="px-4 py-2">
                        <a href={b.url} target="_blank" rel="noopener" className="text-gray-900 hover:text-blue-600 truncate block max-w-[300px]">
                          {b.is_dead && '⚠️ '}
                          {b.title}
                        </a>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-gray-400 truncate max-w-[180px] hidden md:table-cell">
                        {b.domain}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-gray-500 hidden lg:table-cell">
                        <span className="bg-gray-100 px-1.5 py-0.5 rounded">{b.category_name || '-'}</span>
                      </td>
                      <td className="px-4 py-2 text-[11px] text-gray-400 truncate max-w-[200px] hidden lg:table-cell">
                        {b.summary || b.description || '-'}
                      </td>
                      <td className="px-4 py-2 text-[11px] text-gray-400 truncate max-w-[150px] hidden xl:table-cell">
                        {(() => { try { const t = JSON.parse(b.tags || '[]'); return Array.isArray(t) ? t.join(', ') : '-'; } catch { return '-'; } })()}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <button
                          onClick={() => handleToggleFeatured(b)}
                          disabled={toggling === b.id}
                          className={`text-base transition ${b.is_featured ? 'text-yellow-500 hover:text-yellow-600' : 'text-gray-300 hover:text-yellow-400'}`}
                          title={b.is_featured ? '取消常用' : '标为常用'}
                        >
                          {b.is_featured ? '★' : '☆'}
                        </button>
                      </td>
                      <td className="px-4 py-2">
                        <button
                          onClick={() => handleDelete(b)}
                          disabled={deleting === b.id}
                          className="text-[11px] text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded transition disabled:opacity-30"
                        >
                          {deleting === b.id ? '...' : '删除'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400 text-sm">没有匹配的书签</div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

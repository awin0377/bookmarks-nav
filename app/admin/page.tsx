'use client';

import { useState, useEffect, useCallback } from 'react';

interface Bookmark {
  id: number;
  url: string;
  title: string;
  domain: string;
  category_name: string;
  summary: string;
  is_dead: boolean;
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

  // Add form
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addCat, setAddCat] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState('');

  // Delete state
  const [deleting, setDeleting] = useState<number | null>(null);

  // ── Fetch data ───────────────────────────────────
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

  // ── Add bookmark ─────────────────────────────────
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
        fetchData(); // refresh list
      }
    } catch {
      setAddMsg('❌ 网络错误');
    } finally {
      setAdding(false);
    }
  };

  // ── Delete bookmark ──────────────────────────────
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

  // ── Filter ───────────────────────────────────────
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

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-900">⚙️ 后台管理</h1>
            <a href="/" className="text-xs text-blue-500 hover:text-blue-700">← 返回导航</a>
          </div>
          <span className="text-xs text-gray-400">{bookmarks.length} 个书签</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {/* ── Add Form ── */}
        <section className="bg-white rounded-lg border border-gray-200 p-5 mb-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">➕ 新增书签</h2>
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
          <div className="text-center py-20 text-gray-400">加载中...</div>
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
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 hidden lg:table-cell">描述</th>
                    <th className="px-4 py-2.5 text-[11px] font-medium text-gray-500 w-16">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {filtered.map((b, i) => (
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
                        {b.summary || '-'}
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

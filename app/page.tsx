'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ── Category Color Themes ──────────────────────────────
const CAT_GRADIENTS: Record<string, { header: string; card: string; hover: string }> = {
  '🤖 AI 平台': { header: 'from-violet-100 via-violet-50 to-white', card: 'from-white via-violet-50/20 to-white', hover: 'from-violet-100/30 via-violet-50/40 to-violet-50/20' },
  '🎨 设计': { header: 'from-fuchsia-100 via-fuchsia-50 to-white', card: 'from-white via-fuchsia-50/20 to-white', hover: 'from-fuchsia-100/30 via-fuchsia-50/40 to-fuchsia-50/20' },
  '☁️ 开发部署': { header: 'from-sky-100 via-sky-50 to-white', card: 'from-white via-sky-50/20 to-white', hover: 'from-sky-100/30 via-sky-50/40 to-sky-50/20' },
  '🌐 外贸跨境': { header: 'from-emerald-100 via-emerald-50 to-white', card: 'from-white via-emerald-50/20 to-white', hover: 'from-emerald-100/30 via-emerald-50/40 to-emerald-50/20' },
  '🔍 SEO 优化': { header: 'from-amber-100 via-amber-50 to-white', card: 'from-white via-amber-50/20 to-white', hover: 'from-amber-100/30 via-amber-50/40 to-amber-50/20' },
  '💰 投资理财': { header: 'from-teal-100 via-teal-50 to-white', card: 'from-white via-teal-50/20 to-white', hover: 'from-teal-100/30 via-teal-50/40 to-teal-50/20' },
  '📣 社媒营销': { header: 'from-rose-100 via-rose-50 to-white', card: 'from-white via-rose-50/20 to-white', hover: 'from-rose-100/30 via-rose-50/40 to-rose-50/20' },
  '🛒 独立站电商': { header: 'from-purple-100 via-purple-50 to-white', card: 'from-white via-purple-50/20 to-white', hover: 'from-purple-100/30 via-purple-50/40 to-purple-50/20' },
  '🛠️ 实用工具': { header: 'from-cyan-100 via-cyan-50 to-white', card: 'from-white via-cyan-50/20 to-white', hover: 'from-cyan-100/30 via-cyan-50/40 to-cyan-50/20' },
  '🔐 安全代理': { header: 'from-red-100 via-red-50 to-white', card: 'from-white via-red-50/20 to-white', hover: 'from-red-100/30 via-red-50/40 to-red-50/20' },
  '💼 工作办公': { header: 'from-indigo-100 via-indigo-50 to-white', card: 'from-white via-indigo-50/20 to-white', hover: 'from-indigo-100/30 via-indigo-50/40 to-indigo-50/20' },
  '🏪 货源档口': { header: 'from-orange-100 via-orange-50 to-white', card: 'from-white via-orange-50/20 to-white', hover: 'from-orange-100/30 via-orange-50/40 to-orange-50/20' },
  '📱 数码科技': { header: 'from-slate-100 via-slate-50 to-white', card: 'from-white via-slate-50/20 to-white', hover: 'from-slate-100/30 via-slate-50/40 to-slate-50/20' },
  '🖼️ 相册': { header: 'from-pink-100 via-pink-50 to-white', card: 'from-white via-pink-50/20 to-white', hover: 'from-pink-100/30 via-pink-50/40 to-pink-50/20' },
  '📦 其他存档': { header: 'from-gray-100 via-gray-50 to-white', card: 'from-white via-gray-50/20 to-white', hover: 'from-gray-100/30 via-gray-50/40 to-gray-50/20' },
  '生财社区': { header: 'from-yellow-100 via-yellow-50 to-white', card: 'from-white via-yellow-50/20 to-white', hover: 'from-yellow-100/30 via-yellow-50/40 to-yellow-50/20' },
};
function getGrad(name: string, suffix: 'header' | 'card' | 'hover'): string {
  const key = Object.keys(CAT_GRADIENTS).find(k => name.includes(k) || k.includes(name)) || '📦 其他存档';
  return CAT_GRADIENTS[key][suffix];
}

// ── Types ──────────────────────────────────────────────
interface Bookmark {
  id: number; url: string; title: string; domain: string;
  category_name: string; category_id: number; category_icon: string; icon: string;
  is_dead: boolean; is_featured: boolean; sort_order: number; summary: string; ai_note?: string;
}
interface Category {
  id: number; name: string; icon: string; bookmark_count: number; sort_order: number;
}

// ── Helpers ────────────────────────────────────────────
function catEmoji(name: string): string {
  const ch = name.charCodeAt(0);
  if (ch > 127) return name.charAt(0);
  return '📁';
}
function catLabel(name: string): string {
  return name.replace(/^[^\s]{1,2}\s*/, '');
}

// ── Sidebar Item ───────────────────────────────────────
function SidebarItem({ active, emoji, name, count, onClick }: {
  active: boolean; emoji: string; name: string; count: number; onClick: () => void;
}) {
  return (
    <button onClick={onClick}
      className={`w-full flex items-center gap-2 px-3 py-2 text-sm rounded-lg text-left transition ${
        active
          ? 'bg-gradient-to-r from-violet-100 to-fuchsia-50 text-gray-900 font-medium shadow-sm'
          : 'text-gray-600 hover:bg-gray-100/60 hover:text-gray-800'
      }`}>
      <span className="text-base shrink-0">{emoji}</span>
      <span className="flex-1 truncate">{name}</span>
      <span className={`text-[10px] px-1.5 py-0.5 rounded-full shrink-0 ${
        active ? 'bg-white/70 text-gray-500' : 'bg-gray-100 text-gray-400'
      }`}>{count}</span>
    </button>
  );
}

// ── Main Component ─────────────────────────────────────
export default function Home() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Edit mode
  const [editMode, setEditMode] = useState(false);

  // Edit modal
  const [editModal, setEditModal] = useState<{ open: boolean; b: Bookmark | null }>({ open: false, b: null });
  const [editTitle, setEditTitle] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editCatId, setEditCatId] = useState<number | null>(null);
  const [editSaving, setEditSaving] = useState(false);

  // Delete confirm
  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);

  // Rename category
  const [renameModal, setRenameModal] = useState<{ open: boolean; id: number | null; name: string }>({ open: false, id: null, name: '' });
  const [renameSaving, setRenameSaving] = useState(false);

  // Move to category
  const [moveModal, setMoveModal] = useState<{ open: boolean; id: number | null; title: string }>({ open: false, id: null, title: '' });
  const [moveSaving, setMoveSaving] = useState(false);

  // Search modal (AI)
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [modalIndex, setModalIndex] = useState(0);
  const [aiMode, setAiMode] = useState(true);
  const modalInputRef = useRef<HTMLInputElement>(null);
  const [aiResults, setAiResults] = useState<Bookmark[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const iconCache = useRef<Map<string, string>>(new Map());
  const catScrollRef = useRef<HTMLDivElement>(null);
  const [mobileCatOpen, setMobileCatOpen] = useState(false);

  // ── Data Fetch ───────────────────────────────────────
  const fetchData = useCallback(async () => {
    try {
      const [bRes, cRes] = await Promise.all([
        fetch('/api/bookmarks?limit=2000'),
        fetch('/api/categories'),
      ]);
      const bData = await bRes.json();
      const cData = await cRes.json();
      setBookmarks(bData.bookmarks || []);
      setCategories(cData.categories || []);
    } catch (err) { console.error(err); }
  }, []);

  useEffect(() => {
    Promise.all([
      fetch('/api/bookmarks?limit=2000').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
      fetch('/api/clicks?limit=20').then(r => r.json()),
    ]).then(([b, c, r]) => {
      setBookmarks(b.bookmarks || []);
      setCategories(c.categories || []);
      setRecentIds((r.recent || []).map((x: Bookmark) => x.id));
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  useEffect(() => { setCurrentPage(1); }, [activeCat, search]);
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('recent_bookmarks') || '[]');
      if (stored.length) setRecentIds(prev => Array.from(new Set([...stored, ...prev])));
    } catch { }
  }, []);

  // ── AI Search ────────────────────────────────────────
  useEffect(() => {
    if (!modalOpen || !aiMode || !modalQuery.trim()) { setAiResults(null); return; }
    if (aiDebounce.current) clearTimeout(aiDebounce.current);
    aiDebounce.current = setTimeout(async () => {
      setAiLoading(true); setAiError('');
      try {
        const res = await fetch('/api/ai/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query: modalQuery }) });
        const data = await res.json();
        if (data.error) { setAiError(data.error); setAiResults([]); }
        else setAiResults(data.results || []);
      } catch { setAiError('AI 搜索失败'); setAiResults([]); }
      finally { setAiLoading(false); }
    }, 500);
    return () => { if (aiDebounce.current) clearTimeout(aiDebounce.current); };
  }, [modalOpen, aiMode, modalQuery]);
  useEffect(() => { if (!modalOpen) { setModalQuery(''); setAiResults(null); setAiMode(true); setModalIndex(0); } }, [modalOpen]);
  useEffect(() => { if (modalOpen) setTimeout(() => modalInputRef.current?.focus(), 80); }, [modalOpen]);
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) { setModalOpen(false); return; }
      if (e.key === '/' && !modalOpen && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); setModalOpen(true); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modalOpen]);

  const recordClick = useCallback(async (b: Bookmark) => {
    if (editMode) return; // Don't record clicks in edit mode
    const ids = [b.id, ...recentIds.filter(id => id !== b.id)].slice(0, 20);
    setRecentIds(ids);
    localStorage.setItem('recent_bookmarks', JSON.stringify(ids));
    try { await fetch('/api/clicks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmark_id: b.id }) }); } catch { }
  }, [recentIds, editMode]);

  const filtered = useMemo(() => {
    let list = bookmarks;
    if (activeCat !== 'all') list = list.filter(b => b.category_name === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q));
    }
    // Sort: featured first, then by sort_order, then by id desc
    return list.sort((a, b) => {
      if ((b as any).is_featured !== (a as any).is_featured) return (b as any).is_featured ? 1 : -1;
      if ((a as any).sort_order !== (b as any).sort_order) return (a as any).sort_order - (b as any).sort_order;
      return b.id - a.id;
    });
  }, [bookmarks, activeCat, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  const modalResults = useMemo(() => {
    if (aiMode) return (aiResults || []).map(b => ({ ...b }));
    if (!modalQuery.trim()) return [];
    const q = modalQuery.toLowerCase();
    return bookmarks.filter(b => (b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q) || b.category_name.toLowerCase().includes(q)) && !b.is_dead).slice(0, 30);
  }, [aiMode, aiResults, modalQuery, bookmarks]);

  const modalSelect = useCallback((b: Bookmark) => { recordClick(b); setModalOpen(false); window.open(b.url, '_blank'); }, [recordClick]);

  const favicon = (domain: string) => {
    if (!domain) return '';
    if (iconCache.current.has(domain)) return iconCache.current.get(domain)!;
    const u = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    iconCache.current.set(domain, u);
    return u;
  };

  const allCount = bookmarks.filter(b => !b.is_dead).length;

  // ── Category Reorder ─────────────────────────────────
  const moveCatOrder = useCallback(async (catId: number, dir: -1 | 1) => {
    const sorted = [...categories].sort((a, b) => a.sort_order - b.sort_order);
    const idx = sorted.findIndex(c => c.id === catId);
    if (idx === -1) return;
    const target = idx + dir;
    if (target < 0 || target >= sorted.length) return;
    // Swap sort_order
    const current = sorted[idx];
    const other = sorted[target];
    const tmp = current.sort_order;
    current.sort_order = other.sort_order;
    other.sort_order = tmp;
    // Sort back
    const reordered = sorted.map((c, i) => ({ id: c.id, sort_order: i }));
    try {
      await fetch('/api/categories', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ reorder: reordered }) });
      setCategories(prev => {
        const map = new Map(prev.map(c => [c.id, c]));
        for (const r of reordered) {
          if (map.has(r.id)) map.get(r.id)!.sort_order = r.sort_order;
        }
        return [...map.values()].sort((a, b) => a.sort_order - b.sort_order);
      });
    } catch (err) { console.error(err); }
  }, [categories]);

  // ── Edit / Save Bookmark ─────────────────────────────
  const openEditModal = useCallback((b: Bookmark) => {
    setEditTitle(b.title);
    setEditUrl(b.url);
    const cat = categories.find(c => c.name === b.category_name);
    setEditCatId(cat?.id ?? null);
    setEditModal({ open: true, b });
  }, [categories]);

  const saveEdit = useCallback(async () => {
    if (!editModal.b || !editTitle.trim() || !editUrl.trim()) return;
    setEditSaving(true);
    try {
      const body: any = { title: editTitle.trim(), url: editUrl.trim() };
      if (editCatId !== null) body.category_id = editCatId;
      const res = await fetch(`/api/bookmarks/${editModal.b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setEditModal({ open: false, b: null });
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setEditSaving(false); }
  }, [editModal, editTitle, editUrl, editCatId, fetchData]);

  // ── Delete Bookmark ──────────────────────────────────
  const deleteBookmark = useCallback(async (id: number) => {
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setDeleteConfirm(null);
        setBookmarks(prev => prev.filter(b => b.id !== id));
      }
    } catch (err) { console.error(err); }
  }, []);

  // ── Rename Category ──────────────────────────────────
  const saveRename = useCallback(async () => {
    if (!renameModal.id || !renameModal.name.trim()) return;
    setRenameSaving(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: renameModal.id, name: renameModal.name.trim() }),
      });
      if (res.ok) {
        setRenameModal({ open: false, id: null, name: '' });
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setRenameSaving(false); }
  }, [renameModal, fetchData]);

  // ── Pin/Unpin Bookmark ───────────────────────────────
  const togglePin = useCallback(async (b: Bookmark) => {
    try {
      const res = await fetch(`/api/bookmarks/${b.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_featured: !(b as any).is_featured }),
      });
      if (res.ok) fetchData();
    } catch (err) { console.error(err); }
  }, [fetchData]);

  // ── Move Bookmark ────────────────────────────────────
  const moveBookmark = useCallback(async (bookmarkId: number, categoryId: number) => {
    setMoveSaving(true);
    try {
      const res = await fetch(`/api/bookmarks/${bookmarkId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_id: categoryId }),
      });
      if (res.ok) {
        setMoveModal({ open: false, id: null, title: '' });
        fetchData();
      }
    } catch (err) { console.error(err); }
    finally { setMoveSaving(false); }
  }, [fetchData]);

  // ── Active category name for breadcrumb ──────────────
  const activeCatName = useMemo(() => {
    if (activeCat === 'all') return '全部';
    const cat = categories.find(c => c.name === activeCat);
    return cat ? catLabel(cat.name) : activeCat;
  }, [activeCat, categories]);

  return (
    <div className="min-h-screen bg-[#fafafa] relative">
      {/* ─── Gradient Background ─── */}
      <div className="fixed top-0 left-0 right-0 h-[420px] bg-gradient-to-b from-violet-100/60 via-fuchsia-100/20 to-transparent pointer-events-none -z-0" />
      <div className="flex max-w-[1400px] mx-auto relative z-10 min-h-screen">

        {/* ═══ LEFT SIDEBAR (md+) ═══ */}
        <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-gray-200/50 bg-white/50 backdrop-blur-sm sticky top-0 h-screen">
          <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
            <h1 className="text-base font-bold text-gray-900 flex items-center gap-2">📑 书签导航</h1>
          </div>
          <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5 scrollbar-hide">
            <SidebarItem active={activeCat === 'all'} emoji="🏠" name="全部" count={allCount}
              onClick={() => { setActiveCat('all'); setMobileCatOpen(false); }} />
            <div className="h-px bg-gray-100 my-2 mx-3" />
            {categories.map(cat => {
              const active = activeCat === cat.name;
              return (
                <div key={cat.id} className="group relative">
                  <SidebarItem active={active} emoji={catEmoji(cat.name)} name={catLabel(cat.name)} count={cat.bookmark_count}
                    onClick={() => { setActiveCat(cat.name); setMobileCatOpen(false); }} />
                  {editMode && (
                    <div className="absolute right-1 top-1/2 -translate-y-1/2 flex gap-0.5 opacity-0 group-hover:opacity-100 transition">
                      <button onClick={e => { e.stopPropagation(); setRenameModal({ open: true, id: cat.id, name: cat.name }); }}
                        className="p-0.5 text-gray-400 hover:text-blue-600 bg-white rounded" title="重命名">✎</button>
                      <button onClick={e => { e.stopPropagation(); moveCatOrder(cat.id, -1); }}
                        className="p-0.5 text-gray-400 hover:text-gray-700 bg-white rounded" title="上移">▲</button>
                      <button onClick={e => { e.stopPropagation(); moveCatOrder(cat.id, 1); }}
                        className="p-0.5 text-gray-400 hover:text-gray-700 bg-white rounded" title="下移">▼</button>
                    </div>
                  )}
                </div>
              );
            })}
          </nav>
          <div className="px-4 py-3 border-t border-gray-100 text-[10px] text-gray-300 space-y-1">
            <a href="/admin" className="block hover:text-gray-400">后台管理</a>
          </div>
        </aside>

        {/* ═══ RIGHT: MAIN CONTENT ═══ */}
        <div className="flex-1 min-w-0">

          {/* ─── HEADER ─── */}
          <header className="sticky top-0 z-40 bg-white/85 backdrop-blur-xl border-b border-gray-200/60 px-4 py-3 shadow-sm">
            {/* Breadcrumb */}
            <div className="flex items-center text-[11px] text-gray-400 mb-2 gap-1">
              <a href="/" className="hover:text-gray-600">首页</a>
              <span>/</span>
              <span className="text-gray-600 font-medium">{activeCatName}</span>
              {search && <><span>/</span><span className="text-purple-500">搜索: {search}</span></>}
              <span className="ml-auto text-[10px]">{filtered.length} 条</span>
            </div>

            <div className="flex items-center gap-2.5">
              <button className="md:hidden text-lg shrink-0" onClick={() => setMobileCatOpen(v => !v)}>
                {mobileCatOpen ? '✕' : '☰'}
              </button>
              <h1 className="md:hidden text-base font-bold text-black/90 shrink-0">📑</h1>

              <div className="relative flex-1">
                <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                  placeholder={`在 ${bookmarks.length} 个书签中搜索...`}
                  className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-lg outline-none bg-gray-50/80 focus:bg-white focus:border-purple-400 focus:ring-2 focus:ring-purple-100 placeholder-gray-400 transition" />
              </div>

              <button onClick={() => setEditMode(v => !v)}
                className={`flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition shrink-0 ${
                  editMode ? 'bg-green-600 text-white border-green-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}>
                {editMode ? '✓ 完成' : '✎ 编辑'}
              </button>

              <button onClick={() => setModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700 shadow-sm transition whitespace-nowrap shrink-0">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                <span className="hidden sm:inline">AI</span>
              </button>
            </div>

            {/* Mobile category scroller */}
            <div className="md:hidden mt-2.5">
              <div ref={catScrollRef} className="overflow-x-auto scrollbar-hide -mx-4 px-4">
                <div className="flex gap-1.5 flex-nowrap w-max min-w-full">
                  <button onClick={() => setActiveCat('all')}
                    className={`px-3 py-1.5 text-xs rounded-full border transition shrink-0 ${
                      activeCat === 'all' ? 'bg-gray-900 text-white border-gray-900 font-semibold shadow-sm' : 'bg-white/80 text-gray-600 border-gray-200 hover:bg-gray-100'
                    }`}>全部 ({allCount})</button>
                  {categories.map(cat => (
                    <button key={cat.id} onClick={() => setActiveCat(cat.name)}
                      className={`px-3 py-1.5 text-xs rounded-full border transition shrink-0 ${
                        activeCat === cat.name ? 'bg-gray-900 text-white border-gray-900 font-semibold shadow-sm' : 'bg-white/80 text-gray-600 border-gray-200 hover:bg-gray-100'
                      }`}>{cat.name} ({cat.bookmark_count})</button>
                  ))}
                </div>
              </div>
            </div>
          </header>

          {/* ─── MAIN CONTENT ─── */}
          <main className="px-4 py-5">
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {Array.from({ length: 20 }).map((_, i) => (
                  <div key={i} className="animate-pulse bg-white rounded-xl border border-gray-100 p-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-gray-100 rounded-lg flex-shrink-0" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 bg-gray-100 rounded w-full" />
                        <div className="h-2.5 bg-gray-50 rounded w-2/3" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-400">没有匹配的书签</div>
            ) : (
              <>
                {filtered.length > pageSize && (
                  <div className="text-xs text-gray-400 mb-3 text-center">
                    共 {filtered.length} 条 · 第 {currentPage}/{totalPages} 页
                  </div>
                )}

                {/* ─── Card Grid ─── */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {paginated.map(b => (
                    <div key={b.id} className="group relative">
                      <a href={editMode ? undefined : b.url}
                        target={editMode ? undefined : '_blank'}
                        rel={editMode ? undefined : 'noopener'}
                        onClick={e => { if (!editMode) { recordClick(b); } else { e.preventDefault(); } }}
                        className={`block relative rounded-xl border border-gray-100 bg-white p-3 transition-all duration-200 ${
                          editMode ? 'cursor-default border-dashed border-gray-300' :
                          'hover:shadow-md hover:-translate-y-0.5 hover:border-gray-200 active:scale-[0.98] cursor-pointer'
                        } ${b.is_dead ? 'opacity-40' : ''}`}>
                        {/* Pin badge */}
                        {(b as any).is_featured && !editMode && (
                          <div className="absolute -top-1.5 -right-1.5 z-10 w-5 h-5 flex items-center justify-center bg-yellow-400 rounded-full text-[10px] shadow-sm">⭐</div>
                        )}
                        {/* Top gradient line */}
                        <div className={`absolute top-0 left-3 right-3 h-0.5 rounded-full bg-gradient-to-r ${getGrad(b.category_name || '', 'header')} opacity-0 group-hover:opacity-100 transition-opacity`} />
                        {/* Icon + Title */}
                        <div className="flex items-start gap-2.5">
                          <img src={favicon(b.domain)} alt=""
                            className="w-8 h-8 rounded-lg flex-shrink-0 bg-gray-50 border border-gray-100"
                            loading="lazy"
                            onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-medium text-gray-800 leading-snug line-clamp-2 group-hover:text-blue-600 transition-colors">
                              {b.is_dead && '⚠️ '}{b.title}
                            </div>
                            <div className="mt-0.5 text-[11px] font-medium text-gray-500 truncate">{b.domain || ''}</div>
                          </div>
                        </div>
                        {/* Category badge */}
                        <div className="mt-2 flex items-center gap-1.5 flex-wrap min-h-[18px]">
                          {b.category_name && (
                            <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-gradient-to-r ${getGrad(b.category_name, 'card')} text-gray-500`}>
                              {catLabel(b.category_name)}
                            </span>
                          )}
                          {b.summary && !b.category_name && (
                            <span className="text-[10px] text-gray-400 truncate">{b.summary}</span>
                          )}
                        </div>
                      </a>

                      {/* Edit mode: action buttons */}
                      {editMode && (
                        <div className="absolute -top-2 -right-2 flex gap-1 z-20">
                          <button onClick={() => togglePin(b)}
                            className={`w-7 h-7 flex items-center justify-center rounded-full border shadow-sm text-xs transition ${
                              (b as any).is_featured
                                ? 'bg-yellow-100 border-yellow-300 text-yellow-600'
                                : 'bg-white border-gray-200 text-gray-400 hover:text-yellow-500 hover:border-yellow-300'
                            }`}
                            title={(b as any).is_featured ? '取消置顶' : '置顶'}>⭐</button>
                          <button onClick={() => openEditModal(b)}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-xs text-gray-500 hover:text-blue-600 hover:border-blue-300 transition"
                            title="编辑">✎</button>
                          <button onClick={() => setMoveModal({ open: true, id: b.id, title: b.title })}
                            className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-xs text-gray-500 hover:text-green-600 hover:border-green-300 transition"
                            title="移动">↗</button>
                          {deleteConfirm === b.id ? (
                            <div className="flex gap-0.5">
                              <button onClick={() => deleteBookmark(b.id)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-red-500 text-white text-xs shadow-sm"
                                title="确认删除">✓</button>
                              <button onClick={() => setDeleteConfirm(null)}
                                className="w-7 h-7 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 text-xs"
                                title="取消">✕</button>
                            </div>
                          ) : (
                            <button onClick={() => setDeleteConfirm(b.id)}
                              className="w-7 h-7 flex items-center justify-center rounded-full bg-white border border-gray-200 shadow-sm text-xs text-gray-500 hover:text-red-600 hover:border-red-300 transition"
                              title="删除">✕</button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
                    <button onClick={() => setCurrentPage(1)} disabled={currentPage === 1}
                      className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">«</button>
                    <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}
                      className="px-3 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">上一页</button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                      .map((p, i, arr) => (
                        <span key={p}>
                          {i > 0 && arr[i - 1] !== p - 1 && <span className="px-1 text-gray-300 text-xs">…</span>}
                          <button onClick={() => setCurrentPage(p)}
                            className={`px-3 py-1 text-xs rounded border transition ${
                              p === currentPage ? 'bg-gray-900 text-white border-gray-900 font-semibold' : 'border-gray-200 bg-white hover:bg-gray-50'
                            }`}>{p}</button>
                        </span>
                      ))}
                    <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}
                      className="px-3 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">下一页</button>
                    <button onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}
                      className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed">»</button>
                  </div>
                )}
              </>
            )}
          </main>

          {/* ─── FOOTER ─── */}
          <footer className="border-t border-gray-100 py-6 px-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-gray-400 justify-center">
                <a href="/" className="hover:text-gray-600">📑 首页</a>
                <a href="/admin" className="hover:text-gray-600">⚙️ 后台管理</a>
                <span className="text-gray-200">|</span>
                <span>共 {bookmarks.length} 个书签</span>
                <span className="text-gray-200">|</span>
                <span className="text-gray-300">{categories.length} 个分类</span>
              </div>
              <div className="mt-2 text-center text-[10px] text-gray-300">
                书签导航 · 私人书签管理
              </div>
            </div>
          </footer>
        </div>
      </div>

      {/* ═══ MOBILE CATEGORY OVERLAY ═══ */}
      {mobileCatOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setMobileCatOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-64 bg-white shadow-xl animate-slide-in">
            <div className="px-4 pt-5 pb-3 border-b border-gray-100 flex items-center justify-between">
              <h1 className="text-base font-bold">📑 书签导航</h1>
              <button onClick={() => setMobileCatOpen(false)} className="text-gray-400 text-lg">✕</button>
            </div>
            <nav className="overflow-y-auto px-2 py-3 space-y-0.5 h-[calc(100vh-60px)] scrollbar-hide">
              <SidebarItem active={activeCat === 'all'} emoji="🏠" name="全部" count={allCount}
                onClick={() => { setActiveCat('all'); setMobileCatOpen(false); }} />
              <div className="h-px bg-gray-100 my-2 mx-3" />
              {categories.map(cat => (
                <SidebarItem key={cat.id} active={activeCat === cat.name}
                  emoji={catEmoji(cat.name)} name={catLabel(cat.name)} count={cat.bookmark_count}
                  onClick={() => { setActiveCat(cat.name); setMobileCatOpen(false); }} />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ═══ EDIT MODAL ═══ */}
      {editModal.open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center" onClick={() => setEditModal({ open: false, b: null })}>
          <div className="w-[420px] max-w-[90vw] bg-white rounded-xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-base font-semibold mb-4">✎ 编辑书签</h2>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">标题</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">URL</label>
                <input type="text" value={editUrl} onChange={e => setEditUrl(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">分类</label>
                <select value={editCatId ?? ''} onChange={e => setEditCatId(e.target.value ? Number(e.target.value) : null)}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100 bg-white">
                  <option value="">无分类</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            <div className="flex gap-2 mt-5 justify-end">
              <button onClick={() => setEditModal({ open: false, b: null })}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={saveEdit} disabled={editSaving || !editTitle.trim() || !editUrl.trim()}
                className="px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40">
                {editSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ MOVE TO CATEGORY MODAL ═══ */}
      {moveModal.open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center" onClick={() => setMoveModal({ open: false, id: null, title: '' })}>
          <div className="w-[360px] max-w-[90vw] bg-white rounded-xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-1">移动到分类</h2>
            <p className="text-xs text-gray-400 mb-4 truncate">{moveModal.title}</p>
            <div className="space-y-1 max-h-[300px] overflow-y-auto">
              {categories.map(cat => (
                <button key={cat.id} onClick={() => moveModal.id && moveBookmark(moveModal.id, cat.id)}
                  disabled={moveSaving}
                  className="w-full text-left px-3 py-2 text-sm rounded-lg hover:bg-violet-50 transition flex items-center gap-2">
                  <span>{catEmoji(cat.name)}</span>
                  <span>{catLabel(cat.name)}</span>
                  <span className="text-[10px] text-gray-400 ml-auto">{cat.bookmark_count}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 text-center">
              <button onClick={() => setMoveModal({ open: false, id: null, title: '' })}
                className="text-xs text-gray-400 hover:text-gray-600">取消</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ RENAME CATEGORY MODAL ═══ */}
      {renameModal.open && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center" onClick={() => setRenameModal({ open: false, id: null, name: '' })}>
          <div className="w-[360px] max-w-[90vw] bg-white rounded-xl shadow-2xl p-5" onClick={e => e.stopPropagation()}>
            <h2 className="text-sm font-semibold mb-3">✎ 重命名分类</h2>
            <input type="text" value={renameModal.name} onChange={e => setRenameModal(prev => ({ ...prev, name: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-100"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') saveRename(); }} />
            <div className="flex gap-2 mt-4 justify-end">
              <button onClick={() => setRenameModal({ open: false, id: null, name: '' })}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">取消</button>
              <button onClick={saveRename} disabled={renameSaving || !renameModal.name.trim()}
                className="px-4 py-2 text-sm bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white rounded-lg hover:from-violet-700 hover:to-fuchsia-700 disabled:opacity-40">
                {renameSaving ? '保存中...' : '保存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ AI SEARCH MODAL ═══ */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
          onClick={() => setModalOpen(false)}>
          <div className="w-[640px] max-w-[92vw] bg-white/98 rounded-xl shadow-2xl shadow-black/20 ring-1 ring-black/5 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center border-b border-gray-100">
              <svg className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input ref={modalInputRef} type="text" value={modalQuery}
                onChange={e => { setModalQuery(e.target.value); setModalIndex(0); }}
                placeholder={aiMode ? '🔮 用自然语言描述你想找什么...' : '搜索书名、域名或分类...'}
                className="flex-1 px-3 py-4 text-base border-none outline-none bg-transparent text-gray-900 placeholder-gray-400"
                onKeyDown={e => {
                  if (e.key === 'Tab') { e.preventDefault(); setAiMode(v => !v); setAiResults(null); setModalIndex(0); return; }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setModalIndex(i => Math.min(i + 1, modalResults.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setModalIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter' && modalResults[modalIndex]) { e.preventDefault(); modalSelect(modalResults[modalIndex]); }
                  else if (e.key === 'Escape') setModalOpen(false);
                }} />
              <div className="flex items-center gap-0.5 mr-2 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
                <button onClick={() => { setAiMode(true); setAiResults(null); setModalIndex(0); }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${aiMode ? 'bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>AI</button>
                <button onClick={() => { setAiMode(false); setAiResults(null); setModalIndex(0); }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${!aiMode ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>关键词</button>
              </div>
              <button onClick={() => setModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {aiMode && aiLoading && (
                <div className="text-center py-10 text-gray-400 text-sm">
                  <div className="ai-dot-pulse inline-flex gap-1.5">
                    <span className="w-2 h-2 bg-purple-400 rounded-full" />
                    <span className="w-2 h-2 bg-purple-400 rounded-full" style={{ animationDelay: '0.2s' }} />
                    <span className="w-2 h-2 bg-purple-400 rounded-full" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <div className="mt-2">AI 思考中...</div>
                </div>
              )}
              {aiMode && !aiLoading && modalQuery && aiError && (
                <div className="text-center py-8">
                  <p className="text-red-400 text-sm mb-1">⚠️ {aiError}</p>
                  <p className="text-xs text-gray-400">请检查 DeepSeek API 配置</p>
                </div>
              )}
              {!aiLoading && modalQuery && modalResults.length === 0 && !aiError && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {aiMode ? 'AI 没有找到匹配的书签' : '未找到匹配书签'}
                </div>
              )}
              {!modalQuery && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <p className="mb-1">输入关键词搜索 {bookmarks.length} 个书签</p>
                  <p className="text-[11px] text-gray-300">AI 模式 · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Tab</kbd> 切换</p>
                </div>
              )}
              {modalResults.length > 0 && (
                <div>
                  {aiMode && <div className="px-3 py-1.5 text-[11px] text-purple-500 font-medium">AI 搜索结果 · {modalResults.length} 个</div>}
                  {modalResults.map((b, i) => (
                    <div key={b.id} onClick={() => modalSelect(b)} onMouseEnter={() => setModalIndex(i)}
                      className={`flex items-start gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition ${
                        i === modalIndex ? 'bg-gradient-to-r from-violet-50 to-fuchsia-50' : 'hover:bg-gray-50'
                      }`}>
                      <img src={favicon(b.domain)} alt="" className="w-5 h-5 rounded flex-shrink-0 mt-0.5" loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{b.title}</div>
                        <div className="text-[11px] text-gray-400 mt-0.5">{b.domain}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-300 flex gap-3">
              <span>↑↓ 导航</span><span>↵ 打开</span><span>Tab 切换</span><span>Esc 关闭</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

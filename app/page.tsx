'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

// ── Types ──────────────────────────────────────────────
interface Bookmark {
  id: number;
  url: string;
  title: string;
  domain: string;
  category_name: string;
  category_icon: string;
  icon: string;
  is_dead: boolean;
  summary: string;
  ai_note?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  bookmark_count: number;
}

// ── Main Component ─────────────────────────────────────
export default function Home() {
  // Data
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  // View state
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [recentIds, setRecentIds] = useState<number[]>([]);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 100;

  // Search modal
  const [modalOpen, setModalOpen] = useState(false);
  const [modalQuery, setModalQuery] = useState('');
  const [modalIndex, setModalIndex] = useState(0);
  const [aiMode, setAiMode] = useState(true); // default ON
  const modalInputRef = useRef<HTMLInputElement>(null);

  // AI state
  const [aiResults, setAiResults] = useState<Bookmark[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const iconCache = useRef<Map<string, string>>(new Map());

  // ── Initial Data Fetch ──────────────────────────────
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

  // Reset page when category or search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCat, search]);

  // ── Local recent ─────────────────────────────────────
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('recent_bookmarks') || '[]');
      if (stored.length) setRecentIds(prev => Array.from(new Set([...stored, ...prev])));
    } catch { }
  }, []);

  // ── AI Search (debounced) ──────────────────────────
  useEffect(() => {
    if (!modalOpen || !aiMode || !modalQuery.trim()) {
      setAiResults(null);
      return;
    }
    if (aiDebounce.current) clearTimeout(aiDebounce.current);
    aiDebounce.current = setTimeout(async () => {
      setAiLoading(true);
      setAiError('');
      try {
        const res = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: modalQuery }),
        });
        const data = await res.json();
        if (data.error) { setAiError(data.error); setAiResults([]); }
        else setAiResults(data.results || []);
      } catch {
        setAiError('AI 搜索失败');
        setAiResults([]);
      } finally { setAiLoading(false); }
    }, 500);
    return () => { if (aiDebounce.current) clearTimeout(aiDebounce.current); };
  }, [modalOpen, aiMode, modalQuery]);

  // Reset when modal closes
  useEffect(() => {
    if (!modalOpen) { setModalQuery(''); setAiResults(null); setAiMode(true); setModalIndex(0); }
  }, [modalOpen]);

  // ── Focus modal input ──────────────────────────────
  useEffect(() => {
    if (modalOpen) setTimeout(() => modalInputRef.current?.focus(), 80);
  }, [modalOpen]);

  // ── Keyboard: Esc to close ─────────────────────────
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalOpen) { setModalOpen(false); return; }
      if (e.key === '/' && !modalOpen && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault();
        setModalOpen(true);
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [modalOpen]);

  // ── Record Click ───────────────────────────────────
  const recordClick = useCallback(async (b: Bookmark) => {
    const ids = [b.id, ...recentIds.filter(id => id !== b.id)].slice(0, 20);
    setRecentIds(ids);
    localStorage.setItem('recent_bookmarks', JSON.stringify(ids));
    try { await fetch('/api/clicks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmark_id: b.id }) }); } catch { }
  }, [recentIds]);

  // ── Filtered bookmarks (category view) ─────────────
  const filtered = useMemo(() => {
    let list = bookmarks;
    if (activeCat !== 'all') list = list.filter(b => b.category_name === activeCat);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(b => b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q));
    }
    return list;
  }, [bookmarks, activeCat, search]);

  // ── Paginated bookmarks ────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, currentPage, pageSize]);

  // ── Modal results ──────────────────────────────────
  const modalResults = useMemo(() => {
    if (aiMode) return (aiResults || []).map(b => ({ ...b }));
    // Keyword mode — from all bookmarks
    if (!modalQuery.trim()) return [];
    const q = modalQuery.toLowerCase();
    return bookmarks
      .filter(b =>
        (b.title.toLowerCase().includes(q) || b.url.toLowerCase().includes(q) || b.domain.toLowerCase().includes(q) || b.category_name.toLowerCase().includes(q)) && !b.is_dead
      )
      .slice(0, 30);
  }, [aiMode, aiResults, modalQuery, bookmarks]);

  // ── Modal select ───────────────────────────────────
  const modalSelect = useCallback((b: Bookmark) => {
    recordClick(b);
    setModalOpen(false);
    window.open(b.url, '_blank');
  }, [recordClick]);

  // ── Group category view ────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<string, Bookmark[]> = {};
    for (const b of paginated) {
      const cat = b.category_name || '其他';
      (map[cat] ||= []).push(b);
    }
    return map;
  }, [paginated]);

  // ── Favicon ────────────────────────────────────────
  const favicon = (domain: string) => {
    if (!domain) return '';
    if (iconCache.current.has(domain)) return iconCache.current.get(domain)!;
    const u = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    iconCache.current.set(domain, u);
    return u;
  };

  const allCount = bookmarks.filter(b => !b.is_dead).length;

  // ── Render ─────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* ─── Header ─── */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto">
          {/* Row 1: title + search bar + AI search button */}
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-lg font-bold text-black whitespace-nowrap shrink-0">📑 书签导航</h1>

            {/* Quick filter */}
            <div className="relative flex-1">
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`筛选 ${bookmarks.length} 个书签...`}
                className="w-full px-3 py-1.5 text-sm border border-gray-300 rounded-md outline-none bg-gray-50 focus:bg-white focus:border-gray-500 placeholder-gray-400 transition"
              />
            </div>

            {/* AI Search Button — opens modal */}
            <button
              onClick={() => setModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 shadow-sm shadow-purple-200 transition whitespace-nowrap shrink-0"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
              </svg>
              AI 搜索
            </button>

            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">{allCount}/{bookmarks.length}</span>
          </div>

          {/* Row 2: Category Tabs */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCat('all')}
              className={`px-3 py-1.5 text-xs rounded-md border transition ${activeCat === 'all' ? 'bg-gray-900 text-white border-gray-900 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
            >全部 ({allCount})</button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.name)}
                className={`px-3 py-1.5 text-xs rounded-md border transition whitespace-nowrap ${activeCat === cat.name ? 'bg-gray-900 text-white border-gray-900 font-semibold' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'}`}
              >{cat.name} ({cat.bookmark_count})</button>
            ))}
          </div>

          {/* Row 3: Recent */}
          {recentIds.length > 0 && !search && activeCat === 'all' && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 shrink-0">最近:</span>
              {recentIds.slice(0, 8).map(id => {
                const b = bookmarks.find(x => x.id === id);
                if (!b) return null;
                return (
                  <a key={id} href={b.url} target="_blank" rel="noopener" onClick={() => recordClick(b)}
                    className="text-xs text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-2 py-0.5 rounded whitespace-nowrap max-w-[180px] truncate"
                    title={b.title}>{b.title}</a>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* ─── Main Content ─── */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          /* ── Skeleton Loading ── */
          <div className="space-y-6">
            {[0, 1, 2].map(s => (
              <section key={s} className="bg-white rounded-lg border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
                  <div className="skeleton-line h-4 w-24" />
                  <div className="skeleton-line h-4 w-8 rounded-full" />
                </div>
                <div className="divide-y divide-gray-50">
                  {[0, 1, 2, 3, 4].map(i => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      <div className="skeleton-line w-4 h-4 rounded-sm flex-shrink-0" />
                      <div className="skeleton-line h-4 flex-1 max-w-[300px]" />
                      <div className="skeleton-line h-3 w-20 hidden md:block" />
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">没有匹配的书签</div>
        ) : (
          <>
            {/* Page info */}
            {filtered.length > pageSize && (
              <div className="text-xs text-gray-400 mb-3 text-center">
                共 {filtered.length} 条，第 {currentPage}/{totalPages} 页，当前显示 {paginated.length} 条
              </div>
            )}

            {Object.entries(grouped).map(([cat, items]) => (
              <section key={cat} className="mb-6 bg-white rounded-lg border border-gray-100 overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
                  <span className="text-sm font-semibold text-gray-800">{cat}</span>
                  <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 rounded-full">{items.length}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {items.map(b => (
                    <a key={b.id} href={b.url} target="_blank" rel="noopener" onClick={() => recordClick(b)}
                      className={`flex items-center gap-3 px-4 py-2.5 hover:bg-[#f2f6ff] transition group ${b.is_dead ? 'opacity-40' : ''}`}>
                      <img src={favicon(b.domain)} alt="" className="w-4 h-4 rounded-sm flex-shrink-0" loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <span className="flex-1 text-sm text-gray-900 truncate group-hover:text-blue-600">{b.is_dead && '⚠️ '}{b.title}</span>
                      {b.summary && (
                        <span className="text-[11px] text-gray-400 truncate max-w-[200px] hidden md:inline">{b.summary}</span>
                      )}
                      {b.domain && !b.summary && (
                        <span className="text-[11px] text-gray-400 truncate max-w-[180px] hidden sm:inline">{b.domain}</span>
                      )}
                    </a>
                  ))}
                </div>
              </section>
            ))}

            {/* ── Pagination Controls ── */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-1 mt-6 flex-wrap">
                {/* First page */}
                <button
                  onClick={() => setCurrentPage(1)}
                  disabled={currentPage === 1}
                  className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="第一页"
                >«</button>

                {/* Previous page */}
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >上一页</button>

                {/* Page numbers */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => {
                    // Show first, last, current, and 2 on each side of current
                    return p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2;
                  })
                  .map((p, i, arr) => (
                    <>
                      {/* Add ellipsis if gap > 1 */}
                      {i > 0 && arr[i - 1] !== p - 1 && (
                        <span key={`sep-${p}`} className="px-1 text-gray-300 text-xs">…</span>
                      )}
                      <button
                        key={p}
                        onClick={() => setCurrentPage(p)}
                        className={`px-3 py-1 text-xs rounded border transition ${
                          p === currentPage
                            ? 'bg-gray-900 text-white border-gray-900 font-semibold'
                            : 'border-gray-200 bg-white hover:bg-gray-50'
                        }`}
                      >{p}</button>
                    </>
                  ))}

                {/* Next page */}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                >下一页</button>

                {/* Last page */}
                <button
                  onClick={() => setCurrentPage(totalPages)}
                  disabled={currentPage === totalPages}
                  className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="最后一页"
                >»</button>
              </div>
            )}
          </>
        )}
      </main>

      {/* ─── Footer ─── */}
      <footer className="text-center py-4 text-[11px] text-gray-300 border-t border-gray-100">
        书签导航 · {bookmarks.length} 个书签 · 支持 AI 智能搜索 🔮 · <a href="/admin" className="hover:text-gray-400">后台</a>
      </footer>

      {/* ─── Search Modal ─── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-start justify-center pt-[12vh]"
          onClick={() => setModalOpen(false)}>
          <div className="w-[640px] max-w-[92vw] bg-white/98 rounded-xl shadow-2xl shadow-black/20 ring-1 ring-black/5 overflow-hidden"
            onClick={e => e.stopPropagation()}>
            
            {/* Search input row */}
            <div className="flex items-center border-b border-gray-100">
              <svg className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                ref={modalInputRef}
                type="text"
                value={modalQuery}
                onChange={e => { setModalQuery(e.target.value); setModalIndex(0); }}
                placeholder={aiMode ? '🔮 用自然语言描述你想找什么... 如"前端开发工具"、"在线设计"、"云服务"' : '搜索书名、域名或分类...'}
                className="flex-1 px-3 py-4 text-base border-none outline-none bg-transparent text-gray-900 placeholder-gray-400"
                onKeyDown={e => {
                  if (e.key === 'Tab') { e.preventDefault(); setAiMode(v => !v); setAiResults(null); setModalIndex(0); return; }
                  if (e.key === 'ArrowDown') { e.preventDefault(); setModalIndex(i => Math.min(i + 1, modalResults.length - 1)); }
                  else if (e.key === 'ArrowUp') { e.preventDefault(); setModalIndex(i => Math.max(i - 1, 0)); }
                  else if (e.key === 'Enter' && modalResults[modalIndex]) { e.preventDefault(); modalSelect(modalResults[modalIndex]); }
                  else if (e.key === 'Escape') setModalOpen(false);
                }}
              />
              {/* AI / 关键词 toggle */}
              <div className="flex items-center gap-0.5 mr-2 bg-gray-100 rounded-lg p-0.5 flex-shrink-0">
                <button
                  onClick={() => { setAiMode(true); setAiResults(null); setModalIndex(0); }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${aiMode ? 'bg-purple-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >AI</button>
                <button
                  onClick={() => { setAiMode(false); setAiResults(null); setModalIndex(0); }}
                  className={`px-2.5 py-1 text-xs rounded-md font-medium transition ${!aiMode ? 'bg-gray-700 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >关键词</button>
              </div>
              {/* Close button */}
              <button onClick={() => setModalOpen(false)} className="p-3 text-gray-400 hover:text-gray-600 flex-shrink-0">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Results */}
            <div className="max-h-[55vh] overflow-y-auto p-2">
              {/* AI loading */}
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

              {/* AI error */}
              {aiMode && !aiLoading && modalQuery && aiError && (
                <div className="text-center py-8">
                  <p className="text-red-400 text-sm mb-1">⚠️ {aiError}</p>
                  <p className="text-xs text-gray-400">请检查 DeepSeek API 配置，或切换到「关键词」模式</p>
                </div>
              )}

              {/* No results */}
              {!aiLoading && modalQuery && modalResults.length === 0 && !aiError && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {aiMode ? 'AI 没有找到匹配的书签，试试换个说法' : '未找到匹配书签'}
                </div>
              )}

              {/* Empty state */}
              {!modalQuery && (
                <div className="text-center py-12 text-gray-400 text-sm">
                  <svg className="w-10 h-10 mx-auto mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <p className="mb-1">输入关键词搜索 {bookmarks.length} 个书签</p>
                  <p className="text-[11px] text-gray-300">
                    AI 模式将理解你的自然语言意图 · <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Tab</kbd> 切换模式
                  </p>
                </div>
              )}

              {/* Results list */}
              {modalResults.length > 0 && (
                <div>
                  {aiMode && (
                    <div className="px-3 py-1.5 text-[11px] text-purple-500 font-medium flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      AI 搜索结果 · {modalResults.length} 个
                    </div>
                  )}
                  {modalResults.map((b, i) => (
                    <div
                      key={b.id}
                      onClick={() => modalSelect(b)}
                      onMouseEnter={() => setModalIndex(i)}
                      className={`flex items-start gap-3 px-3 py-2.5 mx-1 rounded-lg cursor-pointer transition ${
                        i === modalIndex ? 'bg-[#f2f6ff]' : 'hover:bg-gray-50'
                      }`}
                    >
                      <img src={favicon(b.domain)} alt="" className="w-5 h-5 rounded flex-shrink-0 mt-0.5" loading="lazy"
                        onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{b.title}</div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[11px] text-gray-400 truncate">{b.domain}</span>
                          <span className="text-[10px] text-gray-300 bg-gray-100 px-1 rounded">{b.category_name}</span>
                        </div>
                        {(b.ai_note || b.summary) && (
                          <div className="mt-1 text-[11px] text-purple-500 bg-purple-50 inline-block px-1.5 py-0.5 rounded">
                            {b.ai_note || b.summary}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer hints */}
            <div className="px-3 py-2 border-t border-gray-100 text-[11px] text-gray-300 flex gap-3">
              <span>↑↓ 导航</span>
              <span>↵ 打开</span>
              <span>Tab 切换模式</span>
              <span>Esc 关闭</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

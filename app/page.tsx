'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';

interface Bookmark {
  id: number;
  url: string;
  title: string;
  domain: string;
  category_name: string;
  category_icon: string;
  icon: string;
  is_dead: boolean;
  ai_note?: string;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  bookmark_count: number;
}

export default function Home() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState('all');
  const [search, setSearch] = useState('');
  const [cmdOpen, setCmdOpen] = useState(false);
  const [cmdQuery, setCmdQuery] = useState('');
  const [cmdIndex, setCmdIndex] = useState(0);
  const [recentIds, setRecentIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);

  // --- AI mode ---
  const [aiMode, setAiMode] = useState(false);
  const [aiSearchMode, setAiSearchMode] = useState(false); // AI mode for Cmd+K
  const [aiResults, setAiResults] = useState<Bookmark[] | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const aiDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const cmdInputRef = useRef<HTMLInputElement>(null);
  const iconCache = useRef<Map<string, string>>(new Map());

  // Fetch all data
  useEffect(() => {
    Promise.all([
      fetch('/api/bookmarks?limit=2000').then((r) => r.json()),
      fetch('/api/categories').then((r) => r.json()),
      fetch('/api/clicks?limit=20').then((r) => r.json()),
    ]).then(([bData, cData, rData]) => {
      setBookmarks(bData.bookmarks || []);
      setCategories(cData.categories || []);
      setRecentIds((rData.recent || []).map((b: Bookmark) => b.id));
    }).catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  // Load recent from localStorage
  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem('recent_bookmarks') || '[]');
      if (stored.length) setRecentIds((prev) => Array.from(new Set([...stored, ...prev])));
    } catch { }
  }, []);

  // --- AI Search (debounced) ---
  useEffect(() => {
    if (!aiMode || !search.trim()) {
      setAiResults(null);
      return;
    }

    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    aiDebounceRef.current = setTimeout(async () => {
      setAiLoading(true);
      setAiError('');
      try {
        const res = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: search }),
        });
        const data = await res.json();
        if (data.error) setAiError(data.error);
        setAiResults(data.results || []);
      } catch (err) {
        setAiError('AI 搜索失败');
        setAiResults(null);
      } finally {
        setAiLoading(false);
      }
    }, 600);
    return () => { if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current); };
  }, [aiMode, search]);

  // --- AI Cmd+K Search ---
  useEffect(() => {
    if (!cmdOpen || !aiSearchMode || !cmdQuery.trim()) return;

    if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current);
    aiDebounceRef.current = setTimeout(async () => {
      setAiLoading(true);
      try {
        const res = await fetch('/api/ai/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: cmdQuery }),
        });
        const data = await res.json();
        setAiResults(data.results || []);
      } catch {
        setAiResults(null);
      } finally {
        setAiLoading(false);
      }
    }, 600);
    return () => { if (aiDebounceRef.current) clearTimeout(aiDebounceRef.current); };
  }, [cmdOpen, aiSearchMode, cmdQuery]);

  // Reset AI when Cmd+K closes
  useEffect(() => {
    if (!cmdOpen) {
      setAiSearchMode(false);
      setAiResults(null);
      setCmdQuery('');
    }
  }, [cmdOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen((v) => !v);
        setCmdQuery('');
        setCmdIndex(0);
      }
      if (e.key === 'Escape') {
        if (cmdOpen) { setCmdOpen(false); return; }
        setSearch('');
        setAiMode(false);
      }
      if (e.key === '/' && !cmdOpen && document.activeElement !== searchRef.current) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [cmdOpen]);

  // Focus cmd input
  useEffect(() => {
    if (cmdOpen) setTimeout(() => cmdInputRef.current?.focus(), 50);
  }, [cmdOpen]);

  // Record click
  const recordClick = useCallback(async (b: Bookmark) => {
    const ids = [b.id, ...recentIds.filter((id) => id !== b.id)].slice(0, 20);
    setRecentIds(ids);
    localStorage.setItem('recent_bookmarks', JSON.stringify(ids));
    try {
      await fetch('/api/clicks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmark_id: b.id }),
      });
    } catch { }
  }, [recentIds]);

  // Filter bookmarks (when NOT in AI mode)
  const filtered = useMemo(() => {
    let list = bookmarks;
    if (activeCat !== 'all') {
      list = list.filter((b) => b.category_name === activeCat);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          b.url.toLowerCase().includes(q) ||
          b.domain.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookmarks, activeCat, search]);

  // Cmd+K filtered (keyword mode)
  const cmdFiltered = useMemo(() => {
    if (!cmdQuery.trim()) return [];
    const q = cmdQuery.toLowerCase();
    return bookmarks
      .filter(
        (b) =>
          (b.title.toLowerCase().includes(q) ||
            b.url.toLowerCase().includes(q) ||
            b.domain.toLowerCase().includes(q) ||
            (b.category_name || '').toLowerCase().includes(q)) &&
          !b.is_dead
      )
      .slice(0, 15);
  }, [bookmarks, cmdQuery]);

  // Cmd+K results (keyword or AI)
  const cmdResults = useMemo(() => {
    if (aiSearchMode && aiResults) return aiResults;
    return cmdFiltered.map((b) => ({ ...b, ai_note: '' }));
  }, [aiSearchMode, aiResults, cmdFiltered]);

  // Cmd navigation
  const cmdSelect = useCallback((b: Bookmark) => {
    recordClick(b);
    setCmdOpen(false);
    window.open(b.url, '_blank');
  }, [recordClick]);

  // Group by category (only for non-AI mode)
  const grouped = useMemo(() => {
    const map: Record<string, Bookmark[]> = {};
    for (const b of filtered) {
      const cat = b.category_name || '其他';
      if (!map[cat]) map[cat] = [];
      map[cat].push(b);
    }
    return map;
  }, [filtered]);

  // Favicon URL
  const favicon = (domain: string) => {
    if (!domain) return '';
    if (iconCache.current.has(domain)) return iconCache.current.get(domain)!;
    const url = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    iconCache.current.set(domain, url);
    return url;
  };

  const allCount = bookmarks.filter((b) => !b.is_dead).length;
  const showAIResults = aiMode && aiResults !== null;

  return (
    <div className="min-h-screen bg-[#fafafa]">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white border-b border-gray-200 px-4 py-3 shadow-sm">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center gap-3 mb-3">
            <h1 className="text-lg font-bold text-black whitespace-nowrap shrink-0">书签导航</h1>
            <div className="relative flex-1">
              <input
                ref={searchRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={
                  aiMode
                    ? '🔮 用自然语言描述你想找什么... 如"前端开发工具"、"看视频的网站"'
                    : `搜索 ${bookmarks.length} 个书签... (Ctrl+K 命令面板)`
                }
                className={`w-full px-3 py-1.5 text-sm border rounded-md outline-none placeholder-gray-400 transition ${
                  aiMode
                    ? 'border-purple-300 bg-purple-50/50 focus:bg-white focus:border-purple-400'
                    : 'border-gray-300 bg-gray-50 focus:bg-white focus:border-gray-500'
                }`}
              />
              {aiLoading && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <span className="ai-dot-pulse inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </span>
                </div>
              )}
            </div>
            {/* AI Toggle */}
            <button
              onClick={() => { setAiMode((v) => !v); setAiResults(null); if (aiMode) setSearch(''); }}
              title={aiMode ? '关闭 AI 搜索' : '开启 AI 智能搜索'}
              className={`px-2.5 py-1.5 text-xs rounded-md border transition whitespace-nowrap shrink-0 ${
                aiMode
                  ? 'bg-purple-600 text-white border-purple-600 shadow-sm'
                  : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50 hover:border-gray-300'
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                AI
              </span>
            </button>
            <span className="text-xs text-gray-400 whitespace-nowrap shrink-0">
              {showAIResults ? aiResults!.length : filtered.length}/{bookmarks.length}
            </span>
          </div>

          {/* Category Tabs */}
          <div className="flex gap-1.5 flex-wrap">
            <button
              onClick={() => setActiveCat('all')}
              className={`px-3 py-1.5 text-xs rounded-md border transition ${
                activeCat === 'all'
                  ? 'bg-gray-900 text-white border-gray-900 font-semibold'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
              }`}
            >
              全部 ({allCount})
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCat(cat.name)}
                className={`px-3 py-1.5 text-xs rounded-md border transition whitespace-nowrap ${
                  activeCat === cat.name
                    ? 'bg-gray-900 text-white border-gray-900 font-semibold'
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-100'
                }`}
              >
                {cat.name} ({cat.bookmark_count})
              </button>
            ))}
          </div>

          {/* Recent Clicked */}
          {recentIds.length > 0 && !search && activeCat === 'all' && (
            <div className="mt-3 flex items-center gap-1.5 flex-wrap">
              <span className="text-[11px] text-gray-400 shrink-0">最近:</span>
              {recentIds.slice(0, 8).map((id) => {
                const b = bookmarks.find((x) => x.id === id);
                if (!b) return null;
                return (
                  <a
                    key={id}
                    href={b.url}
                    target="_blank"
                    rel="noopener"
                    onClick={() => recordClick(b)}
                    className="text-xs text-gray-500 hover:text-blue-600 bg-gray-100 hover:bg-blue-50 px-2 py-0.5 rounded whitespace-nowrap max-w-[180px] truncate"
                    title={b.title}
                  >
                    {b.title}
                  </a>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6">
        {loading ? (
          <div className="text-center py-20 text-gray-400">加载中...</div>
        ) : showAIResults ? (
          /* --- AI Search Results --- */
          aiResults!.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              {aiError ? (
                <div>
                  <p className="text-red-400 mb-2">⚠️ {aiError}</p>
                  <p className="text-xs">请检查 DEEPSEEK_API_KEY 是否正确配置</p>
                </div>
              ) : (
                <div>
                  <p className="mb-1">AI 未找到匹配的书签</p>
                  <p className="text-xs">试试换个说法，或关闭 AI 用关键词搜索</p>
                </div>
              )}
            </div>
          ) : (
            <div>
              {/* AI search indicator */}
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-gray-100">
                <svg className="w-4 h-4 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
                <span className="text-sm text-purple-600 font-medium">
                  AI 搜索结果 — 「{search}」
                </span>
                <span className="text-xs text-gray-400">{aiResults!.length} 个结果</span>
              </div>

              {/* AI Result Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {aiResults!.map((b) => (
                  <a
                    key={b.id}
                    href={b.url}
                    target="_blank"
                    rel="noopener"
                    onClick={() => recordClick(b)}
                    className="ai-card group"
                  >
                    <div className="flex items-start gap-3">
                      <img
                        src={favicon(b.domain)}
                        alt=""
                        className="w-5 h-5 rounded flex-shrink-0 mt-0.5"
                        loading="lazy"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate group-hover:text-purple-600 transition-colors">
                          {b.title}
                        </div>
                        <div className="text-[11px] text-gray-400 truncate mt-0.5">{b.domain}</div>
                        {b.ai_note && (
                          <div className="mt-1.5 inline-flex items-center gap-1 text-[10px] text-purple-500 bg-purple-50 px-1.5 py-0.5 rounded">
                            <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                            </svg>
                            {b.ai_note}
                          </div>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          )
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-400">没有匹配的书签</div>
        ) : (
          /* --- Normal Category View --- */
          Object.entries(grouped).map(([cat, items]) => (
            <section key={cat} className="mb-6 bg-white rounded-lg border border-gray-100 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
                <span className="text-sm font-semibold text-gray-800">{cat}</span>
                <span className="text-[11px] text-gray-400 bg-gray-100 px-1.5 rounded-full">{items.length}</span>
              </div>
              <div className="divide-y divide-gray-50">
                {items.map((b) => (
                  <a
                    key={b.id}
                    href={b.url}
                    target="_blank"
                    rel="noopener"
                    onClick={() => recordClick(b)}
                    className={`flex items-center gap-3 px-4 py-2.5 hover:bg-[#f2f6ff] transition group ${
                      b.is_dead ? 'opacity-40' : ''
                    }`}
                  >
                    <img
                      src={favicon(b.domain)}
                      alt=""
                      className="w-4 h-4 rounded-sm flex-shrink-0"
                      loading="lazy"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                    <span className="flex-1 text-sm text-gray-900 truncate group-hover:text-blue-600">
                      {b.is_dead && '⚠️ '}
                      {b.title}
                    </span>
                    {b.domain && (
                      <span className="text-[11px] text-gray-400 truncate max-w-[180px] flex-shrink-0 hidden sm:block">
                        {b.domain}
                      </span>
                    )}
                  </a>
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      {/* Footer */}
      <footer className="text-center py-4 text-[11px] text-gray-300 border-t border-gray-100">
        书签导航 · {bookmarks.length} 个书签 · Ctrl+K 命令面板 · 支持 AI 智能搜索 🔮
      </footer>

      {/* Cmd+K Command Palette */}
      {cmdOpen && (
        <div className="cmd-overlay" onClick={() => setCmdOpen(false)}>
          <div className="cmd-panel" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center border-b border-gray-200">
              <input
                ref={cmdInputRef}
                type="text"
                value={cmdQuery}
                onChange={(e) => { setCmdQuery(e.target.value); setCmdIndex(0); }}
                className="cmd-input border-b-0 flex-1"
                placeholder={
                  aiSearchMode
                    ? '🔮 用自然语言描述... 如"设计工具"、"云服务"'
                    : '搜索书签名称、域名或分类...'
                }
                onKeyDown={(e) => {
                  // Tab to toggle AI mode
                  if (e.key === 'Tab') {
                    e.preventDefault();
                    setAiSearchMode((v) => !v);
                    setAiResults(null);
                    setCmdIndex(0);
                    return;
                  }
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setCmdIndex((i) => Math.min(i + 1, cmdResults.length - 1));
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setCmdIndex((i) => Math.max(i - 1, 0));
                  } else if (e.key === 'Enter' && cmdResults[cmdIndex]) {
                    e.preventDefault();
                    cmdSelect(cmdResults[cmdIndex]);
                  } else if (e.key === 'Escape') {
                    setCmdOpen(false);
                  }
                }}
              />
              {/* AI mode toggle in Cmd+K */}
              <button
                onClick={() => { setAiSearchMode((v) => !v); setAiResults(null); setCmdIndex(0); }}
                title={aiSearchMode ? '切换为关键词搜索' : '切换为 AI 智能搜索'}
                className={`px-2.5 py-1 mr-1 text-[10px] rounded font-medium transition flex-shrink-0 ${
                  aiSearchMode
                    ? 'bg-purple-100 text-purple-700'
                    : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                }`}
              >
                AI
              </button>
            </div>
            <div className="cmd-results">
              {aiSearchMode && aiLoading && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <span className="ai-dot-pulse inline-flex gap-1">
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.15s' }} />
                    <span className="w-1.5 h-1.5 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                  </span>
                  <span className="ml-2">AI 思考中...</span>
                </div>
              )}
              {!aiLoading && cmdResults.map((b, i) => (
                <div
                  key={b.id}
                  className={`cmd-item ${i === cmdIndex ? 'active' : ''}`}
                  onClick={() => cmdSelect(b)}
                  onMouseEnter={() => setCmdIndex(i)}
                >
                  <img src={favicon(b.domain)} alt="" className="cmd-icon" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  <div className="flex-1 min-w-0">
                    <div className="cmd-title">{b.title}</div>
                    {b.ai_note && (
                      <div className="text-[10px] text-purple-500 truncate">{b.ai_note}</div>
                    )}
                  </div>
                  <span className="cmd-domain">{b.domain}</span>
                </div>
              ))}
              {!aiLoading && cmdQuery && cmdResults.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  {aiSearchMode ? 'AI 未找到匹配书签，试试换个说法' : '未找到匹配书签'}
                </div>
              )}
              {!aiLoading && !cmdQuery && (
                <div className="text-center py-8 text-gray-400 text-sm">
                  输入关键词搜索 {bookmarks.length} 个书签...
                  <br />
                  <span className="text-[11px]">
                    按 <kbd className="px-1 py-0.5 bg-gray-100 rounded text-[10px]">Tab</kbd> 切换 AI 智能搜索
                  </span>
                </div>
              )}
            </div>
            <div className="cmd-footer">
              <span>↑↓ 导航</span>
              <span>↵ 打开</span>
              <span>Tab AI模式</span>
              <span>Esc 关闭</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

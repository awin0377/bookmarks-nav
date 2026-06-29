'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';

// ── Types ──
interface Bookmark {
  id: number;
  url: string;
  title: string;
  domain: string;
  category_name: string;
  category_icon: string;
  summary: string;
  description: string;
  tags: string;
  features: string;
  is_dead: boolean;
  is_featured: boolean;
  sort_order: number;
}

interface Category {
  id: number;
  name: string;
  icon: string;
  bookmark_count: number;
}

// ── Category palette ──
const categoryPalette: { emoji: string; color: string; bg: string }[] = [
  { emoji: '🎨',  color: '#7c3aed', bg: '#ede9fe' },
  { emoji: '🤖',  color: '#6366f1', bg: '#eef2ff' },
  { emoji: '☁️',  color: '#3b82f6', bg: '#eff6ff' },
  { emoji: '💼',  color: '#0ea5e9', bg: '#f0f9ff' },
  { emoji: '🛠️',  color: '#10b981', bg: '#ecfdf5' },
  { emoji: '📦',  color: '#64748b', bg: '#f1f5f9' },
  { emoji: '💰',  color: '#f59e0b', bg: '#fffbeb' },
  { emoji: '🛒',  color: '#f43f5e', bg: '#fff1f2' },
  { emoji: '📣',  color: '#d946ef', bg: '#fdf4ff' },
  { emoji: '🔍',  color: '#06b6d4', bg: '#ecfeff' },
  { emoji: '🔐',  color: '#ef4444', bg: '#fef2f2' },
  { emoji: '📱',  color: '#84cc16', bg: '#f7fee7' },
  { emoji: '🏪',  color: '#ea580c', bg: '#fff7ed' },
  { emoji: '🌐',  color: '#0891b2', bg: '#ecfeff' },
  { emoji: '🖼️',  color: '#a855f7', bg: '#faf5ff' },
  { emoji: '⚡',  color: '#eab308', bg: '#fefce8' },
  { emoji: '📝',  color: '#8b5cf6', bg: '#f5f3ff' },
  { emoji: '📊',  color: '#4f46e5', bg: '#eef2ff' },
  { emoji: '📚',  color: '#ca8a04', bg: '#fefce8' },
  { emoji: '🎬',  color: '#f43f5e', bg: '#fff1f2' },
  { emoji: '🎵',  color: '#0891b2', bg: '#ecfeff' },
  { emoji: '💻',  color: '#059669', bg: '#ecfdf5' },
  { emoji: '🛡️',  color: '#ef4444', bg: '#fef2f2' },
  { emoji: '📈',  color: '#06b6d4', bg: '#ecfeff' },
];

// ── Helpers ──
function extractEmoji(name: string) {
  const firstToken = name.split(/\s+/)[0] || '';
  const idx = firstToken ? categoryPalette.findIndex(p => p.emoji === firstToken) : -1;
  return categoryPalette[idx >= 0 ? idx : Math.abs(hashStr(name)) % categoryPalette.length];
}

function hashStr(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function parseTags(raw: string | null | undefined): string[] {
  if (!raw || raw === '[]') return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

function parseFeatures(raw: string | null | undefined): string[] {
  if (!raw || raw === '[]') return [];
  try { const a = JSON.parse(raw); return Array.isArray(a) ? a : []; } catch { return []; }
}

// ── Sidebar nav skeleton ──
function NavSkeleton() {
  return (
    <div style={{ padding: '16px 0' }}>
      {Array.from({ length: 10 }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', margin: '1px 10px' }}>
          <div style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(0,0,0,0.05)', flexShrink: 0 }} />
          <div style={{ flex: 1, height: 13, borderRadius: 5, background: 'rgba(0,0,0,0.05)' }} />
          <div style={{ width: 28, height: 18, borderRadius: 9, background: 'rgba(0,0,0,0.04)' }} />
        </div>
      ))}
    </div>
  );
}

function CardSkeleton() {
  return Array.from({ length: 12 }).map((_, i) => (
    <div key={i} className="tc-card" style={styles.cardSkel as React.CSSProperties}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.06)', flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ height: 14, width: '65%', borderRadius: 4, background: 'rgba(0,0,0,0.06)', marginBottom: 6 }} />
        </div>
      </div>
      <div style={{ height: 12, width: '100%', borderRadius: 4, background: 'rgba(0,0,0,0.04)', marginBottom: 5 }} />
      <div style={{ height: 12, width: '78%', borderRadius: 4, background: 'rgba(0,0,0,0.03)' }} />
    </div>
  ));
}

// ═══════════════════════════════════════════════════════════
//  MAIN PAGE
// ═══════════════════════════════════════════════════════════
export default function ToolsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const mainRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Mobile detection
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth <= 900);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Load data
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, bmRes] = await Promise.all([
        fetch('/api/categories'),
        fetch('/api/bookmarks?limit=5000'),
      ]);
      const catData = await catRes.json();
      const bmData = await bmRes.json();
      setCategories(catData.categories || []);
      setBookmarks((bmData.bookmarks || []).filter((b: Bookmark) => !b.is_dead));
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, []);

  // Group bookmarks by category (preserve category order), sort by sort_order within each group
  const grouped = useMemo(() => {
    const map: Record<string, Bookmark[]> = {};
    for (const b of bookmarks) {
      const cat = b.category_name || '未分类';
      if (!map[cat]) map[cat] = [];
      map[cat].push(b);
    }
    // Sort each group by sort_order (ascending → pinned items first)
    for (const items of Object.values(map)) {
      items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    // Sort groups by category order
    const ordered: { cat: Category | null; catName: string; items: Bookmark[] }[] = [];
    for (const c of categories) {
      if (map[c.name]) {
        const items = map[c.name];
        delete map[c.name];
        // Apply search filter
        ordered.push({ cat: c, catName: c.name, items: filterBySearch(items, search) });
      }
    }
    // Remaining (uncategorized or deleted categories)
    for (const [catName, items] of Object.entries(map)) {
      ordered.push({ cat: null, catName, items: filterBySearch(items, search) });
    }
    return ordered;
  }, [bookmarks, categories, search]);

  // IntersectionObserver to highlight current section in sidebar
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const catName = (e.target as HTMLElement).dataset.catSection || '';
            if (catName) setActiveSection(catName);
          }
        }
      },
      { rootMargin: '-80px 0px -70% 0px', threshold: 0 }
    );
    const sections = document.querySelectorAll('[data-cat-section]');
    sections.forEach(s => observerRef.current?.observe(s));
    return () => observerRef.current?.disconnect();
  }, [grouped]);

  // Scroll to category
  const scrollTo = (catName: string) => {
    setActiveSection(catName);
    if (isMobile) setSidebarOpen(false);
    const el = document.getElementById(catSlug(catName));
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // ── Delete — optimistic removal + API persist ──
  const handleDelete = useCallback(async (id: number) => {
    // 1. Optimistic: remove from local state instantly
    setBookmarks(prev => prev.filter(b => b.id !== id));

    // 2. Persist to server (fire-and-forget, reload on error)
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch {
      // Rollback: reload full data if API fails
      loadData();
    }
  }, [loadData]);

  // ── Pin — move to top of its category + API persist ──
  const handlePin = useCallback((id: number) => {
    setBookmarks(prev => {
      const target = prev.find(b => b.id === id);
      if (!target) return prev;

      const catName = target.category_name || '未分类';

      // Find all items in the same category, sorted by current sort_order
      const sameCat = prev
        .filter(b => (b.category_name || '未分类') === catName)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

      // New sort_order: one less than the current minimum
      const minOrder = sameCat.length > 0 ? (sameCat[0].sort_order ?? 0) : 0;
      const newOrder = minOrder - 1;

      // Update the target's sort_order in the array
      const updated = prev.map(b =>
        b.id === id ? { ...b, sort_order: newOrder, is_featured: true } : b
      );

      // Persist to server
      fetch(`/api/bookmarks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newOrder }),
      }).catch(() => {});

      return updated;
    });
  }, []);

  // ── Save — 批量同步前端书签数组到后端 ──
  const handleSave = useCallback(async () => {
    setSaving(true);
    setSaveMsg(null);

    // 只发送 id 和 sort_order，后端据此同步删除和排序
    const payload = bookmarks.map(b => ({ id: b.id, sort_order: b.sort_order }));

    try {
      const res = await fetch('/api/save-bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookmarks: payload }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || '保存失败');

      setSaveMsg({
        type: 'success',
        text: `已同步 ${data.synced} 条，删除 ${data.deleted} 条`,
      });
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || '保存失败' });
    } finally {
      setSaving(false);
      // 3 秒后自动清除提示
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [bookmarks]);

  const totalCount = categories.reduce((s, c) => s + Number(c.bookmark_count || 0), 0);
  const visibleCount = grouped.reduce((s, g) => s + g.items.length, 0);

  return (
    <div style={styles.page}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══════ LEFT SIDEBAR ═══════ */}
      <aside
        className={`tools-aside ${isMobile && !sidebarOpen ? 'tools-aside-hidden' : ''}`}
        style={styles.sidebar as React.CSSProperties}
      >
        <div style={styles.sideHead}>
          <Link href="/" style={styles.logo}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>AI工具集</span>
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="tools-close-btn"
            style={styles.closeBtn}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Stats */}
        <div style={styles.stats}>
          <div style={styles.statItem}>
            <div style={styles.statNum}>{totalCount}</div>
            <div style={styles.statLabel}>工具</div>
          </div>
          <div style={styles.statItem}>
            <div style={styles.statNum}>{categories.length}</div>
            <div style={styles.statLabel}>分类</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          <div style={styles.navLabel}>分类导航</div>
          {categories.map(cat => {
            const meta = extractEmoji(cat.name);
            const isActive = activeSection === cat.name;
            return (
              <button
                key={cat.id}
                onClick={() => scrollTo(cat.name)}
                style={{
                  ...styles.navItem,
                  ...(isActive ? styles.navItemActive : {}),
                }}
              >
                <span style={styles.navEmoji}>{meta.emoji}</span>
                <span style={styles.navName}>{cat.name}</span>
                <span style={{
                  ...styles.navCount,
                  ...(isActive ? styles.navCountActive : {}),
                }}>{cat.bookmark_count || 0}</span>
              </button>
            );
          })}
        </nav>

        <div style={styles.sideFoot}>
          <Link href="/" style={styles.footLink}>🏠 首页</Link>
          <Link href="/dashboard" style={styles.footLink}>⭐ 常用</Link>
          <Link href="/admin" style={styles.footLink}>⚙️ 后台</Link>
        </div>
      </aside>

      {/* ═══════ RIGHT MAIN ═══════ */}
      <main className="tools-main" style={styles.main as React.CSSProperties} ref={mainRef}>
        {/* Top bar */}
        <div className="tools-topbar" style={styles.topBar}>
          <div style={styles.topLeft}>
            <button
              onClick={() => setSidebarOpen(true)}
              className="tools-burger"
              style={styles.burger}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <h1 style={styles.pageTitle}>AI工具导航</h1>
            <span style={styles.countBadge}>
              {loading ? '加载中...' : `共 ${visibleCount} 个`}
            </span>

            {/* Save button */}
            <button
              onClick={handleSave}
              disabled={saving || loading}
              style={{
                ...styles.saveBtn,
                ...(saving ? styles.saveBtnDisabled : {}),
              }}
              title="将当前书签状态同步到数据库"
            >
              {saving ? (
                <span style={styles.saveSpinner} />
              ) : (
                <span>💾</span>
              )}
              <span>{saving ? '保存中...' : '保存修改'}</span>
            </button>

            {/* Save feedback */}
            {saveMsg && (
              <span style={{
                ...styles.saveFeedback,
                ...(saveMsg.type === 'error' ? styles.saveFeedbackError : {}),
              }}>
                {saveMsg.type === 'success' ? '✅ ' : '❌ '}
                {saveMsg.text}
              </span>
            )}
          </div>

          {/* Search */}
          <div className="tools-search" style={styles.searchBox}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索工具名、域名、描述、标签..."
              style={styles.searchInput}
            />
            {search && (
              <button onClick={() => setSearch('')} style={styles.searchClear}>✕</button>
            )}
          </div>
        </div>

        {/* Content: category sections */}
        {loading ? (
          <div className="tools-grid" style={styles.grid}>
            <CardSkeleton />
          </div>
        ) : grouped.length === 0 ? (
          <div style={styles.empty}>
            <div style={{ fontSize: 48, marginBottom: 14 }}>📭</div>
            <div style={{ fontSize: 17, fontWeight: 600, color: '#333', marginBottom: 6 }}>
              {search ? '未找到匹配的工具' : '还没有工具'}
            </div>
            <div style={{ fontSize: 13, color: '#999' }}>
              {search ? '换个关键词试试' : '去后台添加一些书签吧'}
            </div>
          </div>
        ) : (
          <>
            {grouped.map(group => {
              const meta = extractEmoji(group.catName);
              const slug = catSlug(group.catName);
              return (
                <section
                  key={slug}
                  id={slug}
                  data-cat-section={group.catName}
                  style={styles.section}
                >
                  {/* Section header */}
                  <div style={styles.sectionHead}>
                    <div style={{ ...styles.sectionHeadIcon, background: meta.bg, color: meta.color }}>
                      {meta.emoji}
                    </div>
                    <h2 style={styles.sectionTitle}>{group.catName}</h2>
                    <span style={styles.sectionCount}>{group.items.length} 个</span>
                  </div>

                  {/* Card grid */}
                  {group.items.length === 0 ? (
                    <div style={{ padding: '12px 0', color: '#bbb', fontSize: 13, fontStyle: 'italic' }}>
                      该分类没有匹配的工具
                    </div>
                  ) : (
                    <div className="tools-grid" style={styles.grid}>
                      {group.items.map((b, i) => (
                        <ToolCard key={b.id} bookmark={b} catName={group.catName} onDelete={handleDelete} onPin={handlePin} />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}
      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .tools-main * { max-width: 100%; box-sizing: border-box; }
        .tools-grid {
          display: grid;
          gap: 10px;
          width: 100%;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
        }
        .tc-card { transition: all .22s ease; }
        .tc-card:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0,0,0,0.06), 0 2px 8px rgba(102,126,234,0.05); border-color: rgba(102,126,234,0.15); }
        .tc-tag { font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 500; white-space: nowrap; }
        .tc-btn:hover { transform: scale(1.1); }
        .tc-btn-pin:hover { background: #eef2ff; border-color: #5b5ce2; color: #5b5ce2; box-shadow: 0 2px 8px rgba(91,92,226,0.2); }
        .tc-btn-del:hover { background: #fef2f2; border-color: #ef4444; color: #ef4444; box-shadow: 0 2px 8px rgba(239,68,68,0.2); }

        /* Mobile sidebar */
        @media (max-width: 900px) {
          .tools-aside { position: fixed; left: 0; top: 0; height: 100vh; z-index: 100; transition: transform .3s ease; }
          .tools-aside-hidden { transform: translateX(-100%); }
          .tools-close-btn { display: flex; }
          .tools-burger { display: flex; }
          .tools-main { padding: 14px 14px 40px; }
          .tools-topbar { flex-direction: column; align-items: stretch; gap: 10px; }
          .tools-search { max-width: 100%; min-width: 0; }
          .tools-grid { gap: 8px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
        }

        /* Wider gap on large screens */
        @media (min-width: 1400px) {
          .tools-grid { gap: 14px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
        }
      `}</style>
    </div>
  );
}

// ── Tool Card ──
function ToolCard({ bookmark: b, catName, onDelete, onPin }: { bookmark: Bookmark; catName: string; onDelete: (id: number) => void; onPin: (id: number) => void }) {
  const tags = parseTags(b.tags);
  const features = parseFeatures(b.features);
  const [hovered, setHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onDelete(b.id); };
  const handlePin = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onPin(b.id); };

  return (
    <div
      className="tc-card relative"
      style={styles.card as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* ══ Management buttons — absolute top-right, JS-driven hover ══ */}
      <div className="tc-actions" style={{ position: 'absolute', top: '8px', right: '8px', zIndex: 50, display: hovered ? 'flex' : 'none', gap: 3, alignItems: 'center', background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)', padding: 4, borderRadius: 7, boxShadow: '0 1px 6px rgba(0,0,0,0.06)' }}>
        <button onClick={handlePin} className="tc-btn tc-btn-pin" style={styles.actionBtn as React.CSSProperties} title="置顶到此分类最前">
          📌
        </button>
        <button onClick={handleDelete} className="tc-btn tc-btn-del" style={styles.actionBtn as React.CSSProperties} title="删除此书签">
          🗑️
        </button>
      </div>

      {/* Top content group — title, desc pack together */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 0 }}>
        <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
          <div style={styles.cardTitle}>
            {b.title}
            {b.is_featured && <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 2 }}>⭐</span>}
          </div>
          <div style={styles.cardDomain}>{b.domain}</div>
        </a>

        {/* Description — two-line clamp */}
        {(b.description || b.summary) && (
          <div style={styles.cardDesc}>{b.description || b.summary}</div>
        )}
      </div>

      {/* Tags — auto-pin to bottom */}
      {tags.length > 0 && (
        <div style={styles.tagsRow}>
          {tags.slice(0, 3).map((t, i) => (
            <span key={i} className="tc-tag" style={{
              background: tagBg(i), color: tagColor(i),
            }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Tag color helpers ──
const tagColors = [
  ['#4f46e5', '#eef2ff'],
  ['#059669', '#ecfdf5'],
  ['#ea580c', '#fff7ed'],
  ['#db2777', '#fce7f3'],
  ['#0891b2', '#ecfeff'],
  ['#9333ea', '#faf5ff'],
  ['#dc2626', '#fef2f2'],
  ['#ca8a04', '#fefce8'],
];
function tagBg(i: number) { return tagColors[i % tagColors.length][1]; }
function tagColor(i: number) { return tagColors[i % tagColors.length][0]; }

// ── Helpers ──
function catSlug(name: string) { return 'cat-' + encodeURIComponent(name.replace(/\s+/g, '-')); }

function filterBySearch(items: Bookmark[], q: string): Bookmark[] {
  if (!q.trim()) return items;
  const lower = q.toLowerCase();
  return items.filter(b =>
    b.title.toLowerCase().includes(lower) ||
    b.domain.toLowerCase().includes(lower) ||
    (b.summary || '').toLowerCase().includes(lower) ||
    (b.description || '').toLowerCase().includes(lower) ||
    (b.tags || '').toLowerCase().includes(lower)
  );
}

// ═══════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════
const sidebarWidth = 240;

const styles: Record<string, React.CSSProperties> = {
  // Page — 全屏锁定，禁止整体滚动
  page: {
    display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden',
    background: '#f8f9fc',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "PingFang SC", sans-serif',
    color: '#1a1a2e',
  },
  overlay: {
    position: 'fixed', inset: 0, zIndex: 40,
    background: 'rgba(0,0,0,0.25)', backdropFilter: 'blur(2px)',
  },

  // Sidebar — 固定高度，自身独立滚动
  sidebar: {
    width: sidebarWidth, minWidth: sidebarWidth, height: '100%',
    flexShrink: 0,
    background: '#fff', borderRight: '1px solid #eee',
    display: 'flex', flexDirection: 'column', overflowY: 'auto', zIndex: 50,
  },
  sideHead: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '18px 16px 8px',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 7, textDecoration: 'none', color: 'inherit' },
  closeBtn: {
    display: 'none', width: 30, height: 30, borderRadius: 8,
    border: 'none', background: 'transparent', color: '#999',
    cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
  },
  stats: { display: 'flex', gap: 10, padding: '0 16px 14px' },
  statItem: {
    flex: 1, textAlign: 'center', padding: '10px 8px', borderRadius: 10,
    background: 'linear-gradient(135deg, #f8f5fd, #f4f7fd)',
  },
  statNum: { fontSize: 18, fontWeight: 700, color: '#5b5ce2', lineHeight: 1.2 },
  statLabel: { fontSize: 11, color: '#999', marginTop: 1 },
  nav: { flex: 1, overflowY: 'auto', padding: '0 0 10px' },
  navLabel: {
    fontSize: 11, fontWeight: 600, color: '#bbb',
    textTransform: 'uppercase' as const, letterSpacing: '0.04em',
    padding: '6px 16px 6px',
  },
  navItem: {
    display: 'flex', alignItems: 'center', gap: 8,
    width: 'calc(100% - 20px)', margin: '0 10px 1px',
    padding: '9px 12px', borderRadius: 10,
    border: 'none', background: 'transparent',
    color: '#555', fontSize: 13, fontWeight: 500,
    cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' as const,
    transition: 'all .12s ease',
  },
  navItemActive: {
    background: 'linear-gradient(135deg, #eef2ff, #ede9fe)',
    color: '#5b5ce2', fontWeight: 600,
    boxShadow: '0 2px 8px rgba(91,92,226,0.1)',
  },
  navEmoji: { fontSize: 16, flexShrink: 0, width: 22, textAlign: 'center' as const },
  navName: { flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const },
  navCount: {
    fontSize: 10, fontWeight: 600, color: '#bbb',
    background: 'rgba(0,0,0,0.04)', padding: '1px 7px', borderRadius: 10,
    flexShrink: 0, textAlign: 'center' as const,
  },
  navCountActive: { background: 'rgba(91,92,226,0.12)', color: '#5b5ce2' },
  sideFoot: {
    display: 'flex', gap: 2, padding: '10px 14px',
    borderTop: '1px solid #f0f0f0', flexWrap: 'wrap' as const,
  },
  footLink: { fontSize: 11, color: '#999', textDecoration: 'none', padding: '3px 6px', borderRadius: 5 },

  // Main — flex-1，右侧独立滚动
  main: { flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', padding: '24px 28px 60px' },

  // Top bar
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap' as const, gap: 12, marginBottom: 24,
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 10 },
  burger: {
    display: 'none', width: 34, height: 34, borderRadius: 8,
    border: 'none', background: '#fff', color: '#555',
    cursor: 'pointer', alignItems: 'center', justifyContent: 'center',
    boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
  },
  pageTitle: { fontSize: 21, fontWeight: 700, color: '#1a1a2e', margin: 0 },
  countBadge: {
    fontSize: 12, color: '#999', fontWeight: 500,
    padding: '3px 9px', borderRadius: 7, background: 'rgba(0,0,0,0.03)',
  },
  saveBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 600, color: '#5b5ce2',
    padding: '6px 14px', borderRadius: 8,
    border: '1px solid #e0ddff',
    background: 'linear-gradient(135deg, #f8f7ff, #f0edff)',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all .15s ease',
    whiteSpace: 'nowrap' as const,
  },
  saveBtnDisabled: {
    opacity: 0.6, cursor: 'not-allowed',
  },
  saveSpinner: {
    width: 14, height: 14, borderRadius: '50%',
    border: '2px solid #d0cdee', borderTopColor: '#5b5ce2',
    animation: 'spin 0.6s linear infinite',
    display: 'inline-block',
  },
  saveFeedback: {
    fontSize: 12, fontWeight: 500, color: '#059669',
    padding: '4px 10px', borderRadius: 6,
    background: '#ecfdf5',
    whiteSpace: 'nowrap' as const,
  },
  saveFeedbackError: {
    color: '#dc2626', background: '#fef2f2',
  },
  searchBox: {
    display: 'flex', alignItems: 'center', gap: 9,
    padding: '9px 14px', borderRadius: 11,
    background: '#fff', border: '1px solid #e8e8e8',
    boxShadow: '0 1px 6px rgba(0,0,0,0.02)',
    minWidth: 240, maxWidth: 360, transition: 'border-color .2s, box-shadow .2s',
  },
  searchInput: { flex: 1, border: 'none', outline: 'none', fontSize: 13.5, color: '#333', background: 'transparent', fontFamily: 'inherit' },
  searchClear: {
    width: 20, height: 20, borderRadius: '50%',
    border: 'none', background: 'rgba(0,0,0,0.06)', color: '#999',
    cursor: 'pointer', fontSize: 11, display: 'flex',
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },

  // Section
  section: { marginBottom: 36 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '0 2px' },
  sectionHeadIcon: {
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, flexShrink: 0,
  },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: 0 },
  sectionCount: { fontSize: 12, color: '#bbb', fontWeight: 500 },

  // Grid — auto-fill responsive, no fixed columns
  grid: {
    display: 'grid',
    gap: 10,
    width: '100%',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  },

  // Card — fixed height fill grid cell, buttons visible, uniform sizing
  card: {
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '12px',
    borderRadius: 10, height: '100%',
    background: '#fff',
    border: '1px solid rgba(0,0,0,0.04)',
    boxShadow: '0 1px 8px rgba(0,0,0,0.02), 0 0 0 0 rgba(102,126,234,0.02)',
    textDecoration: 'none', color: 'inherit',
    cursor: 'default', position: 'relative',
    transition: 'all .22s ease',
  },
  cardActions: {
    position: 'absolute', top: '8px', right: '8px', zIndex: 50,
    display: 'none', gap: 3, alignItems: 'center',
    background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(6px)',
    padding: 4, borderRadius: 7,
    boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
  },
  actionBtn: {
    width: 24, height: 24, borderRadius: 5,
    border: 'none', background: 'transparent', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 11, lineHeight: 1, color: '#666',
    transition: 'all .12s ease',
  },
  cardSkel: {
    padding: '12px', borderRadius: 10, height: '100%',
    background: '#fff', border: '1px solid rgba(0,0,0,0.03)',
    boxShadow: '0 1px 8px rgba(0,0,0,0.02)',
  },
  cardTitle: {
    fontSize: 12.5, fontWeight: 650, color: '#1a1a2e',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    lineHeight: 1.3, paddingRight: 28,
  },
  cardDomain: {
    fontSize: 10.5, color: '#bbb', fontWeight: 400,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
    marginTop: 1,
  },
  arrow: {},  // unused; kept for backward compat

  // Description — two-line clamp for uniform card height
  cardDesc: {
    fontSize: 11, color: '#888', fontWeight: 400,
    lineHeight: 1.5, width: '100%',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    marginTop: 8,
    minHeight: 33,  // ~2 lines × 11px × 1.5, prevents collapse on empty-ish states
  } as React.CSSProperties,

  // Tags — pinned to bottom via margin-top:auto + parent space-between
  tagsRow: {
    width: '100%', marginTop: 'auto',
    display: 'flex', flexWrap: 'wrap' as const, gap: 3,
    paddingTop: 6,
  },

  // Category badge
  catBadge: {},  // unused; kept for backward compat

  // Empty state
  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 20px', textAlign: 'center' as const,
  },
};

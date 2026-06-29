'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import Link from 'next/link';
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext, verticalListSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

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
const categoryPalette: { emoji: string; color: string; bg: string; gradient: string }[] = [
  { emoji: '🎨',  color: '#7c3aed', bg: '#ede9fe', gradient: 'linear-gradient(135deg, #faf5ff 0%, #ede9fe 100%)' },
  { emoji: '🤖',  color: '#6366f1', bg: '#eef2ff', gradient: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)' },
  { emoji: '☁️',  color: '#3b82f6', bg: '#eff6ff', gradient: 'linear-gradient(135deg, #f5f9ff 0%, #eff6ff 100%)' },
  { emoji: '💼',  color: '#0ea5e9', bg: '#f0f9ff', gradient: 'linear-gradient(135deg, #f8fdff 0%, #f0f9ff 100%)' },
  { emoji: '🛠️',  color: '#10b981', bg: '#ecfdf5', gradient: 'linear-gradient(135deg, #f7fefa 0%, #ecfdf5 100%)' },
  { emoji: '📦',  color: '#64748b', bg: '#f1f5f9', gradient: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)' },
  { emoji: '💰',  color: '#f59e0b', bg: '#fffbeb', gradient: 'linear-gradient(135deg, #fffdf5 0%, #fffbeb 100%)' },
  { emoji: '🛒',  color: '#f43f5e', bg: '#fff1f2', gradient: 'linear-gradient(135deg, #fefafa 0%, #fff1f2 100%)' },
  { emoji: '📣',  color: '#d946ef', bg: '#fdf4ff', gradient: 'linear-gradient(135deg, #fefafe 0%, #fdf4ff 100%)' },
  { emoji: '🔍',  color: '#06b6d4', bg: '#ecfeff', gradient: 'linear-gradient(135deg, #f8feff 0%, #ecfeff 100%)' },
  { emoji: '🔐',  color: '#ef4444', bg: '#fef2f2', gradient: 'linear-gradient(135deg, #fefafa 0%, #fef2f2 100%)' },
  { emoji: '📱',  color: '#84cc16', bg: '#f7fee7', gradient: 'linear-gradient(135deg, #fcfff5 0%, #f7fee7 100%)' },
  { emoji: '🏪',  color: '#ea580c', bg: '#fff7ed', gradient: 'linear-gradient(135deg, #fffcf8 0%, #fff7ed 100%)' },
  { emoji: '🌐',  color: '#0891b2', bg: '#ecfeff', gradient: 'linear-gradient(135deg, #f8feff 0%, #ecfeff 100%)' },
  { emoji: '🖼️',  color: '#a855f7', bg: '#faf5ff', gradient: 'linear-gradient(135deg, #fdfaff 0%, #faf5ff 100%)' },
  { emoji: '⚡',  color: '#eab308', bg: '#fefce8', gradient: 'linear-gradient(135deg, #fffefa 0%, #fefce8 100%)' },
  { emoji: '📝',  color: '#8b5cf6', bg: '#f5f3ff', gradient: 'linear-gradient(135deg, #fbfaff 0%, #f5f3ff 100%)' },
  { emoji: '📊',  color: '#4f46e5', bg: '#eef2ff', gradient: 'linear-gradient(135deg, #f8faff 0%, #eef2ff 100%)' },
  { emoji: '📚',  color: '#ca8a04', bg: '#fefce8', gradient: 'linear-gradient(135deg, #fffefa 0%, #fefce8 100%)' },
  { emoji: '🎬',  color: '#f43f5e', bg: '#fff1f2', gradient: 'linear-gradient(135deg, #fefafa 0%, #fff1f2 100%)' },
  { emoji: '🎵',  color: '#0891b2', bg: '#ecfeff', gradient: 'linear-gradient(135deg, #f8feff 0%, #ecfeff 100%)' },
  { emoji: '💻',  color: '#059669', bg: '#ecfdf5', gradient: 'linear-gradient(135deg, #f7fefa 0%, #ecfdf5 100%)' },
  { emoji: '🛡️',  color: '#ef4444', bg: '#fef2f2', gradient: 'linear-gradient(135deg, #fefafa 0%, #fef2f2 100%)' },
  { emoji: '📈',  color: '#06b6d4', bg: '#ecfeff', gradient: 'linear-gradient(135deg, #f8feff 0%, #ecfeff 100%)' },
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

// ── SortableCategory nav item (DND) ──
function SortableCategory({ cat, isActive, onScrollTo }: { cat: Category; isActive: boolean; onScrollTo: (name: string) => void }) {
  const meta = extractEmoji(cat.name);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: `cat-${cat.id}` });

  const style: React.CSSProperties = {
    ...styles.navItem,
    ...(isActive ? styles.navItemActive : {}),
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 100 : 'auto',
    cursor: 'grab',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <span style={styles.navEmoji}>{meta.emoji}</span>
      <span style={{ ...styles.navName, cursor: 'grab' }}>{cat.name}</span>
      <span style={{ ...styles.navCount, ...(isActive ? styles.navCountActive : {}) }}>
        {cat.bookmark_count || 0}
      </span>
    </div>
  );
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

  // Batch management state
  const [editMode, setEditMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [batchMoveCat, setBatchMoveCat] = useState('');
  const [batchLoading, setBatchLoading] = useState(false);

  const mainRef = useRef<HTMLDivElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  // DND sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

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

  // Group bookmarks by category
  const grouped = useMemo(() => {
    const map: Record<string, Bookmark[]> = {};
    for (const b of bookmarks) {
      const cat = b.category_name || '未分类';
      if (!map[cat]) map[cat] = [];
      map[cat].push(b);
    }
    for (const items of Object.values(map)) {
      items.sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
    }
    const ordered: { cat: Category | null; catName: string; items: Bookmark[] }[] = [];
    for (const c of categories) {
      if (map[c.name]) {
        const items = map[c.name];
        delete map[c.name];
        ordered.push({ cat: c, catName: c.name, items: filterBySearch(items, search) });
      }
    }
    for (const [catName, items] of Object.entries(map)) {
      ordered.push({ cat: null, catName, items: filterBySearch(items, search) });
    }
    return ordered;
  }, [bookmarks, categories, search]);

  // IntersectionObserver
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

  // ── Delete
  const handleDelete = useCallback(async (id: number) => {
    setBookmarks(prev => prev.filter(b => b.id !== id));
    setSelectedIds(prev => { const n = new Set(prev); n.delete(id); return n; });
    try {
      const res = await fetch(`/api/bookmarks/${id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Delete failed');
    } catch { loadData(); }
  }, [loadData]);

  // ── Pin
  const handlePin = useCallback((id: number) => {
    setBookmarks(prev => {
      const target = prev.find(b => b.id === id);
      if (!target) return prev;
      const catName = target.category_name || '未分类';
      const sameCat = prev.filter(b => (b.category_name || '未分类') === catName).sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
      const minOrder = sameCat.length > 0 ? (sameCat[0].sort_order ?? 0) : 0;
      const newOrder = minOrder - 1;
      fetch(`/api/bookmarks/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sort_order: newOrder }),
      }).catch(() => {});
      return prev.map(b => b.id === id ? { ...b, sort_order: newOrder, is_featured: true } : b);
    });
  }, []);

  // ── Save
  const handleSave = useCallback(async () => {
    setSaving(true); setSaveMsg(null);
    if (!Array.isArray(bookmarks) || bookmarks.length === 0) {
      setSaveMsg({ type: 'error', text: '没有书签数据可保存' });
      setSaving(false);
      return;
    }
    const payload = bookmarks.map(b => ({ id: b.id, sort_order: b.sort_order ?? 0 }));
    try {
      const res = await fetch('/api/save-bookmarks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ bookmarks: payload }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '保存失败');
      setSaveMsg({ type: 'success', text: `已同步 ${data.synced} 条，删除 ${data.deleted} 条` });
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || '保存失败' });
    } finally {
      setSaving(false);
      setTimeout(() => setSaveMsg(null), 3000);
    }
  }, [bookmarks]);

  // ── Batch delete
  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!confirm(`确认删除 ${selectedIds.size} 条书签？`)) return;
    setBatchLoading(true);
    try {
      const res = await fetch('/api/batch-bookmarks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', ids: [...selectedIds] }),
      });
      const data = await res.json();
      if (data.success) {
        setBookmarks(prev => prev.filter(b => !selectedIds.has(b.id)));
        setSelectedIds(new Set());
        setSaveMsg({ type: 'success', text: `已删除 ${data.deleted} 条` });
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || '批量删除失败' });
    } finally { setBatchLoading(false); }
  };

  // ── Batch move
  const batchMove = async () => {
    if (selectedIds.size === 0 || !batchMoveCat) return;
    setBatchLoading(true);
    try {
      const res = await fetch('/api/batch-bookmarks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', ids: [...selectedIds], category_name: batchMoveCat }),
      });
      const data = await res.json();
      if (data.success) {
        setBookmarks(prev => prev.map(b => selectedIds.has(b.id) ? { ...b, category_name: batchMoveCat } : b));
        setSelectedIds(new Set());
        setBatchMoveCat('');
        setSaveMsg({ type: 'success', text: `已移动 ${data.moved} 条到「${batchMoveCat}」` });
        setTimeout(() => setSaveMsg(null), 3000);
      }
    } catch (err: any) {
      setSaveMsg({ type: 'error', text: err.message || '批量移动失败' });
    } finally { setBatchLoading(false); }
  };

  // ── Toggle select
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectAllInView = () => {
    const allIds = new Set(bookmarks.map(b => b.id));
    if (selectedIds.size === allIds.size) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(allIds);
    }
  };

  // ── Category DND reorder
  const handleCategoryDragEnd = useCallback(async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = categories.findIndex(c => `cat-${c.id}` === active.id);
    const newIndex = categories.findIndex(c => `cat-${c.id}` === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = [...categories];
    const [moved] = reordered.splice(oldIndex, 1);
    reordered.splice(newIndex, 0, moved);

    setCategories(reordered);

    // Persist to server
    try {
      await fetch('/api/categories/reorder', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: reordered.map(c => c.id) }),
      });
    } catch { /* silent rollback not needed — next load fixes */ }
  }, [categories]);

  // ── Exit edit mode
  const exitEditMode = () => {
    setEditMode(false);
    setSelectedIds(new Set());
    setBatchMoveCat('');
  };

  const totalCount = categories.reduce((s, c) => s + Number(c.bookmark_count || 0), 0);
  const visibleCount = grouped.reduce((s, g) => s + g.items.length, 0);

  // Breadcrumb text
  const breadText = useMemo(() => {
    if (search) return ['🔍', `搜索: "${search}"`];
    if (activeSection) {
      const meta = extractEmoji(activeSection);
      return [meta.emoji, activeSection];
    }
    return ['🏠', '全部工具'];
  }, [activeSection, search]);

  return (
    <div style={styles.page}>
      {/* Mobile overlay */}
      {isMobile && sidebarOpen && (
        <div style={styles.overlay} onClick={() => setSidebarOpen(false)} />
      )}

      {/* ═══════ LEFT SIDEBAR ═══════ */}
      <aside className={`tools-aside ${isMobile && !sidebarOpen ? 'tools-aside-hidden' : ''}`} style={styles.sidebar as React.CSSProperties}>
        <div style={styles.sideHead}>
          <Link href="/" style={styles.logo}>
            <span style={{ fontSize: 20 }}>⚡</span>
            <span style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e' }}>AI工具集</span>
          </Link>
          <button onClick={() => setSidebarOpen(false)} className="tools-close-btn" style={styles.closeBtn}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

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

        {/* Category nav with DND */}
        <nav style={styles.nav}>
          <div style={styles.navLabel}>分类导航 (拖拽排序)</div>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleCategoryDragEnd}>
            <SortableContext items={categories.map(c => `cat-${c.id}`)} strategy={verticalListSortingStrategy}>
              {categories.map(cat => (
                <SortableCategory
                  key={cat.id}
                  cat={cat}
                  isActive={activeSection === cat.name}
                  onScrollTo={scrollTo}
                />
              ))}
            </SortableContext>
          </DndContext>
        </nav>

        <div style={styles.sideFoot}>
          <Link href="/" style={styles.footLink}>🏠 首页</Link>
          <Link href="/dashboard" style={styles.footLink}>⭐ 常用</Link>
          <Link href="/admin" style={styles.footLink}>⚙️ 后台</Link>
        </div>
      </aside>

      {/* ═══════ RIGHT MAIN ═══════ */}
      <main className="tools-main" style={styles.main as React.CSSProperties} ref={mainRef}>
        {/* === BREADCRUMB === */}
        <div style={styles.breadcrumb}>
          <Link href="/" style={styles.breadLink}>🏠 首页</Link>
          <span style={styles.breadSep}>/</span>
          <span style={styles.breadCurrent}>{breadText[0]} {breadText[1]}</span>
        </div>

        {/* Top bar */}
        <div className="tools-topbar" style={styles.topBar}>
          <div style={styles.topLeft}>
            <button onClick={() => setSidebarOpen(true)} className="tools-burger" style={styles.burger}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 12h18M3 6h18M3 18h18" />
              </svg>
            </button>
            <h1 style={styles.pageTitle}>AI工具导航</h1>
            <span style={styles.countBadge}>
              {loading ? '加载中...' : `共 ${visibleCount} 个`}
            </span>

            <button onClick={handleSave} disabled={saving || loading} style={{ ...styles.saveBtn, ...(saving ? styles.saveBtnDisabled : {}) }} title="将当前书签状态同步到数据库">
              {saving ? <span style={styles.saveSpinner} /> : <span>💾</span>}
              <span>{saving ? '保存中...' : '保存修改'}</span>
            </button>

            {/* Edit mode toggle */}
            <button
              onClick={() => editMode ? exitEditMode() : setEditMode(true)}
              style={{
                ...styles.editToggleBtn,
                ...(editMode ? styles.editToggleBtnActive : {}),
              }}
            >
              {editMode ? '✅ 退出编辑' : '✏️ 批量管理'}
            </button>

            {saveMsg && (
              <span style={{ ...styles.saveFeedback, ...(saveMsg.type === 'error' ? styles.saveFeedbackError : {}) }}>
                {saveMsg.type === 'success' ? '✅ ' : '❌ '}{saveMsg.text}
              </span>
            )}
          </div>

          <div className="tools-search" style={styles.searchBox}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" style={{ flexShrink: 0 }}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索工具名、域名、描述、标签..." style={styles.searchInput} />
            {search && <button onClick={() => setSearch('')} style={styles.searchClear}>✕</button>}
          </div>
        </div>

        {/* Batch action bar */}
        {editMode && (
          <div style={styles.batchBar}>
            <button onClick={selectAllInView} style={styles.batchBtn}>
              {selectedIds.size === bookmarks.length ? '☐ 取消全选' : '☑ 全选'}
            </button>
            <span style={styles.batchInfo}>已选 {selectedIds.size} 项</span>

            <select
              value={batchMoveCat}
              onChange={e => setBatchMoveCat(e.target.value)}
              style={styles.batchSelect}
            >
              <option value="">移到分类...</option>
              {categories.map(c => (
                <option key={c.id} value={c.name}>{c.name}</option>
              ))}
            </select>
            <button
              onClick={batchMove}
              disabled={selectedIds.size === 0 || !batchMoveCat || batchLoading}
              style={{ ...styles.batchBtn, ...styles.batchBtnPrimary }}
            >
              📁 移动
            </button>
            <button
              onClick={batchDelete}
              disabled={selectedIds.size === 0 || batchLoading}
              style={{ ...styles.batchBtn, color: '#ef4444', borderColor: '#fecaca' }}
            >
              {batchLoading ? '处理中...' : '🗑️ 删除'}
            </button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="tools-grid" style={styles.grid}><CardSkeleton /></div>
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
                <section key={slug} id={slug} data-cat-section={group.catName} style={styles.section}>
                  <div style={styles.sectionHead}>
                    <div style={{ ...styles.sectionHeadIcon, background: meta.bg, color: meta.color }}>{meta.emoji}</div>
                    <h2 style={styles.sectionTitle}>{group.catName}</h2>
                    <span style={styles.sectionCount}>{group.items.length} 个</span>
                  </div>

                  {group.items.length === 0 ? (
                    <div style={{ padding: '12px 0', color: '#bbb', fontSize: 13, fontStyle: 'italic' }}>该分类没有匹配的工具</div>
                  ) : (
                    <div className="tools-grid" style={styles.grid}>
                      {group.items.map(b => (
                        <ToolCard
                          key={b.id}
                          bookmark={b}
                          onDelete={handleDelete}
                          onPin={handlePin}
                          editMode={editMode}
                          selected={selectedIds.has(b.id)}
                          onToggleSelect={toggleSelect}
                        />
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </>
        )}

        {/* === FOOTER SITEMAP === */}
        {!loading && grouped.length > 0 && (
          <Footer categories={categories} bookmarks={bookmarks} />
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
        .tc-card-selected { border-color: #818cf8 !important; box-shadow: 0 0 0 2px rgba(129,140,248,0.2) !important; }
        .tc-tag { font-size: 11px; padding: 2px 7px; border-radius: 4px; font-weight: 500; white-space: nowrap; }
        .tc-btn:hover { transform: scale(1.1); }
        .tc-btn-pin:hover { background: #eef2ff; border-color: #5b5ce2; color: #5b5ce2; box-shadow: 0 2px 8px rgba(91,92,226,0.2); }
        .tc-btn-del:hover { background: #fef2f2; border-color: #ef4444; color: #ef4444; box-shadow: 0 2px 8px rgba(239,68,68,0.2); }

        @media (max-width: 900px) {
          .tools-aside { position: fixed; left: 0; top: 0; height: 100dvh; z-index: 100; transition: transform .3s ease; }
          .tools-aside-hidden { transform: translateX(-100%); }
          .tools-close-btn { display: flex; }
          .tools-burger { display: flex; }
          .tools-main { padding: 14px 14px 40px; }
          .tools-topbar { flex-direction: column; align-items: stretch; gap: 10px; }
          .tools-search { max-width: 100%; min-width: 0; }
          .tools-grid { gap: 8px; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); }
        }
        @media (min-width: 1400px) {
          .tools-grid { gap: 14px; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); }
        }
      `}</style>
    </div>
  );
}

// ── Tool Card ──
function ToolCard({
  bookmark: b, onDelete, onPin, editMode, selected, onToggleSelect,
}: {
  bookmark: Bookmark; onDelete: (id: number) => void; onPin: (id: number) => void;
  editMode: boolean; selected: boolean; onToggleSelect: (id: number) => void;
}) {
  const tags = parseTags(b.tags);
  const [hovered, setHovered] = useState(false);

  const handleDelete = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onDelete(b.id); };
  const handlePin = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onPin(b.id); };
  const handleCheck = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); onToggleSelect(b.id); };

  // Category emoji for gradient hint
  const catMeta = extractEmoji(b.category_name || '其他');

  return (
    <div
      className={`tc-card relative ${selected ? 'tc-card-selected' : ''}`}
      style={{
        ...styles.card,
        background: `linear-gradient(135deg, #ffffff 0%, ${catMeta.gradient.split(',')[3]?.trim() || '#f8fafc'} 100%)`,
      } as React.CSSProperties}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Edit mode checkbox — top-left */}
      {editMode && (
        <div style={{ position: 'absolute', top: 8, left: 8, zIndex: 55 }}>
          <input
            type="checkbox"
            checked={selected}
            onClick={handleCheck}
            style={{ width: 18, height: 18, cursor: 'pointer', accentColor: '#5b5ce2' }}
          />
        </div>
      )}

      {/* Management buttons — top-right, hover */}
      <div
        className="tc-actions"
        style={{
          position: 'absolute', top: 8, right: 8, zIndex: 50,
          display: hovered && !editMode ? 'flex' : 'none',
          gap: 3, alignItems: 'center',
          background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)',
          padding: 4, borderRadius: 7,
          boxShadow: '0 1px 6px rgba(0,0,0,0.06)',
        }}
      >
        <button onClick={handlePin} className="tc-btn tc-btn-pin" style={styles.actionBtn as React.CSSProperties} title="置顶">📌</button>
        <button onClick={handleDelete} className="tc-btn tc-btn-del" style={styles.actionBtn as React.CSSProperties} title="删除">🗑️</button>
      </div>

      {/* Content */}
      <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 0 }}>
        <a href={b.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}>
          <div style={{ ...styles.cardTitle, paddingLeft: editMode ? 24 : 0 }}>
            {b.title}
            {b.is_featured && <span style={{ color: '#f59e0b', fontSize: 10, marginLeft: 2 }}>⭐</span>}
          </div>
          <div style={{ ...styles.cardDomain, paddingLeft: editMode ? 24 : 0 }}>{b.domain}</div>
        </a>
        {(b.description || b.summary) && (
          <div style={styles.cardDesc}>{b.description || b.summary}</div>
        )}
      </div>

      {tags.length > 0 && (
        <div style={styles.tagsRow}>
          {tags.slice(0, 3).map((t, i) => (
            <span key={i} className="tc-tag" style={{ background: tagBg(i), color: tagColor(i) }}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Footer Sitemap ──
function Footer({ categories, bookmarks }: { categories: Category[]; bookmarks: Bookmark[] }) {
  // Pick top 3 bookmarks per category
  const catGroups = useMemo(() => {
    return categories.slice(0, 8).map(c => {
      const items = bookmarks
        .filter(b => b.category_name === c.name)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
        .slice(0, 5);
      return { ...c, items };
    }).filter(g => g.items.length > 0);
  }, [categories, bookmarks]);

  if (catGroups.length === 0) return null;

  return (
    <footer style={styles.footer}>
      <div style={styles.footerTitle}>📋 站点导航</div>
      <div style={styles.footerGrid}>
        {catGroups.map(g => {
          const meta = extractEmoji(g.name);
          return (
            <div key={g.id} style={styles.footerCol}>
              <div style={styles.footerCat}>
                <span>{meta.emoji}</span>
                <span>{g.name}</span>
              </div>
              <div style={styles.footerLinks}>
                {g.items.map(b => (
                  <a key={b.id} href={b.url} target="_blank" rel="noopener noreferrer" style={styles.footerLink} title={b.title}>
                    {b.title.length > 18 ? b.title.slice(0, 18) + '...' : b.title}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <div style={styles.footerBottom}>
        <span>⚡ AI工具集 — SaaS 资源导航</span>
        <Link href="/admin" style={styles.footerAdminLink}>管理后台</Link>
      </div>
    </footer>
  );
}

// ── Tag color helpers ──
const tagColors = [
  ['#4f46e5', '#eef2ff'], ['#059669', '#ecfdf5'], ['#ea580c', '#fff7ed'], ['#db2777', '#fce7f3'],
  ['#0891b2', '#ecfeff'], ['#9333ea', '#faf5ff'], ['#dc2626', '#fef2f2'], ['#ca8a04', '#fefce8'],
];
function tagBg(i: number) { return tagColors[i % tagColors.length][1]; }
function tagColor(i: number) { return tagColors[i % tagColors.length][0]; }

// ═══════════════════════════════════════════════════════════
//  STYLES
// ═══════════════════════════════════════════════════════════
const sidebarWidth = 240;

const styles: Record<string, React.CSSProperties> = {
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
    cursor: 'grab', fontFamily: 'inherit', textAlign: 'left' as const,
    transition: 'all .12s ease',
    touchAction: 'none' as const,
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

  main: { flex: 1, minWidth: 0, height: '100%', overflowY: 'auto', padding: '24px 28px 60px' },

  // Breadcrumb
  breadcrumb: {
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 16, fontSize: 12, color: '#999',
  },
  breadLink: { color: '#5b5ce2', textDecoration: 'none', fontWeight: 500 },
  breadSep: { color: '#ccc' },
  breadCurrent: { color: '#555', fontWeight: 600 },

  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    flexWrap: 'wrap' as const, gap: 12, marginBottom: 24,
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const },
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
    transition: 'all .15s ease', whiteSpace: 'nowrap' as const,
  },
  saveBtnDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  saveSpinner: {
    width: 14, height: 14, borderRadius: '50%',
    border: '2px solid #d0cdee', borderTopColor: '#5b5ce2',
    animation: 'spin 0.6s linear infinite', display: 'inline-block',
  },
  saveFeedback: {
    fontSize: 12, fontWeight: 500, color: '#059669',
    padding: '4px 10px', borderRadius: 6, background: '#ecfdf5',
    whiteSpace: 'nowrap' as const,
  },
  saveFeedbackError: { color: '#dc2626', background: '#fef2f2' },
  editToggleBtn: {
    display: 'flex', alignItems: 'center', gap: 5,
    fontSize: 12, fontWeight: 600, color: '#64748b',
    padding: '6px 14px', borderRadius: 8,
    border: '1px solid #e2e8f0',
    background: '#fff',
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'all .15s ease', whiteSpace: 'nowrap' as const,
  },
  editToggleBtnActive: {
    color: '#5b5ce2', borderColor: '#c7d2fe', background: '#f5f3ff',
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

  // Batch bar
  batchBar: {
    display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const,
    padding: '10px 14px', borderRadius: 10,
    background: '#f8f6ff', border: '1px solid #e0ddff',
    marginBottom: 18,
  },
  batchBtn: {
    fontSize: 12, fontWeight: 500, color: '#555',
    padding: '6px 12px', borderRadius: 7,
    border: '1px solid #e2e8f0', background: '#fff',
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' as const,
  },
  batchBtnPrimary: { color: '#5b5ce2', borderColor: '#c7d2fe' },
  batchInfo: {
    fontSize: 12, fontWeight: 600, color: '#5b5ce2',
    padding: '2px 0', minWidth: 60,
  },
  batchSelect: {
    fontSize: 12, fontWeight: 500, color: '#333',
    padding: '6px 10px', borderRadius: 7,
    border: '1px solid #e2e8f0', background: '#fff',
    cursor: 'pointer', fontFamily: 'inherit', outline: 'none',
  },

  section: { marginBottom: 36 },
  sectionHead: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, padding: '0 2px' },
  sectionHeadIcon: {
    width: 32, height: 32, borderRadius: 8,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 16, flexShrink: 0,
  },
  sectionTitle: { fontSize: 17, fontWeight: 700, color: '#1a1a2e', margin: 0 },
  sectionCount: { fontSize: 12, color: '#bbb', fontWeight: 500 },

  grid: {
    display: 'grid', gap: 10, width: '100%',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
  },

  card: {
    display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
    padding: '12px', borderRadius: 10, height: '100%',
    border: '1px solid rgba(0,0,0,0.04)',
    boxShadow: '0 1px 8px rgba(0,0,0,0.02), 0 0 0 0 rgba(102,126,234,0.02)',
    textDecoration: 'none', color: 'inherit',
    cursor: 'default', position: 'relative',
    transition: 'all .22s ease',
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
  cardDesc: {
    fontSize: 11, color: '#888', fontWeight: 400,
    lineHeight: 1.5, width: '100%',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
    overflow: 'hidden',
    marginTop: 8,
    minHeight: 33,
  } as React.CSSProperties,

  tagsRow: {
    width: '100%', marginTop: 'auto',
    display: 'flex', flexWrap: 'wrap' as const, gap: 3, paddingTop: 6,
  },

  empty: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', padding: '80px 20px', textAlign: 'center' as const,
  },

  // Footer
  footer: {
    marginTop: 50, paddingTop: 32, borderTop: '1px solid #eee',
  },
  footerTitle: {
    fontSize: 14, fontWeight: 700, color: '#1a1a2e', marginBottom: 20,
  },
  footerGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: 24,
  },
  footerCol: {
    display: 'flex', flexDirection: 'column', gap: 6,
  },
  footerCat: {
    fontSize: 13, fontWeight: 700, color: '#333',
    display: 'flex', alignItems: 'center', gap: 6,
    marginBottom: 4,
  },
  footerLinks: {
    display: 'flex', flexDirection: 'column', gap: 3,
  },
  footerLink: {
    fontSize: 11.5, color: '#777', textDecoration: 'none',
    padding: '2px 0', transition: 'color .12s',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const,
  },
  footerBottom: {
    marginTop: 28, paddingTop: 14, borderTop: '1px solid #f0f0f0',
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    fontSize: 11, color: '#bbb',
  },
  footerAdminLink: {
    fontSize: 11, color: '#999', textDecoration: 'none',
  },
};

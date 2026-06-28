'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

interface Bookmark {
  id: number;
  url: string;
  title: string;
  domain: string;
  category_name: string;
  category_icon: string;
  summary: string;
  is_featured: boolean;
  sort_order: number;
}

interface Category {
  id: number;
  name: string;
  icon: string;
}

interface CategoryGroup {
  name: string;
  icon: string;
  bookmarks: Bookmark[];
}

const categoryGradients: Record<string, string> = {
  '开发工具': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  'AI工具': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
  '设计资源': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
  '效率工具': 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
  '学习资源': 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
  '技术博客': 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)',
  '数据科学': 'linear-gradient(135deg, #fccb90 0%, #d57eeb 100%)',
  '产品经理': 'linear-gradient(135deg, #e0c3fc 0%, #8ec5fc 100%)',
  '视频创作': 'linear-gradient(135deg, #f9d423 0%, #ff4e50 100%)',
  '写作工具': 'linear-gradient(135deg, #89f7fe 0%, #66a6ff 100%)',
  '资讯阅读': 'linear-gradient(135deg, #fddb92 0%, #d1fdff 100%)',
  '云服务': 'linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%)',
  '网络安全': 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)',
  'API服务': 'linear-gradient(135deg, #9890e3 0%, #b1f4cf 100%)',
  '其他': 'linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%)',
};

function getGradient(category: string): string {
  return categoryGradients[category] || `linear-gradient(135deg, hsl(${hashCode(category) % 360}, 60%, 65%), hsl(${(hashCode(category) + 40) % 360}, 60%, 50%))`;
}

function hashCode(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = ((h << 5) - h) + s.charCodeAt(i); h |= 0; }
  return Math.abs(h);
}

export default function Dashboard() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Add form
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [addSummary, setAddSummary] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [showNewCat, setShowNewCat] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingSummary, setEditingSummary] = useState(false);  // add form: toggle summary edit
  const [aiFailed, setAiFailed] = useState(false);             // AI summary failed, show fallback
  const [editingCard, setEditingCard] = useState<{ id: number; summary: string } | null>(null); // inline card edit
  const urlInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/bookmarks?featured=true')
      .then(r => r.json())
      .then(data => {
        const bookmarks: Bookmark[] = data.bookmarks || [];
        const map = new Map<string, CategoryGroup>();
        for (const b of bookmarks) {
          const cat = b.category_name || '其他';
          if (!map.has(cat)) {
            map.set(cat, { name: cat, icon: b.category_icon || '', bookmarks: [] });
          }
          map.get(cat)!.bookmarks.push(b);
        }
        setGroups(Array.from(map.values()));
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const loadCategories = useCallback(() => {
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadData();
    loadCategories();
  }, []);

  // Auto-fetch title + AI summary when URL is pasted
  const handleUrlChange = async (val: string) => {
    setAddUrl(val);
    setFetchError('');
    setAddTitle('');
    setAddSummary('');
    setAiFailed(false);
    if (!val || !val.startsWith('http')) return;

    setFetching(true);
    setAiThinking(false);

    try {
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.title && !data.error) {
        setAddTitle(data.title);
        // Trigger AI summary in parallel — with timeout
        setAiThinking(true);
        const aiController = new AbortController();
        const aiTimeout = setTimeout(() => aiController.abort(), 10000);
        fetch('/api/ai/summary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: val, title: data.title }),
          signal: aiController.signal,
        })
          .then(r => r.json())
          .then(d => {
            clearTimeout(aiTimeout);
            if (d.summary) {
              setAddSummary(d.summary);
            } else {
              setAiFailed(true);
            }
            setAiThinking(false);
          })
          .catch(() => {
            clearTimeout(aiTimeout);
            setAiFailed(true);
            setAiThinking(false);
          });
      } else {
        setFetchError(data.error || '抓取失败');
      }
    } catch {
      setFetchError('网络错误');
    } finally {
      setFetching(false);
    }
  };

  // Create new category
  const handleCreateCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCatName.trim() }),
      });
      const data = await res.json();
      if (data.category) {
        setAddCategory(data.category.name);
        loadCategories();
      }
      setNewCatName('');
      setShowNewCat(false);
    } catch { /* ignore */ }
  };

  // Submit
  const handleAdd = async () => {
    if (!addUrl || !addTitle) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: addUrl,
          title: addTitle,
          category_name: addCategory || null,
          is_featured: true,
          summary: addSummary || undefined,
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        resetForm();
        loadData();
      }
    } catch { /* ignore */ }
    finally { setSubmitting(false); }
  };

  // Save card summary (inline edit on existing cards)
  const handleSaveCardSummary = async () => {
    if (!editingCard) return;
    try {
      await fetch(`/api/bookmarks/${editingCard.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ summary: editingCard.summary }),
      });
      loadData();
      setEditingCard(null);
    } catch { /* ignore */ }
  };

  const resetForm = () => {
    setAddUrl(''); setAddTitle(''); setAddCategory('');
    setAddSummary(''); setNewCatName(''); setShowNewCat(false);
    setFetchError(''); setAiThinking(false); setFetching(false);
    setEditingSummary(false); setAiFailed(false);
  };

  // Focus on open
  useEffect(() => {
    if (showAdd) urlInputRef.current?.focus();
  }, [showAdd]);

  const filtered = activeTab === 'all'
    ? groups.flatMap(g => g.bookmarks)
    : groups.find(g => g.name === activeTab)?.bookmarks || [];

  const allTabs = groups.map(g => g.name);

  if (loading) {
    return (
      <div style={styles.container}>
        <Skeleton />
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <style>{`
        .db-card:hover .db-card-edit { opacity: 1 !important; }
        .db-card:hover { box-shadow: 0 4px 24px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04) !important; transform: translateY(-2px) !important; }
        .db-card { transition: transform 0.2s ease, box-shadow 0.2s ease; }
      `}</style>
      {/* Top bar */}
      <div style={styles.topBar}>
        <Link href="/" style={styles.backLink}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
          <span>首页</span>
        </Link>
        <div style={styles.topCenter}>
          <div style={styles.topTitle}>常用</div>
          <button
            onClick={() => { setShowAdd(!showAdd); if (showAdd) resetForm(); }}
            style={{
              ...styles.addBtn,
              background: showAdd ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.04)',
              color: '#333',
            }}
            title="手动添加"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
        <Link href="/admin" style={styles.adminLink}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </Link>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={styles.addPanel}>
          {/* URL input */}
          <div style={styles.addRow}>
            <input
              ref={urlInputRef}
              type="url"
              placeholder="粘贴网址 https://..."
              value={addUrl}
              onChange={e => handleUrlChange(e.target.value)}
              style={styles.addInput}
              autoFocus
            />
            {fetching && <Spinner />}
          </div>

          {/* Title + Category + AI summary */}
          {(addTitle || fetchError) && !fetching && (
            <>
              {fetchError && !addTitle && (
                <div style={styles.fetchError}>⚠ {fetchError}，请手动输入标题</div>
              )}

              <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
                <input
                  type="text"
                  placeholder="书签标题"
                  value={addTitle}
                  onChange={e => setAddTitle(e.target.value)}
                  style={{ ...styles.addInput, flex: 2 }}
                />

                {/* Category selector */}
                {!showNewCat ? (
                  <select
                    value={addCategory}
                    onChange={e => {
                      if (e.target.value === '__new__') {
                        setShowNewCat(true);
                      } else {
                        setAddCategory(e.target.value);
                      }
                    }}
                    style={{ ...styles.addInput, flex: 1, cursor: 'pointer', appearance: 'none' }}
                  >
                    <option value="">分类（可选）</option>
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                    <option value="__new__" style={{ color: '#667eea' }}>+ 新建分类</option>
                  </select>
                ) : (
                  <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                    <input
                      type="text"
                      placeholder="新分类名称"
                      value={newCatName}
                      onChange={e => setNewCatName(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleCreateCategory()}
                      style={{ ...styles.addInput, flex: 1 }}
                      autoFocus
                    />
                    <button onClick={handleCreateCategory} style={styles.smallAddBtn}>
                      创建
                    </button>
                    <button onClick={() => { setShowNewCat(false); setNewCatName(''); }} style={styles.smallCancelBtn}>
                      ✕
                    </button>
                  </div>
                )}
              </div>

              {/* AI Summary preview */}
              {(aiThinking || addSummary || aiFailed) && (
                <div style={styles.aiRow}>
                  <span style={styles.aiLabel}>🤖 AI 描述</span>
                  {aiThinking ? (
                    <span style={styles.aiThinking}>生成中...</span>
                  ) : aiFailed ? (
                    <span style={styles.aiFailed}>生成失败</span>
                  ) : editingSummary ? (
                    <input
                      type="text"
                      value={addSummary}
                      onChange={e => setAddSummary(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && setEditingSummary(false)}
                      onBlur={() => setEditingSummary(false)}
                      style={styles.summaryEditInput}
                      autoFocus
                    />
                  ) : (
                    <>
                      <span style={styles.aiSummary}>{addSummary}</span>
                      <button
                        onClick={(e) => { e.preventDefault(); setEditingSummary(true); }}
                        style={styles.editIcon}
                        title="修改描述"
                      >✎</button>
                    </>
                  )}
                </div>
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
                <button
                  onClick={handleAdd}
                  disabled={!addUrl || !addTitle || submitting}
                  style={{
                    ...styles.submitBtn,
                    opacity: (!addUrl || !addTitle) ? 0.4 : 1,
                  }}
                >
                  {submitting ? '添加中...' : (addSummary ? '✨ 一键添加' : '添加到常用')}
                </button>
                <button onClick={() => { setShowAdd(false); resetForm(); }} style={styles.cancelBtn}>取消</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state or main content */}
      {groups.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <>
          <div style={styles.tabBar}>
            {allTabs.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                style={{ ...styles.tab, ...(activeTab === cat ? styles.tabActive : {}) }}
              >
                {cat}
              </button>
            ))}
          </div>

          <div style={styles.grid}>
            {filtered.map((b, i) => (
              <div key={b.id} className="db-card" style={{ ...styles.card, animationDelay: `${i * 0.03}s`, position: 'relative' }}>
                <a
                  href={b.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ display: 'flex', alignItems: 'center', gap: 16, flex: 1, minWidth: 0, textDecoration: 'none', color: 'inherit' }}
                >
                  <div style={{ ...styles.cardIcon, background: getGradient(b.category_name) }}>
                    <span style={styles.cardIconText}>{getFavicon(b.title, b.domain)}</span>
                  </div>
                  <div style={styles.cardBody}>
                    <div style={styles.cardTitle}>{b.title}</div>
                    {editingCard?.id === b.id ? (
                      <input
                        type="text"
                        value={editingCard.summary}
                        onChange={e => setEditingCard({ id: b.id, summary: e.target.value })}
                        onKeyDown={e => { if (e.key === 'Enter') handleSaveCardSummary(); if (e.key === 'Escape') setEditingCard(null); }}
                        onBlur={handleSaveCardSummary}
                        style={styles.cardSummaryInput}
                        autoFocus
                        onClick={e => e.stopPropagation()}
                      />
                    ) : b.summary ? (
                      <div style={styles.cardSummary}>{b.summary}</div>
                    ) : (
                      <div style={styles.cardDomain}>{b.domain}</div>
                    )}
                  </div>
                </a>
                {/* Edit button — separate from link */}
                <button
                  className="db-card-edit"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (editingCard?.id === b.id) {
                      handleSaveCardSummary();
                    } else {
                      setEditingCard({ id: b.id, summary: b.summary || '' });
                    }
                  }}
                  style={styles.cardEditBtn}
                  title={editingCard?.id === b.id ? '保存' : '编辑描述'}
                >
                  {editingCard?.id === b.id ? '✓' : '✎'}
                </button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Sub-components ---

function Spinner() {
  return (
    <div style={{ marginLeft: -40, display: 'flex' }}>
      <div style={{
        width: 20, height: 20, borderRadius: '50%',
        border: '2px solid rgba(0,0,0,0.1)',
        borderTopColor: '#667eea',
        animation: 'spin 0.6s linear infinite',
      }} />
    </div>
  );
}

function Skeleton() {
  return (
    <>
      <div style={styles.skeletonTopBar} />
      <div style={styles.skeletonTabs}>
        {[1, 2, 3, 4].map(i => (<div key={i} style={styles.skeletonTab} />))}
      </div>
      <div style={styles.grid}>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} style={styles.skeletonCard}>
            <div style={styles.skeletonIcon} />
            <div style={{ flex: 1 }}>
              <div style={styles.skeletonLine} />
              <div style={{ ...styles.skeletonLine, width: '60%', height: 12 }} />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div style={styles.emptyWrap}>
      <div style={styles.emptyIcon}>⭐</div>
      <div style={styles.emptyTitle}>还没有常用书签</div>
      <div style={styles.emptyDesc}>点击上方 + ，粘贴网址即可添加，DeepSeek 自动生成描述</div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onAdd} style={styles.emptyBtn}>手动添加</button>
        <Link href="/admin" style={{ ...styles.emptyBtn, background: 'rgba(0,0,0,0.06)', color: '#333' }}>后台管理</Link>
      </div>
    </div>
  );
}

function getFavicon(title: string, domain: string): string {
  const first = title.charAt(0).toUpperCase();
  if (/^[A-Za-z]$/.test(first)) return first;
  const d = domain.split('.')[0];
  return d.charAt(0).toUpperCase() || '🔗';
}

// ============================================================
//  Apple 风格浅色渐变主题 — 高级感 + 高对比度文字
// ============================================================

const styles: Record<string, React.CSSProperties> = {
  // ── 页面背景：柔和渐变，暖粉 → 冷蓝 ──
  container: {
    minHeight: '100vh',
    background: `
      linear-gradient(170deg,
        #fef8f5 0%,
        #fdf2f8 15%,
        #f8f5fd 30%,
        #f4f7fd 50%,
        #eef6fc 70%,
        #f2f9fa 85%,
        #f6faf7 100%
      )
    `,
    padding: '24px 32px 60px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    color: '#1a1a2e',
  },

  // ── 顶部栏 ──
  topBar: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 24, padding: '0 4px',
  },
  backLink: {
    display: 'flex', alignItems: 'center', gap: 6,
    color: '#5a5a7a', textDecoration: 'none', fontSize: 14, fontWeight: 500,
  },
  topCenter: { display: 'flex', alignItems: 'center', gap: 12 },
  topTitle: { fontSize: 18, fontWeight: 700, color: '#1a1a2e', letterSpacing: '-0.01em' },
  addBtn: {
    width: 32, height: 32, borderRadius: 10,
    border: '1px solid rgba(0,0,0,0.1)', color: '#333',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    transition: 'all 0.25s ease',
  },
  adminLink: { color: '#7a7a9a', textDecoration: 'none', display: 'flex' },

  // ── 添加面板 ──
  addPanel: {
    marginBottom: 24, padding: '20px 24px', borderRadius: 20,
    background: 'rgba(255,255,255,0.75)', backdropFilter: 'blur(30px)',
    border: '1px solid rgba(0,0,0,0.06)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.03)',
    animation: 'fadeInUp 0.3s ease',
  },
  addRow: { display: 'flex', alignItems: 'center', gap: 10 },
  addInput: {
    padding: '12px 16px', borderRadius: 12,
    border: '1px solid rgba(0,0,0,0.1)', background: '#fff',
    color: '#1a1a2e', fontSize: 15, fontFamily: 'inherit',
    outline: 'none', minWidth: 0,
    boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
  },
  smallAddBtn: {
    padding: '8px 16px', borderRadius: 10,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
  },
  smallCancelBtn: {
    padding: '8px 10px', borderRadius: 10,
    background: 'rgba(0,0,0,0.04)', color: '#999',
    border: '1px solid rgba(0,0,0,0.08)', fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },
  fetchError: { marginTop: 10, fontSize: 13, color: '#c95a2a', fontWeight: 500 },

  // ── AI 描述行 ──
  aiRow: {
    marginTop: 10, padding: '10px 14px', borderRadius: 10,
    background: 'rgba(102,126,234,0.06)', border: '1px solid rgba(102,126,234,0.15)',
    display: 'flex', alignItems: 'center', gap: 8,
  },
  aiLabel: { fontSize: 12, color: '#888', flexShrink: 0, fontWeight: 500 },
  aiThinking: { fontSize: 13, color: '#667eea', fontStyle: 'italic' },
  aiSummary: { fontSize: 13, color: '#3a3a5a', flex: 1 },
  aiFailed: { fontSize: 13, color: '#c95a2a', fontWeight: 500 },
  editIcon: {
    background: 'none', border: 'none', color: '#999', cursor: 'pointer',
    fontSize: 15, padding: '2px 6px', borderRadius: 6,
    lineHeight: 1, flexShrink: 0, fontFamily: 'inherit',
  },
  summaryEditInput: {
    flex: 1, fontSize: 13, color: '#1a1a2e',
    border: '1px solid rgba(102,126,234,0.3)', borderRadius: 6,
    padding: '2px 8px', background: '#fff', outline: 'none', fontFamily: 'inherit',
  },

  submitBtn: {
    padding: '10px 24px', borderRadius: 12,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', border: 'none', fontSize: 15, fontWeight: 600,
    cursor: 'pointer', fontFamily: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  cancelBtn: {
    padding: '10px 20px', borderRadius: 12,
    background: 'rgba(0,0,0,0.04)', color: '#777',
    border: '1px solid rgba(0,0,0,0.08)', fontSize: 14,
    cursor: 'pointer', fontFamily: 'inherit',
  },

  // ── 横向导航标签 ──
  tabBar: {
    display: 'flex', gap: 10, overflowX: 'auto',
    paddingBottom: 8, marginBottom: 28,
    scrollbarWidth: 'none', msOverflowStyle: 'none',
  },
  tab: {
    padding: '10px 22px', borderRadius: 20,
    border: '1px solid rgba(0,0,0,0.08)', background: 'rgba(255,255,255,0.5)',
    color: '#555', fontSize: 15, fontWeight: 500, cursor: 'pointer',
    whiteSpace: 'nowrap', fontFamily: 'inherit',
    backdropFilter: 'blur(16px)',
    transition: 'all 0.2s ease',
  },
  tabActive: {
    background: '#fff', color: '#1a1a2e',
    borderColor: 'rgba(0,0,0,0.12)', fontWeight: 600,
    boxShadow: '0 4px 20px rgba(100, 120, 255, 0.12), 0 2px 6px rgba(0,0,0,0.04)',
  },

  // ── 卡片网格 ──
  grid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 14,
  },

  // ── 书签卡片 ──
  card: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '18px 22px', borderRadius: 20,
    background: 'rgba(255,255,255,0.7)', backdropFilter: 'blur(24px)',
    border: '1px solid rgba(0,0,0,0.05)',
    boxShadow: '0 2px 16px rgba(0,0,0,0.03), 0 1px 4px rgba(0,0,0,0.02)',
    textDecoration: 'none', color: 'inherit',
    cursor: 'pointer', animation: 'fadeInUp 0.4s ease both',
    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  },
  cardIcon: {
    width: 50, height: 50, borderRadius: 14,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
  },
  cardIconText: { fontSize: 21, fontWeight: 700, color: '#fff', lineHeight: 1 },
  cardBody: { flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 },
  cardTitle: {
    fontSize: 16, fontWeight: 600, color: '#1a1a2e',
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    letterSpacing: '-0.01em',
  },
  cardSummary: {
    fontSize: 12.5, color: '#6a6a8a', fontWeight: 400,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  },
  cardDomain: { fontSize: 12, color: '#999' },
  cardEditBtn: {
    position: 'absolute', top: 10, right: 10,
    width: 26, height: 26, borderRadius: 8,
    border: 'none', background: 'rgba(0,0,0,0.04)',
    color: '#999', fontSize: 14, cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'inherit', flexShrink: 0,
    opacity: 0, transition: 'opacity 0.2s',
  },
  cardSummaryInput: {
    fontSize: 12.5, color: '#1a1a2e', width: '100%',
    border: '1px solid rgba(102,126,234,0.3)', borderRadius: 6,
    padding: '3px 8px', background: '#fff', outline: 'none', fontFamily: 'inherit',
  },

  // ── 骨架屏 ──
  skeletonTopBar: {
    height: 36, borderRadius: 10, background: 'rgba(0,0,0,0.04)',
    marginBottom: 32, animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonTabs: { display: 'flex', gap: 10, marginBottom: 28 },
  skeletonTab: {
    width: 80, height: 36, borderRadius: 20,
    background: 'rgba(0,0,0,0.04)', animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonCard: {
    display: 'flex', alignItems: 'center', gap: 16,
    padding: '18px 22px', borderRadius: 20,
    background: 'rgba(255,255,255,0.5)',
  },
  skeletonIcon: {
    width: 50, height: 50, borderRadius: 14,
    background: 'rgba(0,0,0,0.05)', animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonLine: {
    height: 14, width: '90%', borderRadius: 6,
    background: 'rgba(0,0,0,0.04)', marginBottom: 8,
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  // ── 空状态 ──
  emptyWrap: {
    display: 'flex', flexDirection: 'column', alignItems: 'center',
    justifyContent: 'center', minHeight: '70vh', textAlign: 'center',
  },
  emptyIcon: { fontSize: 64, marginBottom: 24 },
  emptyTitle: { fontSize: 24, fontWeight: 700, color: '#1a1a2e', marginBottom: 10 },
  emptyDesc: { fontSize: 15, color: '#777', marginBottom: 32, maxWidth: 380 },
  emptyBtn: {
    padding: '12px 32px', borderRadius: 12,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 600,
    border: 'none', cursor: 'pointer', fontFamily: 'inherit',
    boxShadow: '0 4px 16px rgba(102,126,234,0.25)',
  },
};

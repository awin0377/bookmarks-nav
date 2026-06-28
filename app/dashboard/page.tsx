'use client';

import { useState, useEffect, useRef } from 'react';
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
  return categoryGradients[category] || 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
}

export default function Dashboard() {
  const [groups, setGroups] = useState<CategoryGroup[]>([]);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  // Add form state
  const [showAdd, setShowAdd] = useState(false);
  const [addUrl, setAddUrl] = useState('');
  const [addTitle, setAddTitle] = useState('');
  const [addCategory, setAddCategory] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [fetching, setFetching] = useState(false);
  const [fetchError, setFetchError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const urlInputRef = useRef<HTMLInputElement>(null);

  const loadData = () => {
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
        if (map.size > 0 && activeTab === 'all') {
          setActiveTab(map.keys().next().value || 'all');
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    // Load categories for the add form
    fetch('/api/categories')
      .then(r => r.json())
      .then(data => setCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // Auto-fetch title when URL is pasted
  const handleUrlChange = async (val: string) => {
    setAddUrl(val);
    setFetchError('');
    if (!val || !val.startsWith('http')) return;

    setFetching(true);
    try {
      const res = await fetch(`/api/fetch-title?url=${encodeURIComponent(val)}`);
      const data = await res.json();
      if (data.title && !data.error) {
        setAddTitle(data.title);
      } else {
        setFetchError(data.error || '抓取失败');
      }
    } catch {
      setFetchError('网络错误');
    } finally {
      setFetching(false);
    }
  };

  // Submit new bookmark
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
        }),
      });
      if (res.ok) {
        setShowAdd(false);
        setAddUrl('');
        setAddTitle('');
        setAddCategory('');
        setFetchError('');
        setLoading(true);
        loadData();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  // Handle paste event
  useEffect(() => {
    if (!showAdd) return;
    urlInputRef.current?.focus();
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
      {/* Top bar */}
      <div style={styles.topBar}>
        <Link href="/" style={styles.backLink}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5m7-7l-7 7 7 7"/></svg>
          <span>首页</span>
        </Link>
        <div style={styles.topCenter}>
          <div style={styles.topTitle}>常用</div>
          <button
            onClick={() => setShowAdd(!showAdd)}
            style={{
              ...styles.addBtn,
              background: showAdd ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)',
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

      {/* Add form (slide-down) */}
      {showAdd && (
        <div style={styles.addPanel}>
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
            {fetching && (
              <div style={styles.fetchSpinner}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.2)',
                  borderTopColor: '#667eea',
                  animation: 'spin 0.6s linear infinite',
                }} />
              </div>
            )}
          </div>

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
                <select
                  value={addCategory}
                  onChange={e => setAddCategory(e.target.value)}
                  style={{ ...styles.addInput, flex: 1, cursor: 'pointer' }}
                >
                  <option value="">分类（可选）</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.name}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button
                  onClick={handleAdd}
                  disabled={!addUrl || !addTitle || submitting}
                  style={{
                    ...styles.submitBtn,
                    opacity: (!addUrl || !addTitle) ? 0.4 : 1,
                  }}
                >
                  {submitting ? '添加中...' : '添加到常用'}
                </button>
                <button
                  onClick={() => { setShowAdd(false); setAddUrl(''); setAddTitle(''); setFetchError(''); }}
                  style={styles.cancelBtn}
                >
                  取消
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Empty state */}
      {groups.length === 0 ? (
        <EmptyState onAdd={() => setShowAdd(true)} />
      ) : (
        <>
          {/* Horizontal tab bar */}
          <div style={styles.tabBar}>
            {allTabs.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                style={{
                  ...styles.tab,
                  ...(activeTab === cat ? styles.tabActive : {}),
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Bookmark cards grid */}
          <div style={styles.grid}>
            {filtered.map((b, i) => (
              <a
                key={b.id}
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...styles.card,
                  animationDelay: `${i * 0.03}s`,
                }}
              >
                <div style={{
                  ...styles.cardIcon,
                  background: getGradient(b.category_name),
                }}>
                  <span style={styles.cardIconText}>
                    {getFavicon(b.title, b.domain)}
                  </span>
                </div>
                <div style={styles.cardBody}>
                  <div style={styles.cardTitle}>{b.title}</div>
                  <div style={styles.cardDomain}>{b.domain}</div>
                </div>
              </a>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// --- Sub-components ---

function Skeleton() {
  return (
    <>
      <div style={styles.skeletonTopBar} />
      <div style={styles.skeletonTabs}>
        {[1, 2, 3, 4].map(i => (
          <div key={i} style={styles.skeletonTab} />
        ))}
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
      <div style={styles.emptyDesc}>
        点击上方 + 按钮，粘贴网址即可添加
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onAdd} style={styles.emptyBtn}>
          手动添加
        </button>
        <Link href="/admin" style={{ ...styles.emptyBtn, background: 'rgba(255,255,255,0.1)' }}>
          后台管理
        </Link>
      </div>
    </div>
  );
}

// --- Helpers ---

function getFavicon(title: string, domain: string): string {
  const first = title.charAt(0).toUpperCase();
  if (/^[A-Za-z]$/.test(first)) return first;
  const d = domain.split('.')[0];
  return d.charAt(0).toUpperCase() || '🔗';
}

// --- Styles ---

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(160deg, #0f0f1a 0%, #1a1a2e 30%, #16213e 70%, #0f3460 100%)',
    padding: '24px 32px 60px',
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    color: '#f0f0f5',
  },

  // Top bar
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
    padding: '0 4px',
  },
  backLink: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: '#a0a0c0',
    textDecoration: 'none',
    fontSize: 14,
    fontWeight: 500,
    transition: 'color 0.2s',
  },
  topCenter: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  topTitle: {
    fontSize: 17,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '0.02em',
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    border: '1px solid rgba(255,255,255,0.15)',
    color: '#f0f0f5',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.25s ease',
  },
  adminLink: {
    color: '#a0a0c0',
    textDecoration: 'none',
    display: 'flex',
    transition: 'color 0.2s',
  },

  // Add panel
  addPanel: {
    marginBottom: 24,
    padding: '18px 22px',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.1)',
    animation: 'fadeInUp 0.3s ease',
  },
  addRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  addInput: {
    flex: 1,
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.06)',
    color: '#f0f0f5',
    fontSize: 15,
    fontFamily: 'inherit',
    outline: 'none',
    transition: 'border-color 0.2s',
    minWidth: 0,
  },
  fetchSpinner: {
    marginLeft: -40,
  },
  fetchError: {
    marginTop: 10,
    fontSize: 13,
    color: '#f5a623',
  },
  submitBtn: {
    padding: '10px 24px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    border: 'none',
    fontSize: 15,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
    fontFamily: 'inherit',
  },
  cancelBtn: {
    padding: '10px 20px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.08)',
    color: '#a0a0c0',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: 14,
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'all 0.2s',
  },

  // Tabs
  tabBar: {
    display: 'flex',
    gap: 10,
    overflowX: 'auto',
    paddingBottom: 8,
    marginBottom: 28,
    scrollbarWidth: 'none',
    msOverflowStyle: 'none',
  },
  tab: {
    padding: '10px 22px',
    borderRadius: 20,
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'rgba(255,255,255,0.04)',
    color: '#a0a0c0',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.25s ease',
    fontFamily: 'inherit',
    backdropFilter: 'blur(12px)',
  },
  tabActive: {
    background: 'rgba(255,255,255,0.15)',
    color: '#fff',
    borderColor: 'rgba(255,255,255,0.35)',
    fontWeight: 600,
    boxShadow: '0 4px 20px rgba(100, 120, 255, 0.2)',
  },

  // Grid
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
    gap: 16,
  },

  // Card
  card: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 22px',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.05)',
    backdropFilter: 'blur(24px)',
    border: '1px solid rgba(255,255,255,0.08)',
    textDecoration: 'none',
    color: 'inherit',
    transition: 'all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1.2)',
    cursor: 'pointer',
    animation: 'fadeInUp 0.4s ease both',
  },
  cardIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
  },
  cardIconText: {
    fontSize: 20,
    fontWeight: 700,
    color: '#fff',
    letterSpacing: '-0.5px',
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: '#f0f0f5',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    letterSpacing: '0.01em',
  },
  cardDomain: {
    fontSize: 12,
    color: '#7878a0',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },

  // Skeleton
  skeletonTopBar: {
    height: 36,
    borderRadius: 10,
    background: 'rgba(255,255,255,0.04)',
    marginBottom: 32,
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonTabs: {
    display: 'flex',
    gap: 10,
    marginBottom: 28,
  },
  skeletonTab: {
    width: 80,
    height: 36,
    borderRadius: 20,
    background: 'rgba(255,255,255,0.04)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '18px 22px',
    borderRadius: 18,
    background: 'rgba(255,255,255,0.03)',
  },
  skeletonIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    background: 'rgba(255,255,255,0.06)',
    animation: 'pulse 1.5s ease-in-out infinite',
  },
  skeletonLine: {
    height: 14,
    width: '90%',
    borderRadius: 6,
    background: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
    animation: 'pulse 1.5s ease-in-out infinite',
  },

  // Empty
  emptyWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '70vh',
    textAlign: 'center',
  },
  emptyIcon: { fontSize: 64, marginBottom: 24, filter: 'grayscale(0.5)' },
  emptyTitle: { fontSize: 24, fontWeight: 700, color: '#f0f0f5', marginBottom: 10 },
  emptyDesc: { fontSize: 15, color: '#7878a0', marginBottom: 32, maxWidth: 300 },
  emptyBtn: {
    padding: '12px 32px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #667eea, #764ba2)',
    color: '#fff',
    textDecoration: 'none',
    fontSize: 16,
    fontWeight: 600,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
};

import React, { Suspense, lazy, useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import LinkGrid from './components/LinkGrid';
import Weather from './components/Weather';
import Sidebar from './components/Sidebar';
import DailyQuote from './components/DailyQuote';
import BookmarkBar from './components/BookmarkBar'; // Import BookmarkBar
import { CategoryModal, LinkModal } from './components/BookmarkModals';
import { DEFAULT_CATEGORIES } from './constants';
import { Category, LinkItem } from './types';
import { ArrowUp, Sun, Moon, Sparkles, Music, Home, LogOut, LogIn, Heart, Settings, History, MessageSquareQuote, PanelLeft } from 'lucide-react';
import { ChatMessage } from './types';
import { useAuth } from './contexts/AuthContext';
import {
  fetchUserBookmarks,
  addCategory, updateCategory, deleteCategory,
  addLink, updateLink, deleteLink, getColorClass
} from './services/bookmarkService';
import { getIconByName } from './utils/iconMap';

const AIStudio = lazy(() => import('./components/AIStudio'));
const MusicPlatform = lazy(() => import('./components/MusicPlatform'));
const AuthModal = lazy(() => import('./components/AuthModal'));
const BookmarkManager = lazy(() => import('./components/BookmarkManager'));
const Guestbook = lazy(() => import('./components/Guestbook'));

function App() {
  const [view, setView] = useState<'dashboard' | 'studio' | 'music' | 'bookmarks' | 'guestbook'>('dashboard');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [hasVisitedMusic, setHasVisitedMusic] = useState(false);
  
  // Bookmarks State
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

  // Split categories for UI
  const bookmarkBarRootTitle = '\u4e66\u7b7e\u680f';
  const bookmarkBarCategories = categories.filter(category => category.title === bookmarkBarRootTitle || category.title.startsWith(bookmarkBarRootTitle));
  
  // Dashboard Categories: Everything else
  const dashboardCategories = categories.filter(category => category.title !== bookmarkBarRootTitle && !category.title.startsWith(bookmarkBarRootTitle));

  const totalDashboardLinks = dashboardCategories.reduce((total, category) => total + category.links.length, 0);
  const currentSectionTitle = dashboardCategories.find(category => category.id === activeSection)?.title || dashboardCategories[0]?.title || '首页';

  // Modal States
  const [categoryModalOpen, setCategoryModalOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null); // null means adding
  
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [editingLink, setEditingLink] = useState<LinkItem | null>(null); // null means adding
  const [targetCategoryId, setTargetCategoryId] = useState<string | null>(null);

  // Music Tab Request State (for external control)
  const [musicTabRequest, setMusicTabRequest] = useState<'favorites' | 'history' | null>(null);
  
  // Auth State
  const { user, profile, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  
  // Theme state initialization with LocalStorage check
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    // 1. Check local storage
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      return savedTheme;
    }
    // 2. Fallback to time-based
    const hours = new Date().getHours();
    return (hours >= 6 && hours < 18) ? 'light' : 'dark';
  });

  // AI Chat History State (Lifted up for persistence)
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { id: 'init-chat', role: 'model', text: '\u4f60\u597d\uff01\u6211\u662f\u4f60\u7684 AI \u667a\u80fd\u52a9\u624b\u3002\u6709\u4ec0\u4e48\u6211\u53ef\u4ee5\u5e2e\u4f60\u7684\u5417\uff1f' }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // AI Image History State (Lifted up for persistence)
  const [imageHistory, setImageHistory] = useState<ChatMessage[]>([
    { id: 'init-image', role: 'model', text: '\u6b22\u8fce\u6765\u5230 AI \u7ed8\u753b\u6a21\u5f0f\u3002\u8bf7\u63cf\u8ff0\u4f60\u60f3\u8981\u751f\u6210\u7684\u753b\u9762\u3002' }
  ]);

  // Apply theme to document and save to local storage
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    setCurrentTime(new Date());
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (view === 'music') {
      setHasVisitedMusic(true);
    }
  }, [view]);


  // Helper to rehydrate icons from raw data (for cache)
  const hydrateCategories = (data: Category[]) => {
      return data.map(cat => ({
          ...cat,
          icon: getIconByName((cat as any).raw_icon_name),
          links: cat.links.map((link: any) => ({
              ...link,
              icon: getIconByName(link.raw_icon_name, getColorClass(link.raw_icon_name))
          }))
      }));
  };

  // Function to reload bookmarks
  const refreshBookmarks = async () => {
      if (!user) return;
      const userBookmarks = await fetchUserBookmarks(user.id);
      if (userBookmarks) {
        setCategories(userBookmarks);
        // Cache data (removing React Nodes)
        const cacheable = userBookmarks.map(cat => ({
            ...cat,
            icon: undefined, 
            links: cat.links.map(l => ({ ...l, icon: undefined }))
        }));
        try {
            localStorage.setItem(`user_bookmarks_${user.id}`, JSON.stringify(cacheable));
        } catch (e) {
            console.warn("Failed to cache bookmarks", e);
        }
      } else {
        setCategories(DEFAULT_CATEGORIES);
      }
  };

  // Load Bookmarks on Auth Change with Caching
  useEffect(() => {
    const loadBookmarks = async () => {
      if (user) {
        let hasCache = false;
        // 1. Try Load from Cache
        const cacheKey = `user_bookmarks_${user.id}`;
        const cachedData = localStorage.getItem(cacheKey);
        
        if (cachedData) {
            try {
                const parsed = JSON.parse(cachedData);
                const hydrated = hydrateCategories(parsed);
                setCategories(hydrated);
                hasCache = true;
            } catch(e) { 
                console.error("Cache parse error", e); 
            }
        }

        // 2. Fetch fresh data (in background if cached)
        if (!hasCache) {
            setIsLoadingBookmarks(true);
        }
        
        await refreshBookmarks();
        setIsLoadingBookmarks(false);
      } else {
        setCategories(DEFAULT_CATEGORIES);
        if (view === 'bookmarks') setView('dashboard'); // Redirect if managing
      }
    };
    loadBookmarks();
  }, [user?.id]); // Only re-run if user ID changes (avoids unnecessary reloads on session refreshes)

  // --- CRUD Handlers ---

  // Category Handlers
  const handleSaveCategory = async (title: string, iconName: string) => {
    if (!user) return;
    try {
      if (editingCategory) {
        await updateCategory(editingCategory.id, title, iconName);
      } else {
        await addCategory(user.id, title, iconName);
      }
      await refreshBookmarks();
    } catch (error) {
      console.error("Save category failed", error);
      alert("操作失败");
    }
  };

  const handleDeleteCategory = async (id: string) => {
    if (!confirm("确定删除此分类吗？包含的链接也会被删除。")) return;
    try {
      await deleteCategory(id);
      await refreshBookmarks();
    } catch (error) {
      console.error("Delete category failed", error);
      alert("删除失败");
    }
  };

  // Link Handlers
  const handleSaveLink = async (data: { title: string, url: string, description: string, iconName: string }) => {
    if (!user) return;
    try {
      if (editingLink) {
        await updateLink(editingLink.id, data);
      } else if (targetCategoryId) {
        await addLink(user.id, targetCategoryId, data);
      }
      await refreshBookmarks();
    } catch (error) {
      console.error("Save link failed", error);
      alert("操作失败");
    }
  };

  const handleDeleteLink = async (id: string) => {
    if (!confirm("确定删除此链接吗？")) return;
    try {
      await deleteLink(id);
      await refreshBookmarks();
    } catch (error) {
      console.error("Delete link failed", error);
      alert("删除失败");
    }
  };

  // Callback to handle music tab resets - Memorized to prevent infinite effect loops in MusicPlatform
  const handleMusicTabReset = useCallback(() => {
    setMusicTabRequest(null);
  }, []);


  // Handle Scroll (Spy & Back to Top) for Dashboard
  useEffect(() => {
    const dashboardContainer = document.getElementById('dashboard-container');
    if (!dashboardContainer) return;

    const handleScroll = () => {
      // Show/Hide Back to top button
      if (dashboardContainer.scrollTop > 300) {
        setShowScrollTop(true);
      } else {
        setShowScrollTop(false);
      }
    };

    dashboardContainer.addEventListener('scroll', handleScroll);

    // Intersection Observer for Sections
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id);
          }
        });
      },
      { 
        root: dashboardContainer,
        rootMargin: '-10% 0px -80% 0px' 
      }
    );

    // Observe whatever categories we have
    dashboardCategories.forEach((cat) => {
      const el = document.getElementById(cat.id);
      if (el) observer.observe(el);
    });

    return () => {
      dashboardContainer.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, [view, dashboardCategories]);

  const scrollToTop = () => {
    const dashboardContainer = document.getElementById('dashboard-container');
    if (dashboardContainer) {
      dashboardContainer.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', { weekday: 'long', month: 'long', day: 'numeric' });
  };


  const viewFallback = (
    <div className="flex-1 flex items-center justify-center px-6 py-10">
      <div className="glass-panel rounded-[1.8rem] px-6 py-8 text-center text-slate-600 dark:text-slate-300">
        <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-2 border-amber-300 border-t-amber-500 dark:border-amber-500/20 dark:border-t-amber-300" />
        <div className="text-sm font-medium">正在加载模块...</div>
      </div>
    </div>
  );

  return (
    <div className="h-screen flex flex-col transition-colors duration-300 text-slate-900 dark:text-slate-100">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-500">
         <div className="absolute inset-0 surface-grid opacity-90 dark:opacity-70"></div>
         <div className="absolute top-[-10%] right-[-8%] w-[34rem] h-[34rem] rounded-full blur-[120px] bg-amber-200/35 dark:bg-amber-500/10 animate-blob"></div>
         <div className="absolute top-[8%] left-[10%] w-[26rem] h-[26rem] rounded-full blur-[110px] bg-amber-100/45 dark:bg-amber-400/08 animate-blob animation-delay-2000"></div>
         <div className="absolute bottom-[-18%] right-[12%] w-[28rem] h-[28rem] rounded-full blur-[120px] bg-stone-200/28 dark:bg-stone-400/08 animate-blob animation-delay-4000"></div>
         <div className="absolute bottom-[-10%] left-[-8%] w-[30rem] h-[30rem] rounded-full blur-[120px] bg-rose-100/35 dark:bg-slate-700/30 animate-blob animation-delay-2000"></div>
      </div>

      {/* FIXED TOP NAVIGATION BAR */}
      <header className="shrink-0 z-50 h-[4.5rem] header-shell border-b border-[rgba(148,114,70,0.14)] dark:border-[rgba(209,154,102,0.1)] flex items-center justify-between gap-3 px-4 sm:px-5 lg:px-6 transition-all duration-300">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => setIsMobileSidebarOpen(true)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-white/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/55 text-slate-600 dark:text-slate-300"
            aria-label="打开侧栏"
          >
            <PanelLeft size={18} />
          </button>
          <div className="hidden sm:flex items-center gap-3 min-w-0">
            <div className="brand-ring w-10 h-10 rounded-[1.1rem] bg-gradient-to-br from-amber-500 via-orange-400 to-orange-300 text-white flex items-center justify-center shadow-[0_16px_32px_-18px_rgba(217,119,69,0.9)]">
              <span className="font-[Outfit] text-base font-extrabold tracking-[0.18em] pl-[0.18em]">75</span>
            </div>
            <div className="min-w-0">
              <div className="font-[Outfit] text-base font-semibold tracking-[0.14em] text-slate-800 dark:text-slate-100 truncate">七五导航</div>
            </div>
          </div>
          <div className="hidden xl:flex items-center gap-2 rounded-full bg-white/60 dark:bg-slate-900/55 border border-white/70 dark:border-slate-700/60 px-3 py-1.5 text-xs text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400" />
            {currentSectionTitle}
          </div>
        </div>

        <nav className="flex items-center gap-1.5 sm:gap-1.5 p-1.5 bg-white/55 dark:bg-slate-900/50 rounded-[1.1rem] border border-white/60 dark:border-slate-700/50 shadow-[0_12px_30px_-22px_rgba(31,41,55,0.45)] overflow-x-auto max-w-[58vw] scrollbar-hide">
          <button onClick={() => setView('dashboard')} className={`px-2.5 py-2 sm:px-3.5 rounded-[0.9rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${view === 'dashboard' ? 'bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-[0_16px_30px_-20px_rgba(201,131,77,0.45)]' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'}`}>
            <Home size={16} />
            <span className="hidden md:inline">导航</span>
          </button>
          <button onClick={() => setView('studio')} className={`px-2.5 py-2 sm:px-3.5 rounded-[0.9rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${view === 'studio' ? 'bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-[0_16px_30px_-20px_rgba(201,131,77,0.45)]' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'}`}>
            <Sparkles size={16} />
            <span className="hidden md:inline">AI 助手</span>
          </button>
          <button onClick={() => setView('music')} className={`px-2.5 py-2 sm:px-3.5 rounded-[0.9rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${view === 'music' ? 'bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-[0_16px_30px_-20px_rgba(201,131,77,0.45)]' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'}`}>
            <Music size={16} />
            <span className="hidden md:inline">音乐</span>
          </button>
          <button onClick={() => setView('guestbook')} className={`px-2.5 py-2 sm:px-3.5 rounded-[0.9rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap ${view === 'guestbook' ? 'bg-gradient-to-r from-amber-500 to-orange-400 text-white shadow-[0_16px_30px_-20px_rgba(201,131,77,0.45)]' : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'}`}>
            <MessageSquareQuote size={16} />
            <span className="hidden md:inline">留言板</span>
          </button>
        </nav>

        <div className="flex items-center gap-2 sm:gap-3">

          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-2xl text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/80 transition-colors border border-[rgba(148,114,70,0.12)] dark:border-slate-700/60"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>

          {user ? (
            <div className="relative" id="user-menu-container">
              <button
                onClick={() => setShowUserMenu(prev => !prev)}
                className="flex items-center gap-2 rounded-[1.1rem] border border-white/70 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/55 px-3 py-2.5 transition-colors hover:bg-white dark:hover:bg-slate-800/80"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-400 text-white font-semibold">
                  {profile?.nickname?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="hidden md:block text-left min-w-0 max-w-[10rem]">
                  <div className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{profile?.nickname || '已登录'}</div>
                  <div className="truncate text-[11px] text-slate-500 dark:text-slate-400">{user.email}</div>
                </div>
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-30" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-3 w-72 rounded-[1.6rem] border border-white/70 dark:border-slate-700/60 bg-[rgba(255,251,245,0.96)] dark:bg-[rgba(9,20,28,0.96)] backdrop-blur-xl shadow-[0_28px_60px_-28px_rgba(15,23,42,0.35)] overflow-hidden z-40">
                    <div className="p-4 border-b border-[rgba(148,114,70,0.1)] dark:border-slate-700/60">
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{profile?.nickname || '已登录用户'}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                      {profile?.signature && <p className="text-xs text-slate-400 mt-1 italic truncate">"{profile.signature}"</p>}
                    </div>
                    <button onClick={() => { setView('bookmarks'); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-[rgba(148,114,70,0.08)] dark:border-slate-700/50">
                      <Settings size={16} className="text-blue-500" />
                      <span>导航管理</span>
                    </button>
                    <button onClick={() => { setView('music'); setMusicTabRequest('favorites'); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-[rgba(148,114,70,0.08)] dark:border-slate-700/50">
                      <Heart size={16} className="text-red-500" />
                      <span>我的收藏音乐</span>
                    </button>
                    <button onClick={() => { setView('music'); setMusicTabRequest('history'); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-[rgba(148,114,70,0.08)] dark:border-slate-700/50">
                      <History size={16} className="text-blue-500" />
                      <span>播放历史</span>
                    </button>
                    <button onClick={() => { signOut(); setShowUserMenu(false); }} className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors">
                      <LogOut size={16} />
                      <span>退出登录</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 hover:from-orange-400 hover:to-orange-300 text-white text-sm font-medium shadow-[0_18px_36px_-18px_rgba(217,119,69,0.9)] transition-all hover:-translate-y-0.5"
            >
              <LogIn size={16} />
              <span className="hidden md:inline">登录</span>
            </button>
          )}
        </div>
      </header>
      
      {/* Bookmark Bar - Detached Background Fix for Clipping Issues */}
      {view === 'dashboard' && bookmarkBarCategories.length > 0 && (
          <div className="shrink-0 z-50 border-b border-[rgba(148,114,70,0.12)] dark:border-[rgba(209,154,102,0.1)] relative">
             {/* Background with blur - separate layer to avoid clipping children in some browsers */}
             <div className="absolute inset-0 bg-[rgba(255,250,242,0.82)] dark:bg-[rgba(9,20,28,0.86)] backdrop-blur-xl -z-10" />
             
             {/* Content container - explicit overflow-visible */}
             <div className="relative overflow-visible">
                 <BookmarkBar categories={bookmarkBarCategories} />
             </div>
          </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden relative">

        {/* VIEW: DASHBOARD */}
        {view === 'dashboard' && (
          <div 
            id="dashboard-container"
            className="flex-1 flex flex-col relative overflow-y-auto overflow-x-hidden scroll-smooth"
          >
            <Sidebar 
              categories={dashboardCategories} 
              activeSection={activeSection}
              isCollapsed={isSidebarCollapsed}
              toggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
              isMobileOpen={isMobileSidebarOpen}
              closeMobileSidebar={() => setIsMobileSidebarOpen(false)}
            />
            
            <main className={`relative z-10 flex flex-col flex-1 transition-all duration-300 ease-in-out ${isSidebarCollapsed ? 'pl-0 md:pl-20' : 'pl-0 md:pl-64'}`}> 
              <div className="w-full max-w-[1820px] mx-auto px-4 sm:px-8 md:px-10 xl:px-12 py-5 md:py-6 xl:py-7 space-y-6 md:space-y-8">
                {/* Dashboard Top */}
                <section className="glass-panel rounded-[1.8rem] px-5 py-5 md:px-6 md:py-6 xl:px-6 xl:py-6 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,119,69,0.12),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(176,137,104,0.08),transparent_24%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.12),transparent_26%),radial-gradient(circle_at_bottom_left,rgba(209,154,102,0.08),transparent_24%)]" />
                  <div className="relative z-10 flex flex-col gap-4">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
                      <div className="min-w-0 max-w-4xl">
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/72 dark:bg-slate-900/72 border border-white/70 dark:border-slate-700/70 text-[11px] font-semibold tracking-[0.22em] text-slate-500 dark:text-slate-400 shadow-[0_12px_30px_-24px_rgba(15,23,42,0.45)]">
                          <span className="w-2 h-2 rounded-full bg-gradient-to-r from-amber-500 to-orange-400" />
                          七五导航
                        </div>
                        <h1 className="mt-4 text-[2rem] leading-[1.04] md:text-[2.7rem] lg:text-[3rem] font-[Outfit] font-semibold tracking-[-0.05em] text-slate-900 dark:text-white">
                          一屏直达
                        </h1>
                        <p className="mt-2 max-w-xl text-sm md:text-[14px] leading-6 text-slate-600 dark:text-slate-300">
                          常用入口集中展示，少一点干扰，多一点效率。
                        </p>
                      </div>

                      <div className="flex flex-wrap gap-2.5">
                        <div className="rounded-full bg-white/72 dark:bg-slate-900/72 border border-white/70 dark:border-slate-700/70 px-4 py-2 text-sm font-medium text-slate-700 shadow-[0_16px_32px_-26px_rgba(15,23,42,0.4)] dark:text-slate-200">
                          {totalDashboardLinks} 链接
                        </div>
                        <div className="rounded-full bg-amber-500/10 dark:bg-amber-400/10 px-4 py-2 text-sm font-medium text-amber-700 dark:text-amber-300">
                          {currentSectionTitle}
                        </div>
                      </div>
                    </div>

                    <SearchBar />

                    <div className="grid gap-3 xl:grid-cols-[14rem_minmax(0,1fr)_15rem]">
                      <div className="surface-card surface-card-soft rounded-[1.45rem] px-4 py-4">
                        <div className="text-[11px] tracking-[0.2em] text-slate-400 dark:text-slate-500">当前时间</div>
                        <div className="mt-2 font-[Outfit] text-[2.35rem] font-semibold leading-none tracking-tight text-slate-900 dark:text-white">
                          {currentTime ? formatTime(currentTime) : <span className="opacity-0">00:00</span>}
                        </div>
                        <div className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                          {currentTime ? formatDate(currentTime) : <span className="opacity-0">加载中</span>}
                        </div>
                        <div className="mt-4 inline-flex rounded-full bg-amber-500/10 dark:bg-amber-400/10 px-3 py-1.5 text-xs font-medium text-amber-700 dark:text-amber-300">
                          {currentSectionTitle}
                        </div>
                      </div>

                      <DailyQuote />

                      <div className="grid gap-3">
                        <Weather compact={false} />
                        <div className="surface-card surface-card-soft rounded-[1.45rem] p-3">
                          <div className="grid gap-2.5">
                            <button onClick={() => setView('studio')} className="flex items-center justify-between gap-3 rounded-[0.95rem] border border-[rgba(148,114,70,0.12)] bg-white/78 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/72 dark:text-slate-200 dark:hover:border-amber-400/20 dark:hover:text-amber-300">
                              <span className="flex items-center gap-2"><Sparkles size={15} />AI 助手</span>
                              <ArrowUp size={14} className="rotate-45" />
                            </button>
                            <button onClick={() => setView('music')} className="flex items-center justify-between gap-3 rounded-[0.95rem] border border-[rgba(148,114,70,0.12)] bg-white/78 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/72 dark:text-slate-200 dark:hover:border-amber-400/20 dark:hover:text-amber-300">
                              <span className="flex items-center gap-2"><Music size={15} />音乐中心</span>
                              <ArrowUp size={14} className="rotate-45" />
                            </button>
                            <button onClick={() => setView('guestbook')} className="flex items-center justify-between gap-3 rounded-[0.95rem] border border-[rgba(148,114,70,0.12)] bg-white/78 px-3.5 py-2.5 text-sm font-medium text-slate-700 transition-all hover:-translate-y-0.5 hover:border-amber-200 hover:text-amber-700 dark:border-slate-700 dark:bg-slate-900/72 dark:text-slate-200 dark:hover:border-amber-400/20 dark:hover:text-amber-300">
                              <span className="flex items-center gap-2"><MessageSquareQuote size={15} />留言板</span>
                              <ArrowUp size={14} className="rotate-45" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>

                <div className="w-full pb-16">
                   {isLoadingBookmarks ? (
                     <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-500"></div>
                     </div>
                   ) : (
                     <LinkGrid categories={dashboardCategories} />
                   )}
                </div>
              </div>
            </main>
            <button
              onClick={scrollToTop}
              className={`fixed bottom-8 right-8 p-3 rounded-full shadow-lg bg-[rgba(255,250,242,0.86)] dark:bg-[rgba(9,20,28,0.82)] backdrop-blur-xl border border-[rgba(148,114,70,0.14)] dark:border-[rgba(209,154,102,0.12)] text-slate-700 dark:text-slate-200 z-30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:bg-white
                ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}
              `}
              aria-label="回到顶部"
            >
              <ArrowUp size={20} />
            </button>
          </div>
        )}

        {/* VIEW: STUDIO */}
        {view === 'studio' && (
          <Suspense fallback={viewFallback}>
            <div className="flex-1 h-full overflow-hidden">
              <AIStudio 
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
                imageHistory={imageHistory}
                setImageHistory={setImageHistory}
                currentSessionId={currentSessionId}
                setCurrentSessionId={setCurrentSessionId}
              />
            </div>
          </Suspense>
        )}

        {/* VIEW: GUESTBOOK */}
        {view === 'guestbook' && (
          <Suspense fallback={viewFallback}>
            <div className="flex-1 h-full overflow-hidden">
              <Guestbook />
            </div>
          </Suspense>
        )}

        {/* VIEW: BOOKMARKS MANAGEMENT */}
        {view === 'bookmarks' && (
          <Suspense fallback={viewFallback}>
            <div className="flex-1 h-full overflow-hidden">
              <BookmarkManager 
                categories={categories}
                onAddCategory={() => {
                  setEditingCategory(null);
                  setCategoryModalOpen(true);
                }}
                onEditCategory={(cat) => {
                  setEditingCategory(cat);
                  setCategoryModalOpen(true);
                }}
                onDeleteCategory={handleDeleteCategory}
                onAddLink={(catId) => {
                  setTargetCategoryId(catId);
                  setEditingLink(null);
                  setLinkModalOpen(true);
                }}
                onEditLink={(link) => {
                  setEditingLink(link);
                  setLinkModalOpen(true);
                }}
                onDeleteLink={handleDeleteLink}
                refreshBookmarks={refreshBookmarks}
              />
            </div>
          </Suspense>
        )}

        {/* VIEW: MUSIC */}
        {(hasVisitedMusic || view === 'music') && (
          <Suspense fallback={view === 'music' ? viewFallback : null}>
            <MusicPlatform 
              activeView={view as any}
              onViewChange={(v) => setView(v)}
              requestedTab={musicTabRequest}
              onTabChangeHandled={handleMusicTabReset}
              onAuthRequest={() => setIsAuthModalOpen(true)}
            />
          </Suspense>
        )}

      </div>

      {/* Modals */}
      {isAuthModalOpen && (
        <Suspense fallback={null}>
          <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
        </Suspense>
      )}
      
      {/* Category Modal */}
      <CategoryModal 
        isOpen={categoryModalOpen}
        onClose={() => setCategoryModalOpen(false)}
        onSave={handleSaveCategory}
        initialData={editingCategory ? { title: editingCategory.title, iconName: (editingCategory as any).raw_icon_name || 'Hash' } : undefined}
        title={editingCategory ? '编辑分类' : '添加分类'}
      />

      {/* Link Modal */}
      <LinkModal 
        isOpen={linkModalOpen}
        onClose={() => setLinkModalOpen(false)}
        onSave={handleSaveLink}
        initialData={editingLink ? { 
          title: editingLink.title, 
          url: editingLink.url, 
          description: editingLink.description || '', 
          iconName: (editingLink as any).raw_icon_name || 'Globe'
        } : undefined}
        title={editingLink ? '编辑链接' : '添加链接'}
      />

    </div>
  );
}

export default App;















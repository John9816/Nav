import React, { useState, useEffect, useCallback } from 'react';
import SearchBar from './components/SearchBar';
import LinkGrid from './components/LinkGrid';
import Weather from './components/Weather';
import Sidebar from './components/Sidebar';
import DailyQuote from './components/DailyQuote';
import AIStudio from './components/AIStudio';
import MusicPlatform from './components/MusicPlatform';
import AuthModal from './components/AuthModal';
import BookmarkManager from './components/BookmarkManager';
import Guestbook from './components/Guestbook'; 
import BookmarkBar from './components/BookmarkBar'; // Import BookmarkBar
import { CategoryModal, LinkModal } from './components/BookmarkModals';
import { DEFAULT_CATEGORIES } from './constants';
import { Category, LinkItem } from './types';
import { ArrowUp, Sun, Moon, Sparkles, Music, Home, LogOut, LogIn, Heart, Settings, History, MessageSquareQuote } from 'lucide-react';
import { ChatMessage } from './types';
import { useAuth } from './contexts/AuthContext';
import { 
  fetchUserBookmarks, 
  addCategory, updateCategory, deleteCategory,
  addLink, updateLink, deleteLink, getColorClass
} from './services/bookmarkService';
import { getIconByName } from './utils/iconMap';

function App() {
  const [view, setView] = useState<'dashboard' | 'studio' | 'music' | 'bookmarks' | 'guestbook'>('dashboard');
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState<string>('');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  
  // Bookmarks State
  const [categories, setCategories] = useState<Category[]>(DEFAULT_CATEGORIES);
  const [isLoadingBookmarks, setIsLoadingBookmarks] = useState(false);

  // Split categories for UI
  // Bookmark Bar Categories: Exact match '书签栏' OR start with '书签栏/'
  const bookmarkBarCategories = categories.filter(c => c.title === '书签栏' || c.title.startsWith('书签栏/'));
  
  // Dashboard Categories: Everything else
  const dashboardCategories = categories.filter(c => c.title !== '书签栏' && !c.title.startsWith('书签栏/'));

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
    { id: 'init-chat', role: 'model', text: '你好！我是你的 AI 智能助手。有什么我可以帮你的吗？' }
  ]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  
  // AI Image History State (Lifted up for persistence)
  const [imageHistory, setImageHistory] = useState<ChatMessage[]>([
    { id: 'init-image', role: 'model', text: '欢迎来到 AI 绘画模式。请描述你想要生成的画面。' }
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
    if (!confirm('确定删除此分类吗？包含的链接也会被删除。')) return;
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
    if (!confirm('确定删除此链接吗？')) return;
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

  return (
    <div className="h-screen flex flex-col transition-colors duration-300 text-slate-900 dark:text-slate-100">
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-500">
         <div className="absolute inset-0 surface-grid opacity-90 dark:opacity-70"></div>
         <div className="absolute top-[-10%] right-[-8%] w-[34rem] h-[34rem] rounded-full blur-[120px] bg-orange-200/45 dark:bg-orange-500/12 animate-blob"></div>
         <div className="absolute top-[8%] left-[10%] w-[26rem] h-[26rem] rounded-full blur-[110px] bg-amber-100/55 dark:bg-teal-400/10 animate-blob animation-delay-2000"></div>
         <div className="absolute bottom-[-18%] right-[12%] w-[28rem] h-[28rem] rounded-full blur-[120px] bg-teal-200/35 dark:bg-cyan-400/10 animate-blob animation-delay-4000"></div>
         <div className="absolute bottom-[-10%] left-[-8%] w-[30rem] h-[30rem] rounded-full blur-[120px] bg-rose-100/35 dark:bg-slate-700/30 animate-blob animation-delay-2000"></div>
      </div>

      {/* FIXED TOP NAVIGATION BAR */}
      <header className="shrink-0 z-50 h-18 bg-[rgba(255,250,242,0.72)] dark:bg-[rgba(9,20,28,0.8)] backdrop-blur-xl border-b border-[rgba(148,114,70,0.14)] dark:border-[rgba(94,234,212,0.1)] flex items-center justify-between px-4 sm:px-6 lg:px-8 transition-all duration-300">
        
        {/* Left: Menu Toggle (Mobile Only) */}
        <div className="flex items-center gap-3 min-w-0">
            <div className="hidden sm:flex items-center gap-3 min-w-0">
              <div className="brand-ring w-11 h-11 rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-teal-500 text-white flex items-center justify-center shadow-[0_16px_32px_-18px_rgba(217,119,69,0.9)]">
                <span className="font-[Outfit] text-base font-extrabold tracking-[0.18em] pl-[0.18em]">75</span>
              </div>
              <div className="min-w-0">
                <div className="font-[Outfit] text-lg font-semibold tracking-[0.18em] text-slate-800 dark:text-slate-100 truncate">七五导航</div>
                <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400 truncate">Curated Start Surface</div>
              </div>
            </div>
        </div>

        {/* Center: Main Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 p-1.5 bg-white/55 dark:bg-slate-900/50 rounded-[1.4rem] border border-white/60 dark:border-slate-700/50 shadow-[0_12px_30px_-22px_rgba(31,41,55,0.45)] overflow-x-auto max-w-[60vw] scrollbar-hide">
           <button
             onClick={() => setView('dashboard')}
             className={`px-3 py-2 sm:px-4 rounded-[1rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'dashboard'
                 ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white shadow-[0_16px_30px_-18px_rgba(217,119,69,0.9)]'
                 : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
               }
             `}
           >
             <Home size={16} />
             <span className="hidden sm:inline">导航</span>
           </button>
           <button
             onClick={() => setView('studio')}
             className={`px-3 py-2 sm:px-4 rounded-[1rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'studio'
                 ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-[0_16px_30px_-18px_rgba(20,184,166,0.9)]'
                 : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
               }
             `}
           >
             <Sparkles size={16} />
             <span className="hidden sm:inline">AI助手</span>
           </button>
           <button
             onClick={() => setView('music')}
             className={`px-3 py-2 sm:px-4 rounded-[1rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'music'
                 ? 'bg-gradient-to-r from-rose-500 to-orange-500 text-white shadow-[0_16px_30px_-18px_rgba(244,63,94,0.85)]'
                 : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
               }
             `}
           >
             <Music size={16} />
             <span className="hidden sm:inline">音乐</span>
           </button>
           <button
             onClick={() => setView('guestbook')}
             className={`px-3 py-2 sm:px-4 rounded-[1rem] text-sm font-semibold transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'guestbook'
                 ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-[0_16px_30px_-18px_rgba(16,185,129,0.85)]'
                 : 'text-slate-600 hover:text-slate-900 hover:bg-white/60 dark:text-slate-300 dark:hover:text-white dark:hover:bg-slate-800/70'
               }
             `}
           >
             <MessageSquareQuote size={16} />
             <span className="hidden sm:inline">留言</span>
           </button>
        </nav>

        {/* Right: Weather & Theme & User */}
        <div className="flex items-center gap-2 sm:gap-3">
           {/* Weather Compact Widget */}
           <div className="hidden lg:block px-3 py-2 rounded-2xl bg-white/45 dark:bg-slate-900/45 border border-white/60 dark:border-slate-700/50">
              <Weather compact={true} />
           </div>

           <button
            onClick={toggleTheme}
            className="p-2.5 rounded-2xl text-slate-600 hover:bg-white/70 dark:text-slate-300 dark:hover:bg-slate-800/80 transition-colors border border-[rgba(148,114,70,0.12)] dark:border-slate-700/60"
            title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          {/* User Auth Section */}
          <div className="relative">
            {user ? (
               <div className="relative">
                 <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 p-1 pl-3 pr-1 rounded-full bg-white/65 hover:bg-white/85 dark:bg-slate-900/70 dark:hover:bg-slate-800 transition-colors border border-white/60 dark:border-slate-700/60 shadow-[0_12px_28px_-22px_rgba(31,41,55,0.55)]"
                 >
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 hidden md:block max-w-[100px] truncate">
                      {/* Priority: Nickname > Username > Email Part */}
                      {profile?.nickname || profile?.username || user.email?.split('@')[0]}
                    </span>
                    {profile?.avatar_url ? (
                       <img 
                          src={profile.avatar_url} 
                          alt="Avatar" 
                          className="w-8 h-8 rounded-full object-cover shadow-md bg-white border border-[rgba(148,114,70,0.18)] dark:border-slate-700"
                       />
                    ) : (
                       <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-orange-500 to-teal-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                          {(profile?.nickname || user.email || 'U').charAt(0).toUpperCase()}
                       </div>
                    )}
                 </button>
                 
                 {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-[rgba(255,251,245,0.95)] dark:bg-[rgba(9,20,28,0.96)] rounded-2xl shadow-2xl border border-[rgba(148,114,70,0.14)] dark:border-slate-700 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                         <div className="p-4 border-b border-[rgba(148,114,70,0.1)] dark:border-slate-700">
                            {profile?.nickname && (
                               <p className="font-bold text-slate-800 dark:text-slate-100 truncate">{profile.nickname}</p>
                            )}
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate">{user.email}</p>
                            {profile?.signature && (
                                <p className="text-xs text-slate-400 mt-1 italic truncate">"{profile.signature}"</p>
                            )}
                         </div>
                         
                         {/* Navigation Manager Button */}
                         <button 
                            onClick={() => {
                                setView('bookmarks');
                                setShowUserMenu(false);
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-[rgba(148,114,70,0.08)] dark:border-slate-700/50"
                         >
                            <Settings size={16} className="text-blue-500" />
                            <span>导航管理</span>
                         </button>

                         {/* My Favorites Button */}
                         <button 
                            onClick={() => { 
                                setView('music');
                                setMusicTabRequest('favorites');
                                setShowUserMenu(false); 
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-[rgba(148,114,70,0.08)] dark:border-slate-700/50"
                         >
                            <Heart size={16} className="text-red-500" />
                            <span>我喜欢的音乐</span>
                         </button>

                         {/* Play History Button */}
                         <button 
                            onClick={() => { 
                                setView('music');
                                setMusicTabRequest('history');
                                setShowUserMenu(false); 
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-orange-50 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors border-b border-[rgba(148,114,70,0.08)] dark:border-slate-700/50"
                         >
                            <History size={16} className="text-blue-500" />
                            <span>播放历史</span>
                         </button>

                         <button 
                           onClick={() => { signOut(); setShowUserMenu(false); }}
                           className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                         >
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
                 className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-gradient-to-r from-orange-500 to-teal-500 hover:from-orange-400 hover:to-teal-400 text-white text-sm font-medium shadow-[0_18px_36px_-18px_rgba(217,119,69,0.9)] transition-all hover:-translate-y-0.5"
               >
                 <LogIn size={16} />
                 <span className="hidden sm:inline">登录</span>
               </button>
            )}
          </div>
        </div>
      </header>
      
      {/* Bookmark Bar - Detached Background Fix for Clipping Issues */}
      {view === 'dashboard' && bookmarkBarCategories.length > 0 && (
          <div className="shrink-0 z-50 border-b border-[rgba(148,114,70,0.12)] dark:border-[rgba(94,234,212,0.1)] relative">
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
            
            <main className={`relative z-10 flex flex-col flex-1 transition-all duration-300 ease-in-out
              ${isSidebarCollapsed ? 'pl-20 md:pl-20' : 'pl-20 md:pl-72'}
            `}>
              <div className="w-full mx-auto px-4 sm:px-8 md:px-12 py-8 md:py-10 space-y-12">
                {/* Hero Section */}
                <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1.15fr)_22rem] gap-6 xl:gap-8 items-stretch animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <section className="glass-panel rounded-[2rem] px-6 py-7 md:px-8 md:py-8 overflow-hidden relative">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,119,69,0.16),transparent_30%),radial-gradient(circle_at_bottom_left,rgba(13,148,136,0.14),transparent_28%)] dark:bg-[radial-gradient(circle_at_top_right,rgba(251,146,60,0.16),transparent_28%),radial-gradient(circle_at_bottom_left,rgba(45,212,191,0.12),transparent_24%)]" />
                    <div className="relative z-10 flex flex-col gap-6">
                      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-2xl">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-slate-700/70 text-[11px] font-semibold tracking-[0.28em] uppercase text-slate-500 dark:text-slate-400">
                            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-500 to-teal-500" />
                            七五导航
                          </div>
                          <h1 className="mt-4 text-4xl md:text-5xl lg:text-6xl font-[Outfit] font-semibold tracking-tight text-slate-900 dark:text-white">
                            把常用网站、AI 助手和音乐入口收进一个首页。
                          </h1>
                          <p className="mt-4 max-w-xl text-sm md:text-base leading-7 text-slate-600 dark:text-slate-300">
                            保留原有功能结构，重新整理视觉层级、色彩节奏和卡片密度，让首页更像一个可长期使用的私人工作台。
                          </p>
                        </div>

                        <div className="shrink-0 rounded-[1.75rem] bg-[rgba(255,255,255,0.72)] dark:bg-[rgba(9,20,28,0.78)] border border-white/60 dark:border-slate-700/60 px-5 py-4 min-w-[15rem] select-none shadow-[0_24px_50px_-30px_rgba(66,45,22,0.45)]">
                          <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Current Time</div>
                          <div className="mt-2 font-[Outfit] text-5xl md:text-6xl font-semibold tracking-tight text-slate-900 dark:text-white">
                            {currentTime ? formatTime(currentTime) : <span className="opacity-0">00:00</span>}
                          </div>
                          <div className="mt-2 text-sm font-medium text-slate-500 dark:text-slate-400">
                            {currentTime ? formatDate(currentTime) : <span className="opacity-0">Loading...</span>}
                          </div>
                        </div>
                      </div>

                      <div className="w-full max-w-3xl">
                        <SearchBar />
                      </div>

                      <DailyQuote />

                      <div className="md:hidden">
                        <Weather compact={false} />
                      </div>
                    </div>
                  </section>

                  <aside className="glass-panel rounded-[2rem] px-5 py-6 md:px-6 flex flex-col justify-between gap-6">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.28em] text-slate-500 dark:text-slate-400">Overview</div>
                      <div className="mt-3 space-y-3">
                        <div className="rounded-[1.5rem] bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-slate-700/60 px-4 py-4">
                          <div className="text-xs text-slate-500 dark:text-slate-400">分类数量</div>
                          <div className="mt-1 font-[Outfit] text-3xl font-semibold text-slate-900 dark:text-white">{dashboardCategories.length}</div>
                        </div>
                        <div className="rounded-[1.5rem] bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-slate-700/60 px-4 py-4">
                          <div className="text-xs text-slate-500 dark:text-slate-400">书签栏</div>
                          <div className="mt-1 font-[Outfit] text-3xl font-semibold text-slate-900 dark:text-white">{bookmarkBarCategories.length}</div>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-[1.5rem] bg-gradient-to-br from-slate-900 to-slate-700 dark:from-slate-100 dark:to-slate-300 px-5 py-5 text-white dark:text-slate-900">
                      <div className="text-xs uppercase tracking-[0.24em] opacity-70">Quick Access</div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button onClick={() => setView('studio')} className="px-3 py-2 rounded-full bg-white/12 dark:bg-slate-900/10 border border-white/15 dark:border-slate-900/10 text-sm font-medium backdrop-blur-sm">AI 助手</button>
                        <button onClick={() => setView('music')} className="px-3 py-2 rounded-full bg-white/12 dark:bg-slate-900/10 border border-white/15 dark:border-slate-900/10 text-sm font-medium backdrop-blur-sm">音乐中心</button>
                        <button onClick={() => setView('guestbook')} className="px-3 py-2 rounded-full bg-white/12 dark:bg-slate-900/10 border border-white/15 dark:border-slate-900/10 text-sm font-medium backdrop-blur-sm">留言板</button>
                      </div>
                    </div>
                  </aside>
                </div>

                <div className="w-full pb-16">
                   {isLoadingBookmarks ? (
                     <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500"></div>
                     </div>
                   ) : (
                     <LinkGrid categories={dashboardCategories} />
                   )}
                </div>
              </div>
            </main>

            <button
              onClick={scrollToTop}
              className={`fixed bottom-8 right-8 p-3 rounded-full shadow-lg bg-[rgba(255,250,242,0.86)] dark:bg-[rgba(9,20,28,0.82)] backdrop-blur-xl border border-[rgba(148,114,70,0.14)] dark:border-[rgba(94,234,212,0.12)] text-slate-700 dark:text-slate-200 z-30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:bg-white
                ${showScrollTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'}
              `}
              aria-label="Back to top"
            >
              <ArrowUp size={20} />
            </button>
          </div>
        )}

        {/* VIEW: STUDIO */}
        {view === 'studio' && (
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
        )}

        {/* VIEW: GUESTBOOK */}
        {view === 'guestbook' && (
           <div className="flex-1 h-full overflow-hidden">
             <Guestbook />
           </div>
        )}

        {/* VIEW: BOOKMARKS MANAGEMENT */}
        {view === 'bookmarks' && (
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
        )}

        {/* VIEW: MUSIC (Always mounted for background playback) */}
        <MusicPlatform 
           activeView={view as any}
           onViewChange={(v) => setView(v)}
           requestedTab={musicTabRequest}
           onTabChangeHandled={handleMusicTabReset}
           onAuthRequest={() => setIsAuthModalOpen(true)}
        />

      </div>

      {/* Modals */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
      
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

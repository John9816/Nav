import React, { useState, useEffect, useCallback, lazy, Suspense } from 'react';
import SearchBar from './components/SearchBar';
import LinkGrid from './components/LinkGrid';
import Weather from './components/Weather';
import Sidebar from './components/Sidebar';
import DailyQuote from './components/DailyQuote';
import AuthModal from './components/AuthModal';
import BookmarkBar from './components/BookmarkBar'; // Import BookmarkBar
import { CategoryModal, LinkModal } from './components/BookmarkModals';
import { DEFAULT_CATEGORIES } from './constants';
import { Category, LinkItem, ChatMessage, SharedSongRequest } from './types';
import { ArrowUp, Sun, Moon, Sparkles, Music, Home, LogOut, LogIn, Heart, Settings, History, MessageSquareQuote, Menu, BookOpen } from 'lucide-react';
import { useAuth } from './contexts/AuthContext';
import { 
  fetchUserBookmarks, 
  addCategory, updateCategory, deleteCategory,
  addLink, updateLink, deleteLink, getColorClass
} from './services/bookmarkService';
import { getIconByName } from './utils/iconMap';
import { parseSharedSongRequest } from './utils/musicShare';

const AIStudio = lazy(() => import('./components/AIStudio'));
const MusicPlatform = lazy(() => import('./components/MusicPlatform'));
const BookmarkManager = lazy(() => import('./components/BookmarkManager'));
const Guestbook = lazy(() => import('./components/Guestbook'));
const SparkCollection = lazy(() => import('./components/SparkCollection'));

const ViewLoader: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900">
    <div className="flex flex-col items-center gap-4 text-slate-400">
      <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500 dark:border-slate-700 dark:border-t-blue-400"></div>
      <p className="text-sm">{label}</p>
    </div>
  </div>
);

function App() {
  const initialSharedSongRequest = typeof window === 'undefined'
    ? null
    : parseSharedSongRequest(window.location.href);

  const [view, setView] = useState<'dashboard' | 'studio' | 'music' | 'bookmarks' | 'guestbook' | 'sparks'>(
    initialSharedSongRequest ? 'music' : 'dashboard'
  );
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
  const [sharedSongRequest, setSharedSongRequest] = useState<SharedSongRequest | null>(initialSharedSongRequest);
  
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

  const [hasLoadedMusicPlatform, setHasLoadedMusicPlatform] = useState(Boolean(initialSharedSongRequest));

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
    if (view === 'music' || musicTabRequest !== null || sharedSongRequest !== null) {
      setHasLoadedMusicPlatform(true);
    }
  }, [view, musicTabRequest, sharedSongRequest]);

  useEffect(() => {
    if (sharedSongRequest) {
      setView('music');
    }
  }, [sharedSongRequest]);

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
        if (view === 'bookmarks' || view === 'sparks') setView('dashboard'); // Redirect if managing
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

  const handleSharedSongHandled = useCallback(() => {
    setSharedSongRequest(null);
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
    <div className={`h-screen font-sans transition-colors duration-300 flex flex-col
      bg-slate-50 text-slate-800 selection:bg-blue-500/30
      dark:bg-slate-900 dark:text-slate-100
    `}>
      
      {/* Background Ambience */}
      <div className="fixed inset-0 z-0 pointer-events-none overflow-hidden transition-opacity duration-500">
         <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-200/40 rounded-full blur-[100px] opacity-60 dark:opacity-0 transition-opacity duration-500 animate-blob"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-200/40 rounded-full blur-[100px] opacity-50 dark:opacity-0 transition-opacity duration-500 animate-blob animation-delay-2000"></div>
         <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-emerald-200/30 rounded-full blur-[100px] opacity-40 dark:opacity-0 transition-opacity duration-500 animate-blob animation-delay-4000"></div>

         <div className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] bg-blue-900/20 rounded-full blur-[100px] opacity-0 dark:opacity-40 transition-opacity duration-500 animate-blob"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-purple-900/20 rounded-full blur-[100px] opacity-0 dark:opacity-30 transition-opacity duration-500 animate-blob animation-delay-2000"></div>
         <div className="absolute top-[20%] left-[20%] w-[300px] h-[300px] bg-emerald-900/10 rounded-full blur-[100px] opacity-0 dark:opacity-20 transition-opacity duration-500 animate-blob animation-delay-4000"></div>
      </div>

      {/* FIXED TOP NAVIGATION BAR */}
      <header className="shrink-0 z-50 h-16 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 transition-all duration-300">
        
        {/* Left: Menu Toggle (Mobile Only) */}
        <div className="flex items-center gap-2">
            {view === 'dashboard' && (
                <button 
                    onClick={() => setIsMobileSidebarOpen(true)}
                    className="md:hidden p-2 -ml-2 rounded-lg text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors"
                >
                    <Menu size={20} />
                </button>
            )}
            <div className="w-2 md:w-8"></div>
        </div>

        {/* Center: Main Navigation Tabs */}
        <nav className="flex items-center gap-1 sm:gap-2 p-1 bg-slate-100/50 dark:bg-slate-800/50 rounded-full border border-slate-200/50 dark:border-slate-700/50 overflow-x-auto max-w-[60vw] scrollbar-hide">
           <button
             onClick={() => setView('dashboard')}
             className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'dashboard'
                 ? 'bg-white text-blue-600 shadow-sm dark:bg-slate-700 dark:text-blue-400'
                 : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
               }
             `}
           >
             <Home size={16} />
             <span className="hidden sm:inline">导航</span>
           </button>
           <button
             onClick={() => setView('studio')}
             className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'studio'
                 ? 'bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-purple-400'
                 : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
               }
             `}
           >
             <Sparkles size={16} />
             <span className="hidden sm:inline">AI助手</span>
           </button>
           <button
             onClick={() => setView('music')}
             className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'music'
                 ? 'bg-white text-red-600 shadow-sm dark:bg-slate-700 dark:text-red-400'
                 : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
               }
             `}
           >
             <Music size={16} />
             <span className="hidden sm:inline">音乐</span>
           </button>
           <button
             onClick={() => setView('guestbook')}
             className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'guestbook'
                 ? 'bg-white text-emerald-600 shadow-sm dark:bg-slate-700 dark:text-emerald-400'
                 : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
               }
             `}
           >
             <MessageSquareQuote size={16} />
             <span className="hidden sm:inline">留言</span>
           </button>
           <button
             onClick={() => setView('sparks')}
             className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-full text-sm font-medium transition-all duration-300 flex items-center gap-2 whitespace-nowrap
               ${view === 'sparks'
                 ? 'bg-white text-amber-600 shadow-sm dark:bg-slate-700 dark:text-amber-400'
                 : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/50 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-700/50'
               }
             `}
           >
             <BookOpen size={16} />
             <span className="hidden sm:inline">灵感</span>
           </button>
        </nav>

        {/* Right: Weather & Theme & User */}
        <div className="flex items-center gap-3 sm:gap-4">
           {/* Weather Compact Widget */}
           <div className="hidden md:block">
              <Weather compact={true} />
           </div>

           <div className="h-6 w-px bg-slate-200 dark:bg-slate-700 hidden md:block"></div>

           <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          
          {/* User Auth Section */}
          <div className="relative">
            {user ? (
               <div className="relative">
                 <button 
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 p-1 pl-2 pr-1 rounded-full bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 transition-colors"
                 >
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-300 hidden md:block max-w-[100px] truncate">
                      {/* Priority: Nickname > Username > Email Part */}
                      {profile?.nickname || profile?.username || user.email?.split('@')[0]}
                    </span>
                    {profile?.avatar_url ? (
                       <img 
                          src={profile.avatar_url} 
                          alt="Avatar" 
                          className="w-8 h-8 rounded-full object-cover shadow-md bg-white border border-slate-200 dark:border-slate-700"
                       />
                    ) : (
                       <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-md">
                          {(profile?.nickname || user.email || 'U').charAt(0).toUpperCase()}
                       </div>
                    )}
                 </button>
                 
                 {showUserMenu && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)}></div>
                      <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                         <div className="p-4 border-b border-slate-100 dark:border-slate-700">
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
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700/50"
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
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700/50"
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
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700/50"
                         >
                            <History size={16} className="text-blue-500" />
                            <span>播放历史</span>
                         </button>

                         <button 
                            onClick={() => { 
                                setView('sparks');
                                setShowUserMenu(false); 
                            }}
                            className="w-full flex items-center gap-2 px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700 transition-colors border-b border-slate-50 dark:border-slate-700/50"
                         >
                            <BookOpen size={16} className="text-amber-500" />
                            <span>灵感记录</span>
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
                 className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-md shadow-blue-500/20 transition-all hover:shadow-lg"
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
          <div className="shrink-0 z-50 border-b border-slate-200 dark:border-slate-800 relative">
             {/* Background with blur - separate layer to avoid clipping children in some browsers */}
             <div className="absolute inset-0 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm -z-10" />
             
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
              ${isSidebarCollapsed ? 'md:pl-16' : 'md:pl-56'}
              pl-0 
            `}>
              <div className="w-full mx-auto px-4 sm:px-8 md:px-12 py-10 space-y-12">
                {/* Hero Section */}
                <div className="flex flex-col items-center justify-center space-y-8 py-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="text-center flex flex-col items-center select-none">
                    <div className="text-6xl md:text-8xl font-extrabold tracking-tighter drop-shadow-sm
                      text-slate-800 dark:text-slate-100
                      bg-clip-text text-transparent bg-gradient-to-b from-slate-700 to-slate-900 dark:from-white dark:to-slate-300
                    ">
                      {currentTime ? formatTime(currentTime) : <span className="opacity-0">00:00</span>}
                    </div>
                    <div className="mt-2 text-xs md:text-sm font-bold tracking-[0.2em] uppercase
                      text-slate-500 dark:text-slate-400
                    ">
                      {currentTime ? formatDate(currentTime) : <span className="opacity-0">Loading...</span>}
                    </div>
                  </div>

                  <div className="w-full max-w-xl transform hover:scale-[1.01] transition-transform duration-300">
                     <SearchBar />
                  </div>

                  <DailyQuote />
                  
                  {/* Mobile Weather Fallback */}
                  <div className="md:hidden mt-4">
                     <Weather compact={false} />
                  </div>
                </div>

                <div className="w-full pb-16">
                   {isLoadingBookmarks ? (
                     <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
                     </div>
                   ) : (
                     <LinkGrid categories={dashboardCategories} />
                   )}
                </div>
              </div>
            </main>

            <button
              onClick={scrollToTop}
              className={`fixed bottom-8 right-8 p-3 rounded-full shadow-lg bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 z-30 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl
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
             <Suspense fallback={<ViewLoader label="正在加载 AI Studio..." />}>
               <AIStudio 
                chatHistory={chatHistory}
                setChatHistory={setChatHistory}
                imageHistory={imageHistory}
                setImageHistory={setImageHistory}
                currentSessionId={currentSessionId}
                setCurrentSessionId={setCurrentSessionId}
               />
             </Suspense>
          </div>
        )}

        {/* VIEW: GUESTBOOK */}
        {view === 'guestbook' && (
           <div className="flex-1 h-full overflow-hidden">
             <Suspense fallback={<ViewLoader label="正在加载留言页..." />}>
               <Guestbook />
             </Suspense>
           </div>
        )}

        {/* VIEW: SPARK NOTES */}
        {view === 'sparks' && (
           <div className="flex-1 h-full overflow-hidden">
             <Suspense
               fallback={
                 <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900">
                   <div className="flex flex-col items-center gap-4 text-slate-400">
                     <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-amber-500 dark:border-slate-700 dark:border-t-amber-400"></div>
                     <p className="text-sm">正在加载灵感编辑器...</p>
                   </div>
                 </div>
               }
             >
               <SparkCollection onAuthRequest={() => setIsAuthModalOpen(true)} />
             </Suspense>
           </div>
        )}

        {/* VIEW: BOOKMARKS MANAGEMENT */}
        {view === 'bookmarks' && (
           <div className="flex-1 h-full overflow-hidden">
             <Suspense fallback={<ViewLoader label="正在加载导航管理..." />}>
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
             </Suspense>
           </div>
        )}

        {/* VIEW: MUSIC (Always mounted for background playback) */}
        {hasLoadedMusicPlatform && (
          <Suspense fallback={<ViewLoader label="正在加载音乐页面..." />}>
            <MusicPlatform 
               activeView={view as any}
               onViewChange={(v) => setView(v)}
               requestedTab={musicTabRequest}
               sharedSongRequest={sharedSongRequest}
               onTabChangeHandled={handleMusicTabReset}
               onSharedSongHandled={handleSharedSongHandled}
               onAuthRequest={() => setIsAuthModalOpen(true)}
            />
          </Suspense>
        )}

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

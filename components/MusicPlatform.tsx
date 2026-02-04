import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Song, Playlist, LyricLine } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  fetchSongUrl, fetchSongDetail, fetchLyrics, 
  fetchPlaylistDetails, checkGuestLimit, addToHistory, getHistory,
  fetchTopLists, searchSongs, getLikedSongs, toggleLike, checkIsLiked, parseLyrics
} from '../services/musicService';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, 
  List, Download, Search, Loader2,
  Music, Disc, Radio, ArrowLeft, Clock, Mic2, LayoutGrid, Heart, Cloud,
  ChevronDown, Repeat1
} from 'lucide-react';

interface MusicPlatformProps {
  activeView: 'dashboard' | 'studio' | 'music' | 'bookmarks' | 'guestbook';
  onViewChange: (view: any) => void;
  requestedTab: 'favorites' | 'history' | null;
  onTabChangeHandled: () => void;
  onAuthRequest: () => void;
}

const GUEST_PLAY_LIMIT = 20;

const MusicPlatform: React.FC<MusicPlatformProps> = ({ 
  activeView, onViewChange, requestedTab, onTabChangeHandled, onAuthRequest 
}) => {
  const { user } = useAuth();
  
  // Data State
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  
  // Player State
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'loop' | 'single' | 'shuffle'>('loop');
  const [quality, setQuality] = useState('flac');
  const [showQualityMenu, setShowQualityMenu] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.8);
  const [isLiked, setIsLiked] = useState(false);
  
  // UI State
  const [view, setView] = useState<'home' | 'playlist' | 'history' | 'search' | 'favorites'>('home');
  const [chartFilter, setChartFilter] = useState<'all' | 'netease' | 'qq'>('all');
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  
  // Lyrics State
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [rawLyric, setRawLyric] = useState<string>(''); // Store raw lyric text for DB saving
  const [showLyrics, setShowLyrics] = useState(false);
  const lyricsContainerRef = useRef<HTMLDivElement>(null);

  const [loading, setLoading] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restoreTimeRef = useRef(0);

  // Load Charts on Mount
  useEffect(() => {
    fetchTopLists().then(setPlaylists);
  }, []);

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.volume = volume;
    }
  }, [volume]);

  // Handle Tab Requests
  useEffect(() => {
      if (requestedTab === 'history') {
          loadHistory();
          setView('history');
          onTabChangeHandled();
      } else if (requestedTab === 'favorites') {
          loadFavorites();
          onTabChangeHandled();
      }
  }, [requestedTab, onTabChangeHandled]);

  // Check Liked Status on Song Change
  useEffect(() => {
    if (currentSong && user) {
        checkIsLiked(user.id, currentSong.id).then(setIsLiked);
    } else {
        setIsLiked(false);
    }
  }, [currentSong?.id, user]);

  // Determine active lyric index
  const activeLyricIndex = useMemo(() => {
      if (!lyrics.length) return -1;
      let idx = -1;
      for (let i = 0; i < lyrics.length; i++) {
          if (lyrics[i].time <= progress) {
              idx = i;
          } else {
              break;
          }
      }
      return idx;
  }, [lyrics, progress]);

  // Auto-scroll lyrics
  useEffect(() => {
      if (showLyrics && activeLyricIndex !== -1 && lyricsContainerRef.current) {
          const container = lyricsContainerRef.current;
          const activeNode = container.children[activeLyricIndex] as HTMLElement;
          if (activeNode) {
              activeNode.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
              });
          }
      }
  }, [activeLyricIndex, showLyrics]);

  // Auto-hide lyrics if empty
  useEffect(() => {
      if (lyrics.length === 0 && showLyrics) {
          setShowLyrics(false);
      }
  }, [lyrics, showLyrics]);

  const loadHistory = async () => {
      if (!user) return;
      setLoading(true);
      const songs = await getHistory(user.id);
      setPlaylistSongs(songs);
      setLoading(false);
      setView('history');
  };

  const loadFavorites = async () => {
      if (!user) {
          if (onAuthRequest) onAuthRequest();
          return;
      }
      setLoading(true);
      const songs = await getLikedSongs(user.id);
      setPlaylistSongs(songs);
      setLoading(false);
      setView('favorites');
  };

  const handleSearch = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!searchQuery.trim()) return;
      setView('search');
      setLoading(true);
      const songs = await searchSongs(searchQuery);
      setSearchResults(songs);
      setLoading(false);
  };

  const handleAudioError = (msg: string) => {
    console.error("Audio Error:", msg);
    setErrorCount(prev => prev + 1);
    if (errorCount < 3) {
        setTimeout(() => playNext(), 1000);
    } else {
        setToastMessage("播放出错，已跳过");
        setErrorCount(0);
        playNext();
    }
  };

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) {
        if (onAuthRequest) onAuthRequest();
        return;
    }
    if (!currentSong) return;
    
    // Optimistic Update
    const newStatus = !isLiked;
    setIsLiked(newStatus);
    
    try {
        // Pass rawLyric to save it in DB if adding
        const result = await toggleLike(user.id, currentSong, rawLyric);
        if (result !== newStatus) setIsLiked(result); 
        
        // If unliking while in favorites view, remove from list
        if (view === 'favorites' && !result) {
            setPlaylistSongs(prev => prev.filter(s => String(s.id) !== String(currentSong.id)));
        }
        // If liking and in favorites (edge case, usually means re-adding), add to top
        if (view === 'favorites' && result) {
            setPlaylistSongs(prev => [currentSong, ...prev]);
        }
    } catch (e) {
        setIsLiked(!newStatus);
        console.error("Toggle like failed", e);
    }
  };

  // Player Controls
  const playSong = async (song: Song, newQueue?: Song[]) => {
    let currentQueue = newQueue || queue;
    if (newQueue) {
      setQueue(newQueue);
    }

    if (currentSong?.id === song.id) {
      if (audioRef.current) {
          if (isPlaying) {
              audioRef.current.pause();
              setIsPlaying(false);
          } else {
              audioRef.current.play();
              setIsPlaying(true);
          }
      }
      return;
    }

    if (!user) {
        setCheckingLimit(true);
        setToastMessage("正在验证试听权限...");
        try {
            const { allowed, count } = await checkGuestLimit();
            setCheckingLimit(false);

            if (!allowed) {
               setToastMessage(null);
               if (confirm(`试听次数已用完（总共${GUEST_PLAY_LIMIT}首）。\n\n您的 IP 试听额度已达上限。\n登录账号即可解锁无限畅听。\n\n是否立即登录？`)) {
                   if (onAuthRequest) onAuthRequest();
               }
               return;
            }
            setToastMessage(`试听模式：${count} / ${GUEST_PLAY_LIMIT} 首`);
        } catch (e) {
            console.error("Guest check failed", e);
            setCheckingLimit(false);
        }
    }

    setIsPlaying(false); 
    setErrorCount(0);
    setProgress(0);
    setLyrics([]); // Clear lyrics immediately
    setRawLyric('');
    restoreTimeRef.current = 0; 
    
    setCurrentSong(song);

    // Metadata Fetching Optimization:
    // Only fetch details if cover is missing or name is unknown.
    // If song comes from DB (History/Likes), it usually has full metadata.
    const needsMetadata = !song.al.picUrl || song.al.picUrl.includes('default') || song.name === 'Unknown Title';

    if (needsMetadata) {
        fetchSongDetail(song.id, song.source).then(detail => {
            if (detail) {
                setCurrentSong(prev => {
                    if (!prev || String(prev.id) !== String(song.id)) return prev;
                    const newAl = {
                        id: detail.al.id || prev.al.id,
                        name: (detail.al.name && detail.al.name !== 'Unknown Album') ? detail.al.name : prev.al.name,
                        picUrl: detail.al.picUrl || prev.al.picUrl
                    };
                    const newAr = (detail.ar && detail.ar.length > 0 && detail.ar[0].name !== 'Unknown Artist') ? detail.ar : prev.ar;
                    return {
                        ...prev,
                        name: (detail.name && detail.name !== 'Unknown Title') ? detail.name : prev.name,
                        ar: newAr,
                        al: newAl,
                        dt: detail.dt || prev.dt,
                        url: prev.url || detail.url 
                    };
                });
            }
        });
    }

    // Lyrics Fetching Logic:
    // If lyric is already present (from DB), parse it directly.
    // Otherwise fetch from API.
    let lyricTextForSave = song.lyric || '';

    if (song.lyric) {
        setLyrics(parseLyrics(song.lyric));
        setRawLyric(song.lyric);
    } else {
        fetchLyrics(song.id, song.source).then(({ lines, raw }) => {
            setLyrics(lines);
            setRawLyric(raw);
            // Late save for lyrics if we fetched them
            if (user && raw) {
                 addToHistory(user.id, song, raw);
            }
        });
    }

    if (user) {
        // Save to history immediately with whatever lyric we have so far
        addToHistory(user.id, song, lyricTextForSave).then(() => {
             if (view === 'history') {
                 loadHistory();
             }
        });
    }

    let url = song.url;
    // Single resolve request "Parse One by One"
    const fetchedUrl = await fetchSongUrl(song.id, song.source, quality);
    if (fetchedUrl) url = fetchedUrl;

    if (url) {
      setCurrentSong(prev => (prev && prev.id === song.id ? { ...prev, url } : prev));
      setIsPlaying(true);
    } else {
      handleAudioError("No URL found");
    }
  };

  const changeQuality = async (q: string) => {
    setShowQualityMenu(false);
    if (quality === q || !currentSong) {
        setQuality(q);
        return;
    }
    setQuality(q);
    const currentTime = audioRef.current?.currentTime || 0;
    restoreTimeRef.current = currentTime;
    const url = await fetchSongUrl(currentSong.id, currentSong.source, q);
    if (url) {
        setCurrentSong(prev => prev ? { ...prev, url } : null);
    }
  };

  const handleDownload = async (e: React.MouseEvent, song: Song) => {
    e.stopPropagation();
    const url = await fetchSongUrl(song.id, song.source, quality);
    if (url) {
      window.open(url, '_blank');
    } else {
      alert("无法获取下载链接");
    }
  };

  const handleSongEnd = () => {
      if (playMode === 'single') {
          if (audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play();
          }
      } else {
          playNext();
      }
  };

  const playNext = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    let nextIndex = 0;

    if (playMode === 'shuffle') {
        nextIndex = Math.floor(Math.random() * queue.length);
        if (queue.length > 1 && nextIndex === currentIndex) {
            nextIndex = (nextIndex + 1) % queue.length;
        }
    } else {
        if (currentIndex >= 0) {
            nextIndex = (currentIndex + 1) % queue.length;
        }
    }
    playSong(queue[nextIndex]);
  };

  const playPrev = () => {
    if (!currentSong || queue.length === 0) return;
    const currentIndex = queue.findIndex(s => s.id === currentSong.id);
    let prevIndex = 0;

    if (currentIndex >= 0) {
        prevIndex = (currentIndex - 1 + queue.length) % queue.length;
    }
    playSong(queue[prevIndex]);
  };

  const playAll = (songs: Song[]) => {
    if (songs.length > 0) {
      playSong(songs[0], songs);
    }
  };

  const togglePlayMode = () => {
    if (playMode === 'loop') setPlayMode('single');
    else if (playMode === 'single') setPlayMode('shuffle');
    else setPlayMode('loop');
  };

  const openPlaylist = async (list: Playlist) => {
    setSelectedPlaylist(list);
    setView('playlist');
    setLoading(true);
    setPlaylistSongs([]);
    
    // Pass source to fetchPlaylistDetails (netease or qq)
    let songs = await fetchPlaylistDetails(list.id, list.source);
    
    // Removed batch resolving to support "parse one by one when playing"
    // Songs will have undefined URLs initially, and will be resolved when playSong is called.
    
    setPlaylistSongs(songs);
    setLoading(false);
  };

  // Filter playlists based on selected chart filter
  const displayedPlaylists = playlists.filter(p => {
    if (chartFilter === 'all') return true;
    return p.source === chartFilter;
  });

  return (
    <div 
      className={`fixed inset-0 z-40 bg-slate-50 dark:bg-slate-900 flex flex-col pt-16 transition-all duration-300 ease-in-out
        ${activeView === 'music' 
           ? 'opacity-100 translate-y-0 visible pointer-events-auto' 
           : 'opacity-0 translate-y-4 invisible pointer-events-none'
        }
      `}
    >
       
       {/* Main Content Area */}
       <div className="flex-1 flex overflow-hidden relative">
           
           {/* Sidebar */}
           <div className="w-64 bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 flex flex-col hidden md:flex shrink-0">
               <div className="p-4 space-y-6 overflow-y-auto custom-scrollbar flex-1">
                   
                   {/* Library Section */}
                   <div>
                       <div className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">我的音乐</div>
                       <div className="space-y-1">
                           <button 
                             onClick={() => { setView('home'); setChartFilter('all'); }} 
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'home' && chartFilter === 'all' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <LayoutGrid size={18} /> 发现音乐
                           </button>
                           <button 
                             onClick={loadFavorites}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'favorites' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <Heart size={18} /> 我喜欢的音乐
                           </button>
                           <button 
                             onClick={loadHistory}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${view === 'history' ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <Clock size={18} /> 最近播放
                           </button>
                       </div>
                   </div>

                   {/* Charts Section */}
                   <div>
                       <div className="px-3 mb-2 text-xs font-bold text-slate-400 uppercase tracking-wider">精选榜单</div>
                       <div className="space-y-1">
                           {/* Netease Button */}
                           <button 
                             onClick={() => { setView('home'); setChartFilter('netease'); }}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors 
                               ${view === 'home' && chartFilter === 'netease' 
                                 ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400' 
                                 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors border border-current opacity-80 ${view === 'home' && chartFilter === 'netease' ? 'text-red-600' : 'text-slate-400 border-slate-300'}`}>
                                  <Cloud size={14} fill="currentColor" />
                               </div>
                               <span>网易云音乐</span>
                           </button>

                           {/* QQ Music Button */}
                           <button 
                             onClick={() => { setView('home'); setChartFilter('qq'); }}
                             className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors 
                               ${view === 'home' && chartFilter === 'qq' 
                                 ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400' 
                                 : 'text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                           >
                               <div className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors border border-current opacity-80 ${view === 'home' && chartFilter === 'qq' ? 'text-green-600' : 'text-slate-400 border-slate-300'}`}>
                                  <Music size={14} fill="currentColor" />
                               </div>
                               <span>QQ 音乐</span>
                           </button>
                       </div>
                   </div>
               </div>
           </div>

           {/* Content View */}
           <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 relative">
               
               {/* NEW: Internal Toolbar for Search and Navigation */}
               <div className="sticky top-0 z-20 px-6 py-4 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm border-b border-slate-100 dark:border-slate-800/50 flex items-center gap-4">
                    {view !== 'home' && (
                        <button onClick={() => setView('home')} className="p-2 hover:bg-slate-200 dark:hover:bg-slate-800 rounded-full transition-colors">
                           <ArrowLeft size={20} className="text-slate-600 dark:text-slate-300" />
                        </button>
                    )}
                    
                    {/* Search Input */}
                    <form onSubmit={handleSearch} className="flex-1 relative group max-w-xl">
                      <input 
                        type="text" 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="搜索歌曲、歌手、专辑..."
                        className="w-full pl-10 pr-4 py-2.5 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm focus:ring-2 focus:ring-red-500/30 transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm"
                      />
                      <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                    </form>
               </div>

               {/* Ambient Background Blur */}
               {currentSong && (
                   <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                       <div className="absolute -top-[20%] -right-[20%] w-[80%] h-[80%] opacity-5 dark:opacity-10 blur-[120px] rounded-full" style={{ backgroundColor: view === 'home' ? '#ef4444' : 'currentColor', color: 'inherit' }}></div>
                   </div>
               )}

               {/* Lyrics Overlay */}
               {showLyrics && currentSong && lyrics.length > 0 && (
                   <div className="absolute inset-0 z-30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl flex flex-col md:flex-row items-center justify-center p-8 gap-8 md:gap-16 animate-in fade-in slide-in-from-bottom-4 duration-300">
                       <button 
                           onClick={() => setShowLyrics(false)}
                           className="absolute top-6 right-6 p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                       >
                           <ChevronDown size={24} />
                       </button>
                       
                       {/* Cover Art */}
                       <div className="w-64 h-64 md:w-96 md:h-96 shrink-0 rounded-2xl shadow-2xl overflow-hidden relative group hidden md:block">
                           <img src={currentSong.al.picUrl} className="w-full h-full object-cover" />
                       </div>

                       {/* Lyrics Scroll Area */}
                       <div className="flex-1 h-full max-h-[60vh] w-full max-w-xl relative" style={{ maskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)', WebkitMaskImage: 'linear-gradient(to bottom, transparent, black 15%, black 85%, transparent)' }}> 
                          <div 
                            ref={lyricsContainerRef}
                            className="h-full overflow-y-auto no-scrollbar text-center space-y-6 py-[50%]"
                            style={{ scrollBehavior: 'smooth', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                          >
                              {lyrics.map((line, i) => (
                                  <p 
                                    key={i}
                                    className={`transition-all duration-300 cursor-pointer px-4
                                       ${i === activeLyricIndex 
                                          ? 'text-xl md:text-2xl font-bold text-slate-800 dark:text-white scale-105' 
                                          : 'text-sm md:text-base font-medium text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                                       }
                                    `}
                                    onClick={() => {
                                        if(audioRef.current) audioRef.current.currentTime = line.time;
                                    }}
                                  >
                                      {line.text}
                                  </p>
                              ))}
                          </div>
                       </div>
                   </div>
               )}

               <div className="p-6 md:p-8 lg:p-10 relative z-10 min-h-full pb-32">
                   {loading ? (
                       <div className="flex flex-col items-center justify-center h-64 text-slate-400 gap-3">
                           <Loader2 className="animate-spin text-red-500" size={32} />
                           <p className="text-sm">加载精彩内容...</p>
                       </div>
                   ) : (
                       <>
                           {(view === 'playlist' || view === 'history' || view === 'search' || view === 'favorites') && (
                               <div className="max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                                   <div className="flex flex-col md:flex-row items-start md:items-end justify-between mb-8 gap-4">
                                        <div className="flex items-center gap-4">
                                            {view === 'playlist' && selectedPlaylist ? (
                                                <div className="w-32 h-32 rounded-2xl shadow-lg overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-800">
                                                    <img src={selectedPlaylist.coverImgUrl} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                                                </div>
                                            ) : (
                                                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg shrink-0
                                                    ${view === 'history' ? 'bg-blue-500 text-white' : view === 'favorites' ? 'bg-red-500 text-white' : 'bg-red-500 text-white'}
                                                `}>
                                                    {view === 'history' ? <Clock size={32} /> : view === 'favorites' ? <Heart size={32} /> : <Search size={32} />}
                                                </div>
                                            )}
                                            <div>
                                                <h2 className="text-2xl md:text-3xl font-bold text-slate-800 dark:text-slate-100 mb-1">
                                                    {view === 'history' ? '播放历史' : view === 'favorites' ? '我喜欢的音乐' : view === 'search' ? `搜索: "${searchQuery}"` : selectedPlaylist?.name}
                                                </h2>
                                                <p className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                                    {(view === 'search' ? searchResults : playlistSongs).length} 首歌曲
                                                    {view === 'playlist' && selectedPlaylist?.source === 'qq' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">QQ音乐</span>}
                                                    {view === 'playlist' && selectedPlaylist?.source === 'netease' && <span className="px-1.5 py-0.5 rounded text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">网易云</span>}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="flex gap-3">
                                            <button 
                                              onClick={() => playAll(view === 'search' ? searchResults : playlistSongs)}
                                              className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-full text-sm font-bold shadow-lg shadow-red-500/30 transition-all hover:scale-105 active:scale-95"
                                            >
                                                <Play size={18} fill="currentColor" /> 播放全部
                                            </button>
                                        </div>
                                   </div>

                                   <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                                       <div className="grid grid-cols-[50px_1fr_120px_60px] gap-4 px-6 py-3 border-b border-slate-100 dark:border-slate-700/50 text-xs font-bold text-slate-400 uppercase tracking-wider">
                                           <div className="text-center">#</div>
                                           <div>标题</div>
                                           <div className="hidden sm:block">专辑</div>
                                           <div className="text-right hidden sm:block">操作</div>
                                       </div>
                                       <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                           {(view === 'search' ? searchResults : playlistSongs).map((song, i) => (
                                               <div 
                                                 key={song.id} 
                                                 onClick={() => playSong(song, view === 'search' ? searchResults : playlistSongs)}
                                                 className={`group grid grid-cols-[50px_1fr_auto] sm:grid-cols-[50px_1fr_120px_60px] gap-4 px-6 py-3.5 items-center hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors cursor-pointer
                                                    ${currentSong?.id === song.id ? 'bg-red-50/50 dark:bg-red-900/10' : ''}
                                                 `}
                                               >
                                                   <div className="text-center text-sm font-medium text-slate-400 flex justify-center">
                                                      {currentSong?.id === song.id && isPlaying ? (
                                                          <div className="flex gap-0.5 items-end h-3">
                                                              <div className="w-1 bg-red-500 animate-[bounce_1s_infinite] h-2"></div>
                                                              <div className="w-1 bg-red-500 animate-[bounce_1.2s_infinite] h-3"></div>
                                                              <div className="w-1 bg-red-500 animate-[bounce_0.8s_infinite] h-1.5"></div>
                                                          </div>
                                                      ) : (
                                                          <span className="group-hover:hidden">{i + 1}</span>
                                                      )}
                                                      <Play size={14} className="hidden group-hover:block text-slate-600 dark:text-slate-300" fill="currentColor" />
                                                   </div>
                                                   <div className="min-w-0 pr-4 flex items-center gap-3">
                                                       {/* Song Cover */}
                                                       <div className="relative w-10 h-10 rounded-md overflow-hidden shrink-0 bg-slate-200 dark:bg-slate-700">
                                                            <img src={song.al.picUrl} className="w-full h-full object-cover" loading="lazy" referrerPolicy="no-referrer" />
                                                       </div>
                                                       <div className="min-w-0 flex-1">
                                                           <div className={`font-medium truncate text-sm mb-0.5 ${currentSong?.id === song.id ? 'text-red-600 dark:text-red-400' : 'text-slate-800 dark:text-slate-200'}`}>{song.name}</div>
                                                           <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-2">
                                                               {song.source === 'qq' && <span className="text-[9px] px-1 rounded border border-slate-200 dark:border-slate-600 text-slate-400">QQ</span>}
                                                               {song.source === 'netease' && <span className="text-[9px] px-1 rounded border border-slate-200 dark:border-slate-600 text-slate-400">WY</span>}
                                                               {song.ar.map(a => a.name).join(', ')}
                                                           </div>
                                                       </div>
                                                   </div>
                                                   <div className="text-xs text-slate-500 dark:text-slate-400 truncate hidden sm:block">{song.al.name}</div>
                                                   <div className="text-right hidden sm:block">
                                                       <button 
                                                         onClick={(e) => handleDownload(e, song)} 
                                                         className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
                                                         title="下载"
                                                       >
                                                           <Download size={16} />
                                                       </button>
                                                   </div>
                                               </div>
                                           ))}
                                       </div>
                                   </div>
                                   
                                   {(view === 'search' ? searchResults : playlistSongs).length === 0 && (
                                       <div className="text-center py-20 text-slate-400">
                                           <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                               <Disc size={32} className="opacity-20" />
                                           </div>
                                           <p>暂无内容</p>
                                       </div>
                                   )}
                               </div>
                           )}

                           {view === 'home' && (
                               <div className="max-w-[1600px] mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                                   <div className="flex items-center gap-2 mb-6">
                                       <div className="p-2 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg">
                                           <Radio size={20} />
                                       </div>
                                       <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                          {chartFilter === 'all' ? '热门推荐' : (chartFilter === 'netease' ? '网易云榜单' : 'QQ音乐榜单')}
                                       </h2>
                                   </div>
                                   
                                   {/* Compact Layout Grid */}
                                   <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 gap-3 sm:gap-4">
                                      {displayedPlaylists.map(list => (
                                          <div 
                                            key={list.id} 
                                            onClick={() => openPlaylist(list)}
                                            className="group cursor-pointer flex flex-col gap-2"
                                          >
                                              <div className="aspect-square rounded-xl overflow-hidden relative shadow-sm bg-slate-200 dark:bg-slate-800 group-hover:shadow-md group-hover:shadow-red-500/10 transition-all duration-300">
                                                  <img src={list.coverImgUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" loading="lazy" referrerPolicy="no-referrer" />
                                                  
                                                  {/* Overlay Play Button */}
                                                  <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                                                      <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-red-500 shadow-xl scale-75 group-hover:scale-100 transition-transform duration-300">
                                                          <Play fill="currentColor" size={18} className="ml-0.5" />
                                                      </div>
                                                  </div>
                                                  
                                                  {/* Count Badge */}
                                                  <div className="absolute top-1.5 right-1.5 px-1.5 py-0.5 bg-black/40 backdrop-blur-md rounded-md text-[9px] text-white font-medium flex items-center gap-0.5">
                                                      <Play size={8} fill="currentColor" />
                                                      {Math.floor(list.playCount / 10000)}万
                                                  </div>

                                                  {/* Source Badge */}
                                                  {list.source === 'qq' && (
                                                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-green-500/90 backdrop-blur-sm rounded text-[9px] text-white font-bold uppercase tracking-wider shadow-sm">
                                                        QQ
                                                    </div>
                                                  )}
                                                  {list.source === 'netease' && (
                                                    <div className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 bg-red-500/90 backdrop-blur-sm rounded text-[9px] text-white font-bold uppercase tracking-wider shadow-sm">
                                                        WY
                                                    </div>
                                                  )}
                                              </div>
                                              
                                              <div>
                                                  <h3 className="font-bold text-xs text-slate-700 dark:text-slate-200 line-clamp-1 leading-tight group-hover:text-red-500 transition-colors" title={list.name}>
                                                      {list.name}
                                                  </h3>
                                              </div>
                                          </div>
                                      ))}
                                   </div>
                               </div>
                           )}
                       </>
                   )}
               </div>
           </div>
       </div>

       {/* Bottom Player Bar - Glassmorphism */}
       <div className="shrink-0 h-24 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-t border-slate-200 dark:border-slate-800 flex items-center px-4 md:px-8 gap-6 z-50 relative shadow-[0_-5px_30px_-5px_rgba(0,0,0,0.1)]">
           
           {/* Progress Bar (Absolute Top) */}
           <div 
             className="absolute top-0 left-0 right-0 h-1 bg-slate-100 dark:bg-slate-800 cursor-pointer group"
             onClick={(e) => {
               if (audioRef.current && duration) {
                   const rect = e.currentTarget.getBoundingClientRect();
                   const p = (e.clientX - rect.left) / rect.width;
                   audioRef.current.currentTime = p * duration;
               }
             }}
           >
              <div 
                className="h-full bg-red-500 relative transition-all duration-100 ease-linear"
                style={{ width: `${(progress / duration) * 100}%` }}
              >
                 <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full shadow opacity-0 group-hover:opacity-100 transition-opacity transform scale-150"></div>
              </div>
           </div>

           {/* Song Info */}
           <div className="w-1/3 flex items-center gap-4">
               {currentSong ? (
                   <>
                       <div className={`relative w-14 h-14 rounded-lg shadow-md overflow-hidden shrink-0 ${isPlaying ? 'animate-spin-slow' : ''}`} style={{ animationDuration: '10s' }}>
                           <img src={currentSong.al.picUrl} alt="Cover" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                           <div className="absolute inset-0 bg-black/10 ring-1 ring-inset ring-white/10"></div>
                       </div>
                       <div className="min-w-0 flex flex-col justify-center">
                           <div className="font-bold text-slate-800 dark:text-slate-100 truncate text-base mb-0.5">{currentSong.name}</div>
                           <div className="text-xs text-slate-500 dark:text-slate-400 truncate font-medium">{currentSong.ar.map(a => a.name).join(', ')}</div>
                       </div>
                       <button 
                         onClick={handleLikeToggle}
                         className={`ml-2 transition-all active:scale-90 ${isLiked ? 'text-red-500' : 'text-slate-400 hover:text-red-500'} hidden sm:block`}
                       >
                           <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                       </button>
                   </>
               ) : (
                   <div className="flex items-center gap-3 opacity-50">
                       <div className="w-14 h-14 rounded-lg bg-slate-200 dark:bg-slate-800 flex items-center justify-center">
                           <Music size={24} className="text-slate-400" />
                       </div>
                       <span className="text-sm font-medium text-slate-400">准备播放</span>
                   </div>
               )}
           </div>

           {/* Controls */}
           <div className="flex-1 flex flex-col items-center justify-center max-w-lg">
               <div className="flex items-center gap-8">
                   <button onClick={togglePlayMode} className={`p-2 rounded-full transition-colors ${playMode !== 'loop' ? 'text-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>
                       {playMode === 'single' ? <Repeat1 size={18} /> : playMode === 'shuffle' ? <Shuffle size={18} /> : <Repeat size={18} />}
                   </button>
                   
                   <button onClick={playPrev} className="text-slate-700 dark:text-slate-200 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                       <SkipBack size={28} fill="currentColor" />
                   </button>
                   
                   <button 
                     onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} 
                     className="w-12 h-12 flex items-center justify-center bg-red-600 text-white rounded-full hover:bg-red-50 shadow-lg shadow-red-500/40 transition-all hover:scale-105 active:scale-95"
                   >
                       {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                   </button>
                   
                   <button onClick={playNext} className="text-slate-700 dark:text-slate-200 hover:text-red-500 dark:hover:text-red-400 transition-colors">
                       <SkipForward size={28} fill="currentColor" />
                   </button>

                   <div className="relative">
                       <button 
                         onClick={() => setShowQualityMenu(!showQualityMenu)} 
                         className={`text-xs font-bold border rounded px-1.5 py-0.5 transition-colors ${quality === 'flac' || quality === 'flac24bit' ? 'text-red-500 border-red-500 bg-red-50 dark:bg-red-900/20' : 'text-slate-400 border-slate-300 dark:border-slate-600 hover:text-slate-600'}`}
                       >
                           {quality === '320k' ? 'HQ' : (quality === '128k' ? 'SD' : 'SQ')}
                       </button>
                       {showQualityMenu && (
                           <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-24 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden animate-in fade-in zoom-in-95 py-1">
                               {['128k', '320k', 'flac'].map(q => (
                                   <button key={q} onClick={() => changeQuality(q)} className={`block w-full px-3 py-2 text-xs text-center hover:bg-slate-50 dark:hover:bg-slate-700 ${quality === q ? 'text-red-500 font-bold' : 'text-slate-600 dark:text-slate-300'}`}>
                                       {q.toUpperCase()}
                                   </button>
                               ))}
                           </div>
                       )}
                   </div>
               </div>
               <div className="text-xs text-slate-400 font-mono mt-1 tracking-wider">
                   {Math.floor(progress / 60)}:{String(Math.floor(progress % 60)).padStart(2, '0')} / {Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}
               </div>
           </div>

           {/* Volume */}
           <div className="w-1/3 flex items-center justify-end gap-3 group/vol">
               <button onClick={() => setVolume(v => v === 0 ? 0.8 : 0)}>
                  <Volume2 size={20} className={`transition-colors ${volume === 0 ? 'text-slate-300' : 'text-slate-500 dark:text-slate-400'}`} />
               </button>
               <div className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-full relative cursor-pointer overflow-hidden">
                   <div className="absolute inset-y-0 left-0 bg-slate-500 dark:bg-slate-400 rounded-full transition-all group-hover/vol:bg-red-500" style={{ width: `${volume * 100}%` }}></div>
                   <input 
                     type="range" 
                     min="0" max="1" step="0.05" 
                     value={volume} 
                     onChange={(e) => setVolume(parseFloat(e.target.value))}
                     className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                   />
               </div>
              <button 
                onClick={() => setShowLyrics(!showLyrics)} 
                className={`ml-2 p-2 transition-colors ${showLyrics ? 'text-red-500 bg-red-50 dark:bg-red-900/20 rounded-full' : 'text-slate-400 hover:text-red-500'}`}
                disabled={lyrics.length === 0}
              >
                 <Mic2 size={18} />
              </button>
           </div>
       </div>

       {toastMessage && (
           <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-slate-800/90 backdrop-blur text-white px-6 py-3 rounded-full text-sm shadow-xl animate-in fade-in slide-in-from-top-4 z-[100] flex items-center gap-2">
               <Disc size={16} className="animate-spin" />
               {toastMessage}
           </div>
       )}

       <audio 
         ref={audioRef}
         src={currentSong?.url}
         onPlay={() => setIsPlaying(true)}
         onPause={() => setIsPlaying(false)}
         onTimeUpdate={(e) => setProgress(e.currentTarget.currentTime)}
         onDurationChange={(e) => setDuration(e.currentTarget.duration)}
         onEnded={handleSongEnd}
         onError={() => handleAudioError("Playback Error")}
         onLoadedMetadata={() => {
             if (restoreTimeRef.current > 0 && audioRef.current) {
                 audioRef.current.currentTime = restoreTimeRef.current;
                 restoreTimeRef.current = 0;
             }
             if (isPlaying) audioRef.current?.play();
         }}
       />
    </div>
  );
};

export default MusicPlatform;
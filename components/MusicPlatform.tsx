import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Song, Playlist, LyricLine } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  resolveBatchUrls, fetchSongUrl, fetchSongDetail, fetchLyrics, 
  fetchPlaylistDetails, checkGuestLimit, addToHistory, getHistory,
  fetchTopLists, searchSongs
} from '../services/musicService';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, 
  List, Maximize2, Minimize2, Download, Search, Loader2, Heart,
  Music, Disc, X, Radio, ArrowLeft
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
  
  // UI State
  const [view, setView] = useState<'home' | 'playlist' | 'history' | 'search'>('home');
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [selectedPlaylist, setSelectedPlaylist] = useState<Playlist | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
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
          setView('home'); 
          onTabChangeHandled();
      }
  }, [requestedTab, onTabChangeHandled]);

  const loadHistory = async () => {
      if (!user) return;
      setLoading(true);
      const songs = await getHistory(user.id);
      setPlaylistSongs(songs);
      setLoading(false);
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

  // Player Controls
  const playSong = async (song: Song, newQueue?: Song[]) => {
    let currentQueue = newQueue || queue;
    if (newQueue) {
      setQueue(newQueue);
    }

    if (!song.url) {
        const idx = currentQueue.findIndex(s => s.id === song.id);
        if (idx !== -1) {
            const batchToResolve = currentQueue.slice(idx, idx + 20);
            const resolvedBatch = await resolveBatchUrls(batchToResolve, quality);
            const updateList = (list: Song[]) => {
                return list.map(s => {
                    const resolved = resolvedBatch.find(r => String(r.id) === String(s.id));
                    return resolved ? resolved : s;
                });
            };
            const updatedQueue = updateList(currentQueue);
            setQueue(updatedQueue);
            currentQueue = updatedQueue;
            setPlaylistSongs(prev => updateList(prev));
            // Also update search results if that's where we are
            if (view === 'search') {
                setSearchResults(prev => updateList(prev));
            }
            const updatedSong = resolvedBatch.find(s => String(s.id) === String(song.id));
            if (updatedSong) {
                song = updatedSong;
            }
        }
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
    setLyrics([]);
    setCurrentLyricIndex(-1);
    restoreTimeRef.current = 0; 
    
    setCurrentSong(song);

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

    if (user) {
        addToHistory(user.id, song).then(() => {
             if (view === 'history') {
                 loadHistory();
             }
        });
    }

    fetchLyrics(song.id, song.source).then(lines => {
        setLyrics(lines);
    });

    let url = song.url;
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
    
    const initialBatch = songs.slice(0, 20);
    if (initialBatch.length > 0) {
        const resolvedBatch = await resolveBatchUrls(initialBatch, quality);
        resolvedBatch.forEach((resolvedSong, index) => {
            if (index < songs.length) {
                songs[index] = resolvedSong;
            }
        });
    }
    
    setPlaylistSongs(songs);
    setLoading(false);
  };

  const neteasePlaylists = playlists.filter(p => p.source === 'netease' || !p.source);
  const qqPlaylists = playlists.filter(p => p.source === 'qq');

  return (
    <div className={`fixed inset-0 z-40 bg-white dark:bg-slate-900 flex flex-col transition-transform duration-300 ${activeView === 'music' ? 'translate-y-0' : 'translate-y-[100%]'}`}>
       {/* Background */}
       {currentSong && (
         <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10 dark:opacity-20">
           <img src={currentSong.al.picUrl} alt="Background" className="w-full h-full object-cover blur-[100px]" />
         </div>
       )}
       
       {/* Header with Search */}
       <div className="shrink-0 h-16 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-4 sm:px-6 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md gap-4">
           <div className="flex items-center gap-4 shrink-0">
               {view !== 'home' && (
                 <button onClick={() => setView('home')} className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors">
                    <ArrowLeft size={20} />
                 </button>
               )}
               <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-red-500 text-white rounded-lg">
                      <Music size={18} />
                  </div>
                  <h1 className="font-bold text-lg text-slate-800 dark:text-slate-100 hidden sm:block">Music Center</h1>
               </div>
           </div>

           <form onSubmit={handleSearch} className="flex-1 max-w-md relative group">
               <input 
                 type="text" 
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 placeholder="搜索歌曲、歌手..."
                 className="w-full pl-9 pr-4 py-2 rounded-full bg-slate-100 dark:bg-slate-800 border-none text-sm focus:ring-2 focus:ring-red-500/50 transition-all shadow-sm group-hover:shadow-md"
               />
               <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
           </form>

           <button onClick={() => onViewChange('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full shrink-0">
               <Minimize2 size={20} className="text-slate-500" />
           </button>
       </div>

       {/* Main Content */}
       <div className="flex-1 flex overflow-hidden z-10 relative">
           {/* Sidebar */}
           <div className="w-64 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col hidden md:flex">
               <div className="p-4 space-y-1">
                   <button 
                     onClick={() => setView('home')} 
                     className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${view === 'home' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                   >
                       <Radio size={16} /> 发现音乐
                   </button>
                   <button 
                     onClick={loadHistory}
                     className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${view === 'history' ? 'bg-red-50 text-red-500 dark:bg-red-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}
                   >
                       <List size={16} /> 播放历史
                   </button>
               </div>
               
               <div className="mt-2 px-4 text-xs font-bold text-slate-400 uppercase">官方榜单</div>
               <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                   {/* QQ Music */}
                   {qqPlaylists.length > 0 && (
                       <div className="mb-6">
                           <div className="px-2 mb-2 text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                               <span className="w-1 h-3 bg-green-500 rounded-full"></span>
                               QQ音乐榜单
                           </div>
                           <div className="space-y-0.5">
                               {qqPlaylists.map(pl => (
                                  <button 
                                    key={pl.id}
                                    onClick={() => openPlaylist(pl)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left truncate group transition-all
                                       ${selectedPlaylist?.id === pl.id && view === 'playlist' 
                                           ? 'bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400 font-medium' 
                                           : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                       }`}
                                  >
                                      <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-slate-200">
                                         <img src={pl.coverImgUrl} className="w-full h-full object-cover" loading="lazy" />
                                      </div>
                                      <span className="truncate flex-1">{pl.name}</span>
                                  </button>
                               ))}
                           </div>
                       </div>
                   )}

                   {/* Netease Music */}
                   {neteasePlaylists.length > 0 && (
                       <div className="mb-6">
                           <div className="px-2 mb-2 text-xs font-bold text-slate-400 uppercase flex items-center gap-2">
                               <span className="w-1 h-3 bg-red-500 rounded-full"></span>
                               网易云音乐榜单
                           </div>
                           <div className="space-y-0.5">
                               {neteasePlaylists.map(pl => (
                                  <button 
                                    key={pl.id}
                                    onClick={() => openPlaylist(pl)}
                                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left truncate group transition-all
                                       ${selectedPlaylist?.id === pl.id && view === 'playlist' 
                                           ? 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 font-medium' 
                                           : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                                       }`}
                                  >
                                      <div className="w-8 h-8 rounded overflow-hidden shrink-0 bg-slate-200">
                                         <img src={pl.coverImgUrl} className="w-full h-full object-cover" loading="lazy" />
                                      </div>
                                      <span className="truncate flex-1">{pl.name}</span>
                                  </button>
                               ))}
                           </div>
                       </div>
                   )}
                   
                   {playlists.length === 0 && (
                        <div className="text-center py-4 text-xs text-slate-400">加载榜单中...</div>
                   )}
               </div>
           </div>

           {/* List View */}
           <div className="flex-1 overflow-y-auto p-4 sm:p-6 custom-scrollbar">
               {loading && (
                   <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" /></div>
               )}
               
               {!loading && (
                   <>
                       {(view === 'playlist' || view === 'history' || view === 'search') && (
                           <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                               <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                        {view === 'history' ? '播放历史' : view === 'search' ? `"${searchQuery}" 的搜索结果` : selectedPlaylist?.name}
                                    </h2>
                                    <button 
                                      onClick={() => playAll(view === 'search' ? searchResults : playlistSongs)}
                                      className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors"
                                    >
                                        <Play size={16} fill="currentColor" /> 播放全部
                                    </button>
                               </div>
                               <div className="space-y-1">
                                   {(view === 'search' ? searchResults : playlistSongs).map((song, i) => (
                                       <div 
                                         key={song.id} 
                                         onClick={() => playSong(song, view === 'search' ? searchResults : playlistSongs)}
                                         className={`group flex items-center gap-4 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer ${currentSong?.id === song.id ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                                       >
                                           <div className="w-8 text-center text-sm text-slate-400">
                                              {currentSong?.id === song.id && isPlaying ? (
                                                  <div className="flex justify-center items-end gap-0.5 h-3">
                                                      <div className="w-1 bg-red-500 animate-[bounce_1s_infinite] h-2"></div>
                                                      <div className="w-1 bg-red-500 animate-[bounce_1.2s_infinite] h-3"></div>
                                                      <div className="w-1 bg-red-500 animate-[bounce_0.8s_infinite] h-1.5"></div>
                                                  </div>
                                              ) : (
                                                  i + 1
                                              )}
                                           </div>
                                           <div className="flex-1 min-w-0">
                                               <div className={`font-medium truncate ${currentSong?.id === song.id ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{song.name}</div>
                                               <div className="text-xs text-slate-400 truncate">{song.ar.map(a => a.name).join(', ')}</div>
                                           </div>
                                           <div className="text-xs text-slate-400 hidden sm:block w-32 truncate">{song.al.name}</div>
                                           <button onClick={(e) => handleDownload(e, song)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 opacity-0 group-hover:opacity-100 transition-opacity">
                                               <Download size={16} />
                                           </button>
                                       </div>
                                   ))}
                                   {(view === 'search' ? searchResults : playlistSongs).length === 0 && (
                                       <div className="text-center py-10 text-slate-400">暂无内容</div>
                                   )}
                               </div>
                           </div>
                       )}

                       {view === 'home' && (
                           <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                               <h2 className="text-lg font-bold text-slate-700 dark:text-slate-200 flex items-center gap-2">
                                  <List className="text-red-500" size={20} /> 热门榜单
                               </h2>
                               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                                  {/* Render all playlists in grid regardless of source */}
                                  {playlists.map(list => (
                                      <div 
                                        key={list.id} 
                                        onClick={() => openPlaylist(list)}
                                        className="group cursor-pointer space-y-2"
                                      >
                                          <div className="aspect-square rounded-xl overflow-hidden relative shadow-md bg-slate-200 dark:bg-slate-800">
                                              <img src={list.coverImgUrl} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" loading="lazy" />
                                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                                  <div className="w-10 h-10 bg-white/90 rounded-full flex items-center justify-center text-red-500 shadow-xl scale-50 group-hover:scale-100 transition-transform">
                                                      <Play fill="currentColor" size={16} className="ml-0.5" />
                                                  </div>
                                              </div>
                                              <div className="absolute top-2 right-2 px-1.5 py-0.5 bg-black/50 backdrop-blur rounded text-[10px] text-white font-medium flex items-center gap-1">
                                                  <Play size={8} fill="currentColor" />
                                                  {Math.floor(list.playCount / 10000)}万
                                              </div>
                                              {list.source === 'qq' && (
                                                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-green-500/80 backdrop-blur rounded text-[10px] text-white font-bold uppercase">
                                                    QQ
                                                </div>
                                              )}
                                              {list.source === 'netease' && (
                                                <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-red-500/80 backdrop-blur rounded text-[10px] text-white font-bold uppercase">
                                                    WY
                                                </div>
                                              )}
                                          </div>
                                          <div className="font-medium text-sm text-slate-700 dark:text-slate-200 truncate group-hover:text-red-500 transition-colors">
                                              {list.name}
                                          </div>
                                      </div>
                                  ))}
                                  {playlists.length === 0 && (
                                      <div className="col-span-full py-20 text-center text-slate-400">
                                          <Loader2 className="animate-spin inline-block mb-2" />
                                          <p>正在获取榜单数据...</p>
                                      </div>
                                  )}
                               </div>
                           </div>
                       )}
                   </>
               )}
           </div>
       </div>

       {/* Player Bar */}
       <div className="shrink-0 h-24 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 flex items-center px-4 md:px-8 gap-4 z-50">
           {/* Song Info */}
           <div className="w-1/3 flex items-center gap-3">
               {currentSong ? (
                   <>
                       <img 
                         src={currentSong.al.picUrl} 
                         alt="Cover" 
                         className={`w-14 h-14 rounded-lg shadow-md object-cover ${isPlaying ? 'animate-spin-slow' : ''}`} 
                         style={{ animationDuration: '10s' }}
                       />
                       <div className="min-w-0">
                           <div className="font-bold text-slate-800 dark:text-slate-100 truncate">{currentSong.name}</div>
                           <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{currentSong.ar.map(a => a.name).join(', ')}</div>
                       </div>
                   </>
               ) : (
                   <div className="text-sm text-slate-400">未播放音乐</div>
               )}
           </div>

           {/* Controls */}
           <div className="flex-1 flex flex-col items-center max-w-lg">
               <div className="flex items-center gap-6 mb-2">
                   <button onClick={togglePlayMode} className={`p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 ${playMode !== 'loop' ? 'text-red-500' : 'text-slate-400'}`}>
                       {playMode === 'single' ? <Repeat size={18} className="relative"><span className="absolute -top-1 -right-1 text-[8px]">1</span></Repeat> : playMode === 'shuffle' ? <Shuffle size={18} /> : <Repeat size={18} />}
                   </button>
                   <button onClick={playPrev} className="p-2 text-slate-600 dark:text-slate-300 hover:text-red-500"><SkipBack size={24} fill="currentColor" /></button>
                   <button onClick={() => isPlaying ? audioRef.current?.pause() : audioRef.current?.play()} className="p-3 bg-red-500 text-white rounded-full hover:bg-red-600 shadow-lg shadow-red-500/30">
                       {isPlaying ? <Pause size={24} fill="currentColor" /> : <Play size={24} fill="currentColor" className="ml-1" />}
                   </button>
                   <button onClick={playNext} className="p-2 text-slate-600 dark:text-slate-300 hover:text-red-500"><SkipForward size={24} fill="currentColor" /></button>
                   <div className="relative">
                       <button onClick={() => setShowQualityMenu(!showQualityMenu)} className="p-2 text-xs font-bold text-red-500 border border-red-200 rounded-md uppercase w-10">{quality === '320k' ? 'HQ' : (quality === '128k' ? 'SD' : 'SQ')}</button>
                       {showQualityMenu && (
                           <div className="absolute bottom-full mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                               {['128k', '320k', 'flac', 'flac24bit'].map(q => (
                                   <button key={q} onClick={() => changeQuality(q)} className={`block w-full px-4 py-2 text-xs text-left hover:bg-slate-100 dark:hover:bg-slate-700 ${quality === q ? 'text-red-500' : 'text-slate-600'}`}>
                                       {q.toUpperCase()}
                                   </button>
                               ))}
                           </div>
                       )}
                   </div>
               </div>
               {/* Progress */}
               <div className="w-full flex items-center gap-2 text-xs text-slate-400 font-mono">
                   <span>{Math.floor(progress / 60)}:{String(Math.floor(progress % 60)).padStart(2, '0')}</span>
                   <div className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden relative group cursor-pointer" onClick={(e) => {
                       if (audioRef.current && duration) {
                           const rect = e.currentTarget.getBoundingClientRect();
                           const p = (e.clientX - rect.left) / rect.width;
                           audioRef.current.currentTime = p * duration;
                       }
                   }}>
                       <div className="absolute top-0 left-0 h-full bg-red-500" style={{ width: `${(progress / duration) * 100}%` }} />
                   </div>
                   <span>{Math.floor(duration / 60)}:{String(Math.floor(duration % 60)).padStart(2, '0')}</span>
               </div>
           </div>

           {/* Volume */}
           <div className="w-1/3 flex items-center justify-end gap-3">
               <Volume2 size={18} className="text-slate-400" />
               <input 
                 type="range" 
                 min="0" max="1" step="0.05" 
                 value={volume} 
                 onChange={(e) => setVolume(parseFloat(e.target.value))}
                 className="w-24 h-1 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-red-500"
               />
           </div>
       </div>

       {toastMessage && (
           <div className="absolute top-20 left-1/2 -translate-x-1/2 bg-slate-800 text-white px-4 py-2 rounded-lg text-sm shadow-lg animate-in fade-in slide-in-from-top-4">
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
         onEnded={playNext}
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
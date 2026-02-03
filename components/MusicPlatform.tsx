import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Song, Playlist, LyricLine } from '../types';
import { useAuth } from '../contexts/AuthContext';
import { 
  resolveBatchUrls, fetchSongUrl, fetchSongDetail, fetchLyrics, 
  fetchPlaylistDetails, checkGuestLimit, addToHistory, getHistory 
} from '../services/musicService';
import { 
  Play, Pause, SkipBack, SkipForward, Volume2, Repeat, Shuffle, 
  List, Maximize2, Minimize2, Download, Search, Loader2, Heart,
  Music, Disc, X, Radio
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
  
  // Player State
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playMode, setPlayMode] = useState<'loop' | 'single' | 'shuffle'>('loop');
  const [quality, setQuality] = useState('320k');
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
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [currentLyricIndex, setCurrentLyricIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [checkingLimit, setCheckingLimit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const restoreTimeRef = useRef(0);

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
          // Placeholder for favorites
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

    fetchSongDetail(song.id).then(detail => {
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
    
    let songs = await fetchPlaylistDetails(list.id);
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

  return (
    <div className={`fixed inset-0 z-40 bg-white dark:bg-slate-900 flex flex-col transition-transform duration-300 ${activeView === 'music' ? 'translate-y-0' : 'translate-y-[100%]'}`}>
       {/* Background */}
       {currentSong && (
         <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-10 dark:opacity-20">
           <img src={currentSong.al.picUrl} alt="Background" className="w-full h-full object-cover blur-[100px]" />
         </div>
       )}
       
       {/* Header */}
       <div className="shrink-0 h-16 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between px-6 z-10 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md">
           <div className="flex items-center gap-4">
               <div className="p-2 bg-red-500 text-white rounded-lg">
                   <Music size={20} />
               </div>
               <h1 className="font-bold text-lg text-slate-800 dark:text-slate-100">Music Center</h1>
           </div>
           <button onClick={() => onViewChange('dashboard')} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full">
               <Minimize2 size={20} className="text-slate-500" />
           </button>
       </div>

       {/* Main Content */}
       <div className="flex-1 flex overflow-hidden z-10 relative">
           {/* Sidebar */}
           <div className="w-64 border-r border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col">
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
               
               <div className="mt-4 px-4 text-xs font-bold text-slate-400 uppercase">我的歌单</div>
               <div className="flex-1 overflow-y-auto p-2">
                   {/* Mock Playlists */}
                   {[{ id: '3778678', name: '热歌榜', coverImgUrl: '', description: '', trackCount: 0, playCount: 0 } as Playlist].map(pl => (
                       <button 
                         key={pl.id}
                         onClick={() => openPlaylist(pl)}
                         className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left truncate ${selectedPlaylist?.id === pl.id && view === 'playlist' ? 'text-red-500' : 'text-slate-600 dark:text-slate-400'}`}
                       >
                           <Disc size={14} /> {pl.name}
                       </button>
                   ))}
               </div>
           </div>

           {/* List View */}
           <div className="flex-1 overflow-y-auto p-6">
               {loading && (
                   <div className="flex justify-center py-20"><Loader2 className="animate-spin text-red-500" /></div>
               )}
               
               {!loading && (
                   <>
                       {(view === 'playlist' || view === 'history') && (
                           <div className="space-y-4">
                               <div className="flex items-center justify-between mb-4">
                                    <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                        {view === 'history' ? '播放历史' : selectedPlaylist?.name}
                                    </h2>
                                    <button 
                                      onClick={() => playAll(playlistSongs)}
                                      className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-full text-sm font-medium transition-colors"
                                    >
                                        <Play size={16} fill="currentColor" /> 播放全部
                                    </button>
                               </div>
                               <div className="space-y-1">
                                   {playlistSongs.map((song, i) => (
                                       <div 
                                         key={i} 
                                         onClick={() => playSong(song, playlistSongs)}
                                         className={`group flex items-center gap-4 p-3 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors cursor-pointer ${currentSong?.id === song.id ? 'bg-red-50 dark:bg-red-900/10' : ''}`}
                                       >
                                           <div className="w-8 text-center text-sm text-slate-400">{i + 1}</div>
                                           <div className="flex-1 min-w-0">
                                               <div className={`font-medium truncate ${currentSong?.id === song.id ? 'text-red-500' : 'text-slate-700 dark:text-slate-200'}`}>{song.name}</div>
                                               <div className="text-xs text-slate-400 truncate">{song.ar.map(a => a.name).join(', ')}</div>
                                           </div>
                                           <div className="text-xs text-slate-400 hidden sm:block w-32 truncate">{song.al.name}</div>
                                           <button onClick={(e) => handleDownload(e, song)} className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                                               <Download size={16} />
                                           </button>
                                       </div>
                                   ))}
                               </div>
                           </div>
                       )}

                       {view === 'home' && (
                           <div className="flex flex-col items-center justify-center h-full text-slate-400">
                               <Music size={48} className="mb-4 opacity-20" />
                               <p>探索更多音乐...</p>
                               <button onClick={() => openPlaylist({ id: '3778678', name: '热歌榜', coverImgUrl: '', description: '', trackCount: 0, playCount: 0 } as Playlist)} className="mt-4 text-red-500 hover:underline">
                                   查看热歌榜
                               </button>
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
                       <button onClick={() => setShowQualityMenu(!showQualityMenu)} className="p-2 text-xs font-bold text-red-500 border border-red-200 rounded-md uppercase w-10">{quality === '320k' ? 'HQ' : 'SQ'}</button>
                       {showQualityMenu && (
                           <div className="absolute bottom-full mb-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl overflow-hidden">
                               {['128k', '320k', 'flac'].map(q => (
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
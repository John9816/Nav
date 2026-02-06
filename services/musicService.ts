import { supabase } from './supabaseClient';
import { Song, Playlist, LyricLine, Artist, Album } from '../types';

// ==========================================
// UTILS
// ==========================================

export const parseLyrics = (lrc: string): LyricLine[] => {
  if (!lrc) return [];
  const lines = lrc.split('\n');
  const result: LyricLine[] = [];
  const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
  
  for (const line of lines) {
      const match = timeReg.exec(line);
      if (match) {
          const min = parseInt(match[1]);
          const sec = parseInt(match[2]);
          const ms = parseInt(match[3].padEnd(3, '0'));
          const time = min * 60 + sec + ms / 1000;
          const text = line.replace(timeReg, '').trim();
          if (text) {
              result.push({ time, text });
          }
      }
  }
  return result;
};

const parseArtist = (track: any): Artist[] => {
    if (Array.isArray(track.artist)) {
        return track.artist.map((name: string) => ({ id: 0, name }));
    }
    if (typeof track.artist === 'string') {
        return track.artist.split('/').map((name: string) => ({ id: 0, name: name.trim() }));
    }
    if (track.author) {
         return [{ id: 0, name: track.author }];
    }
    return [{ id: 0, name: 'Unknown' }];
};

// ==========================================
// CACHE
// ==========================================
const playlistCache = new Map<string, { timestamp: number, data: Song[] }>();
const lyricCache = new Map<string, { lines: LyricLine[], raw: string }>();
const detailCache = new Map<string, Song>();
const CACHE_TTL = 30 * 60 * 1000; // 30 Minutes

// ==========================================
// EXTERNAL API (via Proxy)
// ==========================================

// Proxy configured in vite.config.ts pointing to music.byebug.cn/api
const API_BASE = '/music-api';

export const fetchTopLists = async (): Promise<Playlist[]> => {
    // Return hardcoded popular playlists for discovery
    return [
        { id: '3778678', name: '热歌榜', coverImgUrl: 'https://p1.music.126.net/GhhuF6Ep5Tq9IEvLsyCN7w==/18708190348409091.jpg', description: '网易云音乐热歌榜', trackCount: 200, playCount: 5000000, source: 'netease' },
        { id: '3779629', name: '新歌榜', coverImgUrl: 'https://p2.music.126.net/N2HO5j8f9yZi9RYuwzUPzA==/18887431289123891.jpg', description: '网易云音乐新歌榜', trackCount: 100, playCount: 3000000, source: 'netease' },
        { id: '19723756', name: '飙升榜', coverImgUrl: 'https://p2.music.126.net/DrRIg6CrgDfVLEph9SNh7w==/18696095720518497.jpg', description: '网易云音乐飙升榜', trackCount: 100, playCount: 4000000, source: 'netease' },
        { id: '26', name: 'QQ热歌榜', coverImgUrl: 'https://y.qq.com/music/photo_new/T002R300x300M0000025Ndb83j3jJ2_1.jpg', description: 'QQ音乐热歌榜', trackCount: 100, playCount: 2000000, source: 'qq' },
        { id: '93', name: '酷我飙升榜', coverImgUrl: 'https://img4.kuwo.cn/star/starheads/800/46/66/1235334706.jpg', description: '酷我音乐', trackCount: 100, playCount: 1000000, source: 'kuwo' },
    ];
};

export const fetchPlaylistDetails = async (id: string | number, source: string = 'netease'): Promise<Song[]> => {
    const cacheKey = `${source}-${id}`;
    if (playlistCache.has(cacheKey)) {
        const cached = playlistCache.get(cacheKey)!;
        if (Date.now() - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    try {
        const serverMap: Record<string, string> = { 'netease': 'netease', 'qq': 'tencent', 'kuwo': 'kuwo' };
        const server = serverMap[source] || 'netease';

        const res = await fetch(`${API_BASE}?type=playlist&id=${id}&server=${server}`);
        if (!res.ok) throw new Error('Network response was not ok');
        const json = await res.json();
        
        // Handle different API response structures (sometimes array, sometimes object with data property)
        const rawList = Array.isArray(json) ? json : (json.data || []);
        
        if (!Array.isArray(rawList)) {
            console.warn("API returned unexpected format", json);
            return [];
        }

        const songs = rawList.map((track: any) => ({
            id: track.id || track.song_id,
            name: track.name || track.title || 'Unknown Song',
            ar: parseArtist(track),
            al: { id: 0, name: 'Unknown', picUrl: track.pic || track.cover || '' },
            dt: 0,
            source: source,
            url: track.url || undefined,
            lyric: track.lrc || undefined
        }));

        playlistCache.set(cacheKey, { timestamp: Date.now(), data: songs });
        return songs;
    } catch (e) {
        console.error("Fetch playlist failed", e);
        return [];
    }
};

export const fetchSongUrl = async (id: string | number, source: string, quality: string = '128k', metadata?: any): Promise<{ url: string, lyric?: string } | null> => {
     try {
        // Special handling for Netease using new API
        if (source === 'netease') {
            const res = await fetch(`/random-music-api/api/wangyi/music?type=json&id=${id}`);
            const data = await res.json();
            
            if (data.code === 200 && data.data && data.data.url) {
                return { url: data.data.url };
            }
            return null;
        }

        const serverMap: Record<string, string> = { 'netease': 'netease', 'qq': 'tencent', 'kuwo': 'kuwo' };
        const server = serverMap[source] || 'netease';
        
        const res = await fetch(`${API_BASE}?type=url&id=${id}&server=${server}`);
        const data = await res.json();
        
        if (data && data.url) {
            return { url: data.url, lyric: data.lrc || data.lyric };
        }
        
        return null;
    } catch (e) {
        console.error("Fetch URL failed", e);
        return null;
    }
};

export const fetchSongDetail = async (id: string | number, source: string): Promise<Song | null> => {
    const cacheKey = `${source}-${id}`;
    if (detailCache.has(cacheKey)) {
        return detailCache.get(cacheKey)!;
    }

    try {
        const serverMap: Record<string, string> = { 'netease': 'netease', 'qq': 'tencent', 'kuwo': 'kuwo' };
        const server = serverMap[source] || 'netease';

        const res = await fetch(`${API_BASE}?type=song&id=${id}&server=${server}`);
        const data = await res.json();
        // The API might return an array or a single object
        const track = Array.isArray(data) ? data[0] : data;
        
        if (track) {
             const song = {
                id: track.id || track.song_id,
                name: track.name || track.title || 'Unknown',
                ar: parseArtist(track),
                al: { id: 0, name: 'Unknown', picUrl: track.pic || track.cover || '' },
                dt: 0,
                source: source,
                url: track.url,
                lyric: track.lrc
            };
            detailCache.set(cacheKey, song);
            return song;
        }
        return null;
    } catch(e) {
        return null;
    }
};

export const fetchLyrics = async (id: string | number, source: string): Promise<{ lines: LyricLine[], raw: string }> => {
    const cacheKey = `${source}-${id}`;
    if (lyricCache.has(cacheKey)) {
        return lyricCache.get(cacheKey)!;
    }

    try {
        const serverMap: Record<string, string> = { 'netease': 'netease', 'qq': 'tencent', 'kuwo': 'kuwo' };
        const server = serverMap[source] || 'netease';
        
        const res = await fetch(`${API_BASE}?type=lrc&id=${id}&server=${server}`);
        const data = await res.json();
        
        const lrcText = typeof data === 'string' ? data : (data.lrc || data.lyric || '');
        
        const result = {
            lines: parseLyrics(lrcText),
            raw: lrcText
        };
        lyricCache.set(cacheKey, result);
        return result;
    } catch (e) {
        return { lines: [], raw: '' };
    }
};

export const searchSongs = async (query: string, source: string, page: number = 1): Promise<Song[]> => {
    try {
        const serverMap: Record<string, string> = { 'netease': 'netease', 'qq': 'tencent', 'kuwo': 'kuwo' };
        const server = serverMap[source] || 'netease';
        
        const res = await fetch(`${API_BASE}?type=search&name=${encodeURIComponent(query)}&page=${page}&server=${server}`);
        const json = await res.json();
        
        const rawList = Array.isArray(json) ? json : (json.data || []);
        
        if (!Array.isArray(rawList)) {
             return [];
        }

        return rawList.map((track: any) => ({
            id: track.id || track.song_id,
            name: track.name || track.title || 'Unknown',
            ar: parseArtist(track),
            al: { id: 0, name: 'Unknown', picUrl: track.pic || track.cover || '' },
            dt: 0, 
            source: source,
            url: track.url || undefined,
            lyric: track.lrc || undefined
        }));
    } catch(e) {
        console.error("Search failed", e);
        return [];
    }
};

export const fetchRandomMusic = async (): Promise<Song | null> => {
     try {
         const res = await fetch('/random-music-api/music?type=json');
         const data = await res.json();
         
         if (data && data.mp3url) {
             return {
                 id: 'random-' + Date.now(),
                 name: data.name || 'Random Song',
                 ar: [{ id: 0, name: data.artists || 'Unknown' }],
                 al: { id: 0, name: 'Unknown', picUrl: data.picurl || '' },
                 dt: 0,
                 source: 'random',
                 url: data.mp3url,
                 lyric: ''
             };
         }
         return null;
     } catch (e) {
         return null;
     }
}

// ==========================================
// LOCAL / DATABASE LOGIC
// ==========================================

export const checkGuestLimit = async (): Promise<{ allowed: boolean, count: number }> => {
    const count = parseInt(localStorage.getItem('guest_play_count') || '0');
    const allowed = count < 20; 
    
    if (allowed) {
        localStorage.setItem('guest_play_count', (count + 1).toString());
    }
    
    return { allowed, count: allowed ? count + 1 : count };
};

export const addToHistory = async (userId: string, song: Song, lyric?: string) => {
    try {
        const { data: existing } = await supabase
            .from('music_history')
            .select('id')
            .eq('user_id', userId)
            .eq('song_id', String(song.id))
            .maybeSingle();

        const payload: any = { 
            user_id: userId, 
            song_id: String(song.id), 
            name: song.name,
            artist: song.ar.map(a => a.name).join(', '),
            album: song.al.name,
            cover_url: song.al.picUrl,
            source: song.source || 'netease',
            duration: song.dt,
            played_at: new Date().toISOString()
        };
        
        if (lyric) {
            payload.lyric = lyric;
        }
        if (song.url) {
            payload.url = song.url;
        }

        if (existing) {
             const { user_id, song_id, ...updates } = payload;
             await supabase
                .from('music_history')
                .update(updates)
                .eq('id', existing.id);
        } else {
             await supabase
                .from('music_history')
                .insert(payload);
        }
    } catch (e) {
        console.error("Add history failed", e);
    }
};

export const getHistory = async (userId: string): Promise<Song[]> => {
    const { data } = await supabase
        .from('music_history')
        .select('*')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })
        .limit(50);
        
    return (data || []).map((item: any) => ({
        id: item.song_id,
        name: item.name,
        ar: item.artist ? item.artist.split(', ').map((n: string) => ({ id: 0, name: n })) : [{ id: 0, name: 'Unknown' }],
        al: { id: 0, name: item.album || '', picUrl: item.cover_url || '' },
        dt: item.duration || 0,
        source: item.source || 'netease',
        url: item.url || undefined,
        lyric: item.lyric || undefined
    }));
};

export const getLikedSongs = async (userId: string): Promise<Song[]> => {
    const { data } = await supabase
        .from('liked_songs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
        
    return (data || []).map((item: any) => ({
        id: item.song_id,
        name: item.name,
        ar: item.artist ? item.artist.split(', ').map((n: string) => ({ id: 0, name: n })) : [{ id: 0, name: 'Unknown' }],
        al: { id: 0, name: item.album || '', picUrl: item.cover_url || '' },
        dt: item.duration || 0,
        source: item.source || 'netease',
        url: item.url || undefined,
        lyric: item.lyric || undefined
    }));
};

export const toggleLike = async (userId: string, song: Song, lyric?: string): Promise<boolean> => {
    const { data } = await supabase
        .from('liked_songs')
        .select('id')
        .eq('user_id', userId)
        .eq('song_id', String(song.id))
        .maybeSingle();
        
    if (data) {
        await supabase.from('liked_songs').delete().eq('id', data.id);
        return false;
    } else {
        await supabase.from('liked_songs').insert({
            user_id: userId,
            song_id: String(song.id),
            source: song.source || 'netease',
            name: song.name,
            artist: song.ar.map(a => a.name).join(', '),
            album: song.al.name,
            cover_url: song.al.picUrl,
            duration: song.dt,
            lyric: lyric,
            url: song.url
        });
        return true;
    }
};

export const checkIsLiked = async (userId: string, songId: string | number): Promise<boolean> => {
    const { data } = await supabase
        .from('liked_songs')
        .select('id')
        .eq('user_id', userId)
        .eq('song_id', String(songId))
        .maybeSingle();
    return !!data;
};
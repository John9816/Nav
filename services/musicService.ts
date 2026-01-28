import { Playlist, Song, LyricLine } from '../types';
import { supabase } from './supabaseClient';

// Public Netease Cloud Music API instance (TuneHub)
const TUNEHUB_API_URL = 'https://tunehub.sayqz.com/api/v1/parse';
const TUNEHUB_API_KEY = 'th_3063e4ad2ef8075774abd413a417ce31914b60d8776c5549';

// Request Cache for TuneHub API to deduplicate calls
const tuneHubCache = new Map<string, Promise<any>>();

// Helper to ensure HTTPS
const toHttps = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http:')) {
    return url.replace('http:', 'https:');
  }
  return url;
};

// --- API Helpers ---

/**
 * Checks if the direct Netease URL is available and returns valid audio.
 * Uses the local proxy /netease-api to avoid CORS issues during the HEAD check.
 */
const checkDirectUrl = async (id: string | number): Promise<boolean> => {
  const proxyUrl = `/netease-api/song/media/outer/url?id=${id}.mp3`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout

    const response = await fetch(proxyUrl, { 
        method: 'HEAD',
        signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
        const type = response.headers.get('content-type');
        // Valid if content-type indicates audio or binary stream
        if (type && (type.includes('audio') || type.includes('octet-stream') || type.includes('mpeg'))) {
            // Also check content-length to avoid tiny error files if possible
            const length = response.headers.get('content-length');
            if (length && parseInt(length) < 5000) return false;
            return true;
        }
    }
    return false;
  } catch (e) {
    return false;
  }
};

/**
 * Fetches data from TuneHub API with deduplication.
 */
const getTuneHubData = (id: string | number, quality: string = '320k') => {
  const key = `${id}-${quality}`;
  
  if (tuneHubCache.has(key)) {
    return tuneHubCache.get(key)!;
  }

  const promise = fetch(TUNEHUB_API_URL, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'X-API-Key': TUNEHUB_API_KEY,
          'Referer': 'https://tunehub.sayqz.com/test'
      },
      body: JSON.stringify({
          platform: 'netease', // Force netease as requested
          ids: String(id),
          quality: quality
      })
  })
  .then(async (res) => {
      if (!res.ok) throw new Error(`TuneHub error ${res.status}`);
      return res.json();
  })
  .then(data => {
      if (data.success && data.data && Array.isArray(data.data.data) && data.data.data.length > 0) {
          const item = data.data.data[0];
          if (item.success) {
              return item;
          }
      }
      throw new Error('TuneHub returned no valid data');
  })
  .catch(err => {
      console.warn("TuneHub fetch failed:", err);
      tuneHubCache.delete(key); // Clear failed request from cache so it can be retried
      return null;
  });

  tuneHubCache.set(key, promise);
  
  // Clear cache entry after 60 seconds to allow fresh retries later
  setTimeout(() => tuneHubCache.delete(key), 60000);
  
  return promise;
};

// Static configuration for Top Lists (Fallback)
const STATIC_TOPLISTS: Playlist[] = [
  { 
    id: 19723756, 
    name: '飙升榜', 
    coverImgUrl: 'https://p1.music.126.net/DrRIg6CrgDfVLEph9SNh7w==/18696095720518497.jpg', 
    description: '云音乐中每天热度上升最快的歌曲', 
    trackCount: 100, 
    playCount: 1000000 
  },
  { 
    id: 3779629, 
    name: '新歌榜', 
    coverImgUrl: 'https://p1.music.126.net/N2HO5xfYEqyQ8q6oxCw8IQ==/18713687906568048.jpg', 
    description: '云音乐中每天收听量最高的新歌', 
    trackCount: 100, 
    playCount: 800000 
  },
  { 
    id: 2884035, 
    name: '原创榜', 
    coverImgUrl: 'https://p1.music.126.net/sBzD11nforcuh1jdLSgX7g==/18740076185638788.jpg', 
    description: '云音乐中每天收听量最高的原创歌曲', 
    trackCount: 100, 
    playCount: 500000 
  },
  { 
    id: 3778678, 
    name: '热歌榜', 
    coverImgUrl: 'https://p1.music.126.net/GhhuF6Ep5Tq9IEvLsyCN7w==/18708190348493229.jpg', 
    description: '云音乐中每天收听量最高的歌曲', 
    trackCount: 100, 
    playCount: 2000000 
  }
];

// Helper to map API item to Song type
const mapApiItemToSong = (item: any): Song => {
  const id = item.id || item.rid;
  const name = item.name || item.songName || 'Unknown Title';
  
  // Artist
  const ar = item.ar || item.artists || (item.artist ? [{name: item.artist}] : []) || [];
  const artists = Array.isArray(ar) 
      ? ar.map((a: any) => ({ id: a.id || 0, name: a.name || 'Unknown' })) 
      : [{ id: 0, name: String(ar) }];

  // Album
  const al = item.al || item.album || {};
  const album = {
      id: al.id || 0,
      name: al.name || item.albumName || 'Unknown Album',
      picUrl: toHttps(al.picUrl || item.picUrl || item.img120 || '')
  };

  return {
    id: id,
    name: name,
    ar: artists.length > 0 ? artists : [{ id: 0, name: 'Unknown Artist' }],
    al: album,
    dt: item.dt || item.duration || (item.durationSec ? item.durationSec * 1000 : 0) || 0,
    source: 'netease', 
    url: undefined 
  };
};

const parseLrc = (lrcString: string): LyricLine[] => {
  if (!lrcString) return [];
  const lines = lrcString.split('\n');
  const result: LyricLine[] = [];
  const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;

  for (const line of lines) {
    const match = timeRegex.exec(line);
    if (match) {
      const min = parseInt(match[1], 10);
      const sec = parseInt(match[2], 10);
      const ms = parseInt(match[3], 10) * (match[3].length === 2 ? 10 : 1);
      const time = min * 60 + sec + ms / 1000;
      const text = line.replace(/\[.*?\]/g, '').trim();
      if (text) {
        result.push({ time, text });
      }
    }
  }
  return result;
};

// ==========================================
// Multi-Platform Aggregator (Simplified for Netease Only)
// ==========================================

interface SearchResult {
  items: Song[];
  total: number;
}

class MultiPlatformAggregator {
  /**
   * Search implementation using local Netease proxy
   */
  public async search(
    keyword: string,
    page: number = 0,
    pageSize: number = 20
  ): Promise<SearchResult> {
    try {
      const offset = page * pageSize;
      const url = `/netease-api/api/search/get/web?s=${encodeURIComponent(keyword)}&type=1&offset=${offset}&limit=${pageSize}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Accept-Language': 'zh-CN,zh;q=0.9'
        }
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const data = await response.json();
      const songs = data.result?.songs || [];
      
      const items = songs.map(mapApiItemToSong);

      return {
          total: items.length,
          items: items
      };

    } catch (error) {
      console.error('Search failed:', error);
      return { total: 0, items: [] };
    }
  }
}

const aggregator = new MultiPlatformAggregator();

// --- Exported Service Methods ---

export const fetchTopLists = async (): Promise<Playlist[]> => {
  try {
    const url = '/netease-api/api/toplist';
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Accept-Language': 'zh-CN,zh;q=0.9'
        }
    });

    if (!response.ok) throw new Error(`Toplist fetch failed: ${response.status}`);

    const data = await response.json();
    const list = data.list || [];
    
    if (list.length > 0) {
        return list.slice(0, 10).map((item: any) => ({
            id: item.id,
            name: item.name,
            coverImgUrl: toHttps(item.coverImgUrl || item.picUrl || item.cover || item.coverUrl),
            description: item.description || '',
            trackCount: item.trackCount || 0,
            playCount: item.playCount || 0
        }));
    }
    return STATIC_TOPLISTS;
  } catch (e) {
    console.warn("Fetch toplists failed, using static fallback", e);
    return STATIC_TOPLISTS;
  }
};

export const fetchPlaylistDetails = async (id: number | string): Promise<Song[]> => {
  try {
    const url = `/netease-api/api/playlist/detail?id=${id}&n=100000&s=8`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Accept-Language': 'zh-CN,zh;q=0.9'
        }
    });

    if (!response.ok) throw new Error(`Playlist detail fetch failed: ${response.status}`);

    const data = await response.json();
    
    let songs: any[] = [];
    if (data && data.result && Array.isArray(data.result.tracks)) {
        songs = data.result.tracks;
    } else if (data && data.playlist && Array.isArray(data.playlist.tracks)) {
        songs = data.playlist.tracks;
    }
    
    if (songs.length > 0) {
        return songs.map(mapApiItemToSong);
    }
    return [];
  } catch (error) {
    console.error(`Failed to fetch playlist ${id}:`, error);
    return [];
  }
};

export const fetchSongDetail = async (id: number | string): Promise<Song | null> => {
  try {
    const url = `/netease-api/api/song/detail?ids=[${id}]`;
    
    const response = await fetch(url, {
        method: 'GET',
        headers: {
            'Accept': 'application/json',
            'Accept-Language': 'zh-CN,zh;q=0.9'
        }
    });

    if (!response.ok) throw new Error(`Song detail fetch failed: ${response.status}`);

    const data = await response.json();
    
    let songItem = null;
    if (data && data.songs && data.songs.length > 0) {
        songItem = data.songs[0];
    }
    
    if (songItem) {
        return mapApiItemToSong(songItem);
    }
    return null;
  } catch (error) {
    console.error(`Failed to fetch song detail for ${id}:`, error);
    return null;
  }
};

/**
 * Main URL Fetching Logic:
 * 1. Check if Direct Netease URL is valid (via HEAD request).
 * 2. If valid, return it immediately.
 * 3. If invalid (VIP/No Copyright), call TuneHub API (Parse) forcing 'netease'.
 */
export const fetchSongUrl = async (id: number | string, source: string = 'netease', br: string = '320k'): Promise<string | null> => {
  const directUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;

  // 1. Try Direct URL first
  const isDirectValid = await checkDirectUrl(id);
  if (isDirectValid) {
      return directUrl;
  }

  // 2. Fallback to TuneHub API (Parse)
  try {
      // Force platform to 'netease' regardless of what 'source' arg says, as per requirement
      const data = await getTuneHubData(id, br);
      if (data && data.url) {
          return toHttps(data.url);
      }
  } catch(e) {
      console.warn("TuneHub fallback failed", e);
  }

  // If both fail, return directUrl anyway as a last resort
  return directUrl;
};

export const fetchLyrics = async (id: number | string, source: string = 'netease'): Promise<LyricLine[]> => {
  try {
    // 1. Try Official API via proxy first (usually correct and fast)
    const officialUrl = `/netease-api/api/song/lyric?id=${id}&lv=-1&kv=-1&tv=-1`;
    const response = await fetch(officialUrl);
    if (response.ok) {
        const data = await response.json();
        if (data.lrc && data.lrc.lyric) {
            return parseLrc(data.lrc.lyric);
        }
    }
  } catch (e) {
    // console.warn("Official lyric fetch failed", e);
  }

  // 2. Fallback to TuneHub
  try {
    // Use the same quality/key logic if possible to potentially hit cache, 
    // although lyrics usually don't depend on quality.
    const data = await getTuneHubData(id); 
    if (data && data.lyrics) {
        return parseLrc(data.lyrics);
    }
  } catch (error) {
    console.error(`Failed to fetch lyrics for ${id}:`, error);
  }

  return [];
};

export const searchSongs = async (keywords: string, page: number = 1, limit: number = 10): Promise<Song[]> => {
  const pageIndex = page > 0 ? page - 1 : 0;
  const result = await aggregator.search(keywords, pageIndex, limit);
  return result.items;
};

// ... Rest of the file (Supabase favorites/history) remains unchanged ...
export const fetchLikedSongs = async (userId: string): Promise<Song[]> => {
  const { data, error } = await supabase
    .from('liked_songs')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching likes:', error);
    return [];
  }

  return data.map(item => ({
    id: item.song_id,
    name: item.name,
    source: item.source,
    ar: [{ id: 0, name: item.artist || 'Unknown' }],
    al: { id: 0, name: item.album || '', picUrl: toHttps(item.cover_url || '') }, 
    dt: (item.duration || 0) * 1000,
    url: undefined
  }));
};

export const likeSong = async (userId: string, song: Song) => {
  const { error } = await supabase
    .from('liked_songs')
    .insert({
      user_id: userId,
      song_id: String(song.id),
      source: song.source || 'netease',
      name: song.name,
      artist: song.ar.map(a => a.name).join(', '),
      album: song.al.name,
      cover_url: song.al.picUrl,
      duration: Math.floor(song.dt / 1000) || 0
    });
    
  if (error) throw error;
};

export const unlikeSong = async (userId: string, songId: string) => {
  const { error } = await supabase
    .from('liked_songs')
    .delete()
    .eq('user_id', userId)
    .eq('song_id', songId);

  if (error) throw error;
};

export const fetchMusicHistory = async (userId: string): Promise<Song[]> => {
  const { data, error } = await supabase
    .from('music_history')
    .select('*')
    .eq('user_id', userId)
    .order('played_at', { ascending: false })
    .limit(100);

  if (error) {
    console.error('Error fetching history:', error);
    return [];
  }

  return data.map(item => ({
    id: item.song_id,
    name: item.name,
    source: item.source,
    ar: [{ id: 0, name: item.artist || 'Unknown' }],
    al: { id: 0, name: item.album || '', picUrl: toHttps(item.cover_url || '') }, 
    dt: (item.duration || 0) * 1000,
    url: undefined
  }));
};

export const addToHistory = async (userId: string, song: Song) => {
  const { error } = await supabase
    .from('music_history')
    .upsert({
      user_id: userId,
      song_id: String(song.id),
      source: song.source || 'netease',
      name: song.name,
      artist: song.ar.map(a => a.name).join(', '),
      album: song.al.name,
      cover_url: song.al.picUrl,
      duration: Math.floor(song.dt / 1000) || 0,
      played_at: new Date().toISOString()
    }, { onConflict: 'user_id,song_id' });
    
  if (error) {
      console.error("Failed to add to history", error);
  } else {
    try {
        const { data } = await supabase
            .from('music_history')
            .select('played_at')
            .eq('user_id', userId)
            .order('played_at', { ascending: false })
            .range(100, 100)
            .single();

        if (data && data.played_at) {
            await supabase
                .from('music_history')
                .delete()
                .eq('user_id', userId)
                .lte('played_at', data.played_at);
        }
    } catch (err) {
        console.warn("Failed to cleanup older history entries", err);
    }
  }
};

export const clearMusicHistory = async (userId: string) => {
    const { error } = await supabase
        .from('music_history')
        .delete()
        .eq('user_id', userId);
    
    if (error) throw error;
};
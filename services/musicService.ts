import { Playlist, Song, LyricLine } from '../types';
import { supabase } from './supabaseClient';

// Public Netease Cloud Music API instance (TuneHub)
const TUNEHUB_API_URL = 'https://tunehub.sayqz.com/api/v1/parse';
const TUNEHUB_API_KEY = 'th_3063e4ad2ef8075774abd413a417ce31914b60d8776c5549';

// --- Caches ---
// Prevents duplicate URL fetching for the same song/quality
const urlPromiseCache = new Map<string, Promise<string | null>>();
// Cache for lyrics
const lyricCache = new Map<string, LyricLine[]>();
// Cache for Playlist Details (The list of songs in a playlist)
const playlistCache = new Map<string, Song[]>();
// Cache for the main Top List menu
let topListCache: Playlist[] | null = null;
// Cache for IP address (so we don't fetch it every time)
let cachedIp: string | null = null;

// --- Helpers ---

const toHttps = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http:')) {
    return url.replace('http:', 'https:');
  }
  return url;
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

// Helper to map standard Netease API item to internal Song type
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

// --- Internal Services ---

/**
 * Checks if the direct Netease URL is available and valid via HEAD request.
 * Uses local proxy to avoid CORS.
 */
const checkDirectUrl = async (id: string | number): Promise<boolean> => {
  const proxyUrl = `/netease-api/song/media/outer/url?id=${id}.mp3`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000); // 2s timeout

    const response = await fetch(proxyUrl, { 
        method: 'HEAD',
        signal: controller.signal
    });
    
    clearTimeout(timeoutId);

    if (response.ok) {
        const type = response.headers.get('content-type');
        const length = response.headers.get('content-length');
        
        // Check for audio content type
        if (type && (type.includes('audio') || type.includes('octet-stream') || type.includes('mpeg'))) {
            // Filter out small files which are usually error json/html responses served with 200 OK
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
 * Fetches data from TuneHub API (Parse Interface).
 * Strictly forces platform='netease'.
 */
const getTuneHubParseData = async (id: string | number, quality: string) => {
  try {
    const response = await fetch(TUNEHUB_API_URL, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'X-API-Key': TUNEHUB_API_KEY,
          'Referer': 'https://tunehub.sayqz.com/test'
      },
      body: JSON.stringify({
          platform: 'netease', // STRICTLY NETEASE
          ids: String(id),
          quality: quality
      })
    });

    if (!response.ok) throw new Error(`TuneHub error ${response.status}`);
    
    const data = await response.json();
    if (data.success && data.data && Array.isArray(data.data.data) && data.data.data.length > 0) {
        const item = data.data.data[0];
        if (item.success) {
            return item;
        }
    }
    return null;
  } catch (err) {
    console.warn("TuneHub parse failed:", err);
    return null;
  }
};

// --- Exported API Methods ---

export const checkGuestLimit = async (): Promise<{ allowed: boolean; count: number }> => {
  try {
    // 1. Get Client IP (with caching)
    if (!cachedIp) {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        if (ipRes.ok) {
            const ipData = await ipRes.json();
            cachedIp = ipData.ip;
        } else {
            // Fallback if IP service is down: fail open to avoid breaking functionality
            return { allowed: true, count: 0 }; 
        }
    }

    if (!cachedIp) return { allowed: true, count: 0 }; // Should not happen

    // 2. Query Supabase for this IP
    const { data: currentData, error: fetchError } = await supabase
        .from('guest_limits')
        .select('play_count')
        .eq('ip_address', cachedIp)
        .single();

    // If row doesn't exist, count is 0
    const currentCount = currentData?.play_count || 0;

    // 3. Check Limit
    if (currentCount >= 5) {
        return { allowed: false, count: currentCount };
    }

    // 4. Increment Count (Upsert)
    const nextCount = currentCount + 1;
    const { error: upsertError } = await supabase
        .from('guest_limits')
        .upsert({ 
            ip_address: cachedIp, 
            play_count: nextCount,
            updated_at: new Date().toISOString()
        });

    if (upsertError) {
        console.error("Failed to update guest limit", upsertError);
    }

    return { allowed: true, count: nextCount };

  } catch (error) {
    console.error("Guest limit check failed:", error);
    return { allowed: true, count: 0 }; // Fail open
  }
};

export const fetchTopLists = async (): Promise<Playlist[]> => {
  // Return cached result if available
  if (topListCache && topListCache.length > 0) {
      return topListCache;
  }

  try {
    // Use local proxy path for official Netease API
    const response = await fetch('/netease-api/api/toplist', {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) throw new Error(`Toplist fetch failed: ${response.status}`);

    const data = await response.json();
    const list = data.list || [];
    
    if (list.length > 0) {
        const mappedList = list.slice(0, 10).map((item: any) => ({
            id: item.id,
            name: item.name,
            coverImgUrl: toHttps(item.coverImgUrl || item.picUrl || item.cover || item.coverUrl),
            description: item.description || '',
            trackCount: item.trackCount || 0,
            playCount: item.playCount || 0
        }));
        topListCache = mappedList;
        return mappedList;
    }
    return [];
  } catch (e) {
    console.warn("Fetch toplists failed", e);
    return [];
  }
};

export const fetchPlaylistDetails = async (id: number | string): Promise<Song[]> => {
  const cacheKey = String(id);
  
  // 1. Check Cache
  if (playlistCache.has(cacheKey)) {
      return playlistCache.get(cacheKey)!;
  }

  try {
    // Use local proxy path for official Netease API playlist detail
    const response = await fetch(`/netease-api/api/playlist/detail?id=${id}&n=100000&s=8`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
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
        const mappedSongs = songs.map(mapApiItemToSong);
        // 2. Set Cache
        playlistCache.set(cacheKey, mappedSongs);
        return mappedSongs;
    }
    return [];
  } catch (error) {
    console.error(`Failed to fetch playlist ${id}:`, error);
    return [];
  }
};

export const fetchSongDetail = async (id: number | string): Promise<Song | null> => {
  try {
    // Use local proxy path for official Netease API song detail
    const response = await fetch(`/netease-api/api/song/detail?ids=[${id}]`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' }
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
 * Main URL Fetching Logic with Deduplication
 * 1. Check Direct Netease URL (via HEAD).
 * 2. If valid, return it.
 * 3. If invalid, call TuneHub Parse (Strictly Netease).
 */
export const fetchSongUrl = (id: number | string, source: string = 'netease', br: string = '320k'): Promise<string | null> => {
  const cacheKey = `${id}-${br}`;
  
  // Return existing in-flight or cached promise
  if (urlPromiseCache.has(cacheKey)) {
    return urlPromiseCache.get(cacheKey)!;
  }

  const fetchTask = async (): Promise<string | null> => {
    const directUrl = `https://music.163.com/song/media/outer/url?id=${id}.mp3`;

    // 1. Try Direct URL
    const isDirectValid = await checkDirectUrl(id);
    if (isDirectValid) {
        return directUrl;
    }

    // 2. Fallback to TuneHub Parse (Strictly Netease)
    const tuneData = await getTuneHubParseData(id, br);
    if (tuneData && tuneData.url) {
        return toHttps(tuneData.url);
    }

    // 3. Fallback to Direct URL anyway (Browser might be able to handle it even if HEAD failed)
    return directUrl;
  };

  const promise = fetchTask();
  urlPromiseCache.set(cacheKey, promise);

  // Clear cache after 5 minutes to allow link refreshing (links expire)
  promise.finally(() => {
      setTimeout(() => {
          urlPromiseCache.delete(cacheKey);
      }, 5 * 60 * 1000); 
  });

  return promise;
};

export const fetchLyrics = async (id: number | string, source: string = 'netease'): Promise<LyricLine[]> => {
  const cacheKey = String(id);
  if (lyricCache.has(cacheKey)) {
      return lyricCache.get(cacheKey)!;
  }

  try {
    // 1. Try Official API via proxy (usually correct and fast)
    const response = await fetch(`/netease-api/api/song/lyric?id=${id}&lv=-1&kv=-1&tv=-1`);
    if (response.ok) {
        const data = await response.json();
        if (data.lrc && data.lrc.lyric) {
            const parsed = parseLrc(data.lrc.lyric);
            lyricCache.set(cacheKey, parsed);
            return parsed;
        }
    }
  } catch (e) {
    // ignore
  }

  // 2. Fallback to TuneHub if official fails
  const tuneData = await getTuneHubParseData(id, '128k'); // Quality irrelevant for lyrics
  if (tuneData && tuneData.lyrics) {
      const parsed = parseLrc(tuneData.lyrics);
      lyricCache.set(cacheKey, parsed);
      return parsed;
  }

  return [];
};

export const searchSongs = async (keywords: string, page: number = 1, limit: number = 10): Promise<Song[]> => {
  try {
    const offset = (page > 0 ? page - 1 : 0) * limit;
    // Use local proxy path instead of direct URL
    const response = await fetch(
        `/netease-api/api/search/get/web?s=${encodeURIComponent(keywords)}&type=1&offset=${offset}&limit=${limit}`, 
        { headers: { 'Accept': 'application/json' } }
    );

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    const songs = data.result?.songs || [];
    
    return songs.map(mapApiItemToSong);
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
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
    source: 'netease', // Enforce netease
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
      source: 'netease', // Enforce netease
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
    source: 'netease', // Enforce netease
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
      source: 'netease', // Enforce netease
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
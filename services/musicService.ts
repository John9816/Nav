import { Song, Playlist, LyricLine } from '../types';
import { supabase } from './supabaseClient';

// API Configuration
const TUNEHUB_API_URL = 'https://tunehub.sayqz.com/api/v1/meting';
const TUNEHUB_API_KEY = 'sayqz-tunehub-public'; 

// Cache for resolved URLs to avoid re-fetching
export const urlPromiseCache = new Map<string, Promise<string>>();

// Helper to enforce HTTPS
const toHttps = (url: string) => {
    if (!url) return '';
    return url.replace(/^http:\/\//i, 'https://');
};

/**
 * Batch resolve URLs for a list of songs.
 */
export const resolveBatchUrls = async (songs: Song[], quality: string = '320k'): Promise<Song[]> => {
  if (songs.length === 0) return [];

  // API Limitation: Max 20 IDs per request. 
  const batch = songs.slice(0, 20);
  const ids = batch.map(s => s.id).join(',');
  const source = batch[0].source || 'netease';

  try {
    const response = await fetch(TUNEHUB_API_URL, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json, text/plain, */*',
          'X-API-Key': TUNEHUB_API_KEY
      },
      body: JSON.stringify({
          platform: source, 
          type: 'url',
          id: ids,
          quality: quality
      })
    });

    if (!response.ok) throw new Error(`Batch error ${response.status}`);
    
    const result = await response.json();
    
    // Check format (array or object with data property)
    // Adjust based on actual API response structure. 
    // Assuming standard Meting format: array of objects { id, url, ... }
    const list = Array.isArray(result) ? result : (result.data || []);
    
    if (list.length > 0) {
        const urlMap = new Map<string, string>();
        
        list.forEach((item: any) => {
            if (item.url) {
                const secureUrl = toHttps(item.url);
                urlMap.set(String(item.id), secureUrl);
                
                // Pre-populate the cache
                const cacheKey = `${item.id}-${quality}`;
                urlPromiseCache.set(cacheKey, Promise.resolve(secureUrl));
            }
        });

        return songs.map(song => ({
            ...song,
            url: urlMap.get(String(song.id)) || song.url
        }));
    }
    
    return songs;
  } catch (err) {
    console.warn("Batch resolve failed:", err);
    return songs; 
  }
};

export const fetchSongUrl = async (id: string | number, source: string = 'netease', quality: string = '320k'): Promise<string | null> => {
    const cacheKey = `${id}-${quality}`;
    if (urlPromiseCache.has(cacheKey)) {
        return urlPromiseCache.get(cacheKey)!;
    }

    try {
        const response = await fetch(TUNEHUB_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': TUNEHUB_API_KEY },
            body: JSON.stringify({ platform: source, type: 'url', id, quality })
        });
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.data || []);
        if (list.length > 0 && list[0].url) {
            const url = toHttps(list[0].url);
            urlPromiseCache.set(cacheKey, Promise.resolve(url));
            return url;
        }
    } catch (e) {
        console.error("Fetch URL failed", e);
    }
    return null;
};

export const fetchSongDetail = async (id: string | number, source: string = 'netease'): Promise<Song | null> => {
    try {
        const response = await fetch(TUNEHUB_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': TUNEHUB_API_KEY },
            body: JSON.stringify({ platform: source, type: 'song', id })
        });
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.data || []);
        
        if (list.length > 0) {
             const item = list[0];
             return {
                 id: item.id,
                 name: item.name,
                 ar: item.artist ? item.artist.map((a: string) => ({ id: 0, name: a })) : [],
                 al: { id: 0, name: item.album || '', picUrl: toHttps(item.pic) },
                 dt: 0,
                 source: item.source || source,
                 url: toHttps(item.url)
             };
        }
    } catch (e) {
        console.error("Fetch detail failed", e);
    }
    return null;
};

export const fetchLyrics = async (id: string | number, source: string = 'netease'): Promise<LyricLine[]> => {
    try {
        const response = await fetch(TUNEHUB_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': TUNEHUB_API_KEY },
            body: JSON.stringify({ platform: source, type: 'lrc', id })
        });
        const data = await response.json();
        if (data && data.lyric) {
            return parseLyrics(data.lyric);
        }
    } catch (e) {
        console.error("Fetch lyrics failed", e);
    }
    return [];
};

const parseLyrics = (lrc: string): LyricLine[] => {
    const lines = lrc.split('\n');
    const result: LyricLine[] = [];
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (const line of lines) {
        const match = timeRegex.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const ms = parseInt(match[3]);
            const time = min * 60 + sec + ms / 1000;
            const text = line.replace(timeRegex, '').trim();
            if (text) result.push({ time, text });
        }
    }
    return result;
};

export const fetchPlaylistDetails = async (id: string | number, source: string = 'netease'): Promise<Song[]> => {
    try {
        const response = await fetch(TUNEHUB_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': TUNEHUB_API_KEY },
            body: JSON.stringify({ platform: source, type: 'playlist', id })
        });
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.data || []);
        
        return list.map((item: any) => ({
             id: item.id,
             name: item.name,
             ar: item.artist ? item.artist.map((a: string) => ({ id: 0, name: a })) : [],
             al: { id: 0, name: item.album || '', picUrl: toHttps(item.pic) },
             dt: 0,
             source: item.source || source,
             url: toHttps(item.url)
        }));
    } catch (e) {
        console.error("Fetch playlist failed", e);
    }
    return [];
};

export const checkGuestLimit = async (): Promise<{ allowed: boolean, count: number }> => {
    // Check local storage for basic rate limiting without auth
    // In production, this should call a backend endpoint to prevent client-side manipulation
    const count = parseInt(localStorage.getItem('guest_play_count') || '0');
    const allowed = count < 20; // GUEST_PLAY_LIMIT
    
    // Only increment if allowed
    if (allowed) {
        localStorage.setItem('guest_play_count', (count + 1).toString());
    }
    
    return { allowed, count: allowed ? count + 1 : count };
};

export const addToHistory = async (userId: string, song: Song) => {
    try {
        // Check if exists first to avoid duplicates or update timestamp
        const { data: existing } = await supabase
            .from('play_history')
            .select('id')
            .eq('user_id', userId)
            .eq('song_id', String(song.id))
            .single();

        if (existing) {
             await supabase
                .from('play_history')
                .update({ played_at: new Date().toISOString() })
                .eq('id', existing.id);
        } else {
             await supabase
                .from('play_history')
                .insert({ 
                    user_id: userId, 
                    song_id: String(song.id), 
                    title: song.name,
                    artist: song.ar.map(a => a.name).join(', '),
                    album: song.al.name,
                    cover_url: song.al.picUrl,
                    source: song.source || 'netease',
                    song_json: song 
                });
        }
    } catch (e) {
        console.error("Add history failed", e);
    }
};

export const getHistory = async (userId: string): Promise<Song[]> => {
    const { data } = await supabase
        .from('play_history')
        .select('*')
        .eq('user_id', userId)
        .order('played_at', { ascending: false })
        .limit(50);
        
    return (data || []).map((item: any) => item.song_json as Song);
};
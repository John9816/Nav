import { Song, Playlist, LyricLine } from '../types';
import { supabase } from './supabaseClient';

// API Configuration
const TUNEHUB_API_URL = 'https://tunehub.sayqz.com/api/v1/meting';
const TUNEHUB_API_KEY = 'sayqz-tunehub-public'; 

// Quality Priority Chain
const QUALITY_LEVELS = ['flac24bit', 'flac', '320k', '128k'];

export const urlPromiseCache = new Map<string, Promise<string>>();

// Helper to enforce HTTPS
const toHttps = (url: string) => {
    if (!url) return '';
    return url.replace(/^http:\/\//i, 'https://');
};

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

const mapQQItemToSong = (item: any): Song => {
    // QQ often uses 'mid' (media id) for playback and 'id' for metadata. 
    // TuneHub generally prefers 'mid' for QQ if available.
    const id = item.mid || item.file?.media_mid || item.id; 
    const name = item.name || item.title || item.songname || 'Unknown Title';
    
    // Artist
    const singers = item.singer || item.singers || [];
    const artists = Array.isArray(singers)
        ? singers.map((s: any) => ({ id: s.mid || 0, name: s.name || 'Unknown' }))
        : [{ id: 0, name: 'Unknown Artist' }];

    // Album
    const albumMid = item.album?.mid || item.albummid;
    const albumName = item.album?.name || item.albumname || 'Unknown Album';
    const picUrl = albumMid ? `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg` : '';

    return {
        id: id,
        name: name,
        ar: artists,
        al: { id: 0, name: albumName, picUrl: toHttps(picUrl) },
        dt: item.interval ? item.interval * 1000 : 0,
        source: 'qq',
        url: undefined
    };
};

/**
 * Fetch Netease Top Lists
 */
const fetchNeteaseTopLists = async (): Promise<Playlist[]> => {
  try {
    const response = await fetch('/netease-api/api/toplist');
    const data = await response.json();
    const list = data.list || [];
    
    if (list.length > 0) {
        return list.slice(0, 15).map((item: any) => ({
            id: item.id,
            name: item.name,
            coverImgUrl: toHttps(item.coverImgUrl || item.picUrl),
            description: item.description || '',
            trackCount: item.trackCount || 0,
            playCount: item.playCount || 0,
            source: 'netease'
        }));
    }
    return [];
  } catch (e) {
    console.warn("Fetch Netease toplists failed", e);
    return [];
  }
};

/**
 * Fetch QQ Top Lists
 */
const fetchQQTopLists = async (): Promise<Playlist[]> => {
    try {
        const response = await fetch('/qq-api/cgi-bin/musicu.fcg', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                comm: {
                    cv: 4747474,
                    ct: 24,
                    format: "json",
                    inCharset: "utf-8",
                    outCharset: "utf-8",
                    uin: 0
                },
                toplist: { module: "musicToplist.ToplistInfoServer", method: "GetAll", param: {} }
            })
        });
        
        if (!response.ok) throw new Error("QQ API Network Error");

        const data = await response.json();
        const groups = data.toplist?.data?.group || [];
        let lists: Playlist[] = [];

        groups.forEach((group: any) => {
            if (group.list && Array.isArray(group.list)) {
                const mapped = group.list.map((item: any) => ({
                    id: item.topId, // Use topId for details fetching
                    name: item.label || item.title || item.groupName,
                    coverImgUrl: toHttps(item.pic || item.frontPicUrl || item.headPicUrl),
                    description: item.intro || '',
                    trackCount: 0, 
                    playCount: item.listenNum || item.listennum || 0,
                    source: 'qq'
                }));
                lists = lists.concat(mapped);
            }
        });

        return lists.filter(l => l.id).slice(0, 20);
    } catch (e) {
        console.warn("Fetch QQ toplists failed", e);
        return [];
    }
};

/**
 * Fetch Combined Top Lists
 */
export const fetchTopLists = async (): Promise<Playlist[]> => {
  // Removed cache to ensure source property is always populated correctly
  console.log("Fetching Top Lists...");
  const [neteaseLists, qqLists] = await Promise.all([
      fetchNeteaseTopLists(),
      fetchQQTopLists()
  ]);
  console.log(`Fetched: Netease(${neteaseLists.length}), QQ(${qqLists.length})`);

  return [...neteaseLists, ...qqLists];
};

/**
 * Search Songs via Proxy
 */
export const searchSongs = async (keywords: string, page: number = 1, limit: number = 20): Promise<Song[]> => {
  try {
    const offset = (page > 0 ? page - 1 : 0) * limit;
    const response = await fetch(
        `/netease-api/api/search/get/web?s=${encodeURIComponent(keywords)}&type=1&offset=${offset}&limit=${limit}`, 
        { headers: { 'Accept': 'application/json' } }
    );

    const data = await response.json();
    const songs = data.result?.songs || [];
    return songs.map(mapApiItemToSong);
  } catch (error) {
    console.error("Search failed:", error);
    return [];
  }
};

/**
 * Batch resolve URLs with Quality Fallback.
 */
export const resolveBatchUrls = async (songs: Song[], quality: string = '320k'): Promise<Song[]> => {
  if (songs.length === 0) return [];
  
  const neteaseSongs = songs.filter(s => !s.source || s.source === 'netease');
  const qqSongs = songs.filter(s => s.source === 'qq');
  
  let resolved: Song[] = [];

  if (neteaseSongs.length > 0) {
      resolved = resolved.concat(await resolveBatchForSource(neteaseSongs, 'netease', quality));
  }
  if (qqSongs.length > 0) {
      resolved = resolved.concat(await resolveBatchForSource(qqSongs, 'qq', quality));
  }

  return songs.map(s => resolved.find(r => String(r.id) === String(s.id)) || s);
};

const resolveBatchForSource = async (songs: Song[], source: string, quality: string) => {
    const batch = songs.slice(0, 20); 
    const startIdx = QUALITY_LEVELS.indexOf(quality);
    const qualitiesToTry = startIdx === -1 ? ['320k', '128k'] : QUALITY_LEVELS.slice(startIdx);

    const resolvedMap = new Map<string, string>();
    let idsToFetch = batch.map(s => String(s.id));

    for (const q of qualitiesToTry) {
        if (idsToFetch.length === 0) break;

        try {
            const idsStr = idsToFetch.join(',');
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
                    id: idsStr,
                    quality: q
                })
            });

            if (!response.ok) continue;

            const result = await response.json();
            const list = Array.isArray(result) ? result : (result.data || []);

            if (list.length > 0) {
                list.forEach((item: any) => {
                    if (item.url) {
                        const idStr = String(item.id);
                        if (!resolvedMap.has(idStr)) {
                            const secureUrl = toHttps(item.url);
                            resolvedMap.set(idStr, secureUrl);
                            const cacheKey = `${idStr}-${quality}`;
                            urlPromiseCache.set(cacheKey, Promise.resolve(secureUrl));
                        }
                    }
                });
            }

            idsToFetch = idsToFetch.filter(id => !resolvedMap.has(id));

        } catch (err) {
            console.warn(`Batch resolve failed for ${q} (${source}):`, err);
        }
    }

    return songs.map(song => ({
        ...song,
        url: resolvedMap.get(String(song.id)) || song.url
    }));
};

/**
 * Fetch a single song URL with fallback logic.
 */
export const fetchSongUrl = async (id: string | number, source: string = 'netease', quality: string = '320k'): Promise<string | null> => {
    const cacheKey = `${id}-${quality}`;
    if (urlPromiseCache.has(cacheKey)) {
        return urlPromiseCache.get(cacheKey)!;
    }

    const startIdx = QUALITY_LEVELS.indexOf(quality);
    const qualitiesToTry = startIdx === -1 ? ['320k', '128k'] : QUALITY_LEVELS.slice(startIdx);

    const fetchTask = async (): Promise<string | null> => {
        for (const q of qualitiesToTry) {
            try {
                const response = await fetch(TUNEHUB_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-API-Key': TUNEHUB_API_KEY },
                    body: JSON.stringify({ platform: source, type: 'url', id, quality: q })
                });
                const data = await response.json();
                const list = Array.isArray(data) ? data : (data.data || []);
                
                if (list.length > 0 && list[0].url) {
                    return toHttps(list[0].url);
                }
            } catch (e) {
                console.error(`Fetch URL failed for ${q}`, e);
            }
        }
        return null;
    };

    const promise = fetchTask();
    urlPromiseCache.set(cacheKey, promise);
    
    promise.then(url => {
        if (!url) urlPromiseCache.delete(cacheKey);
    });

    return promise;
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

/**
 * Fetch Playlist Details with Fallback
 * Tries Meting first, then Netease Proxy if source is netease, then QQ Proxy if source is qq
 */
export const fetchPlaylistDetails = async (id: string | number, source: string = 'netease'): Promise<Song[]> => {
    console.log(`fetchPlaylistDetails: id=${id}, source=${source}`);
    
    // QQ Music Handling
    if (source === 'qq') {
        try {
            const response = await fetch('/qq-api/cgi-bin/musicu.fcg', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    comm: {
                        cv: 4747474,
                        ct: 24,
                        format: "json",
                        inCharset: "utf-8",
                        outCharset: "utf-8",
                        uin: 0
                    },
                    toplist: {
                        module: "musicToplist.ToplistInfoServer",
                        method: "GetDetail",
                        param: {
                            topId: Number(id),
                            offset: 0,
                            num: 100,
                            period: ""
                        }
                    }
                })
            });
            const data = await response.json();
            const songList = data.toplist?.data?.songInfoList || [];
            console.log(`QQ Playlist fetched: ${songList.length} songs`);
            return songList.map(mapQQItemToSong);
        } catch (e) {
            console.error("QQ Playlist detail fetch failed", e);
            return [];
        }
    }

    // Netease Handling (Existing)
    // 1. Try Meting API
    try {
        const response = await fetch(TUNEHUB_API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': TUNEHUB_API_KEY },
            body: JSON.stringify({ platform: source, type: 'playlist', id })
        });
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.data || []);
        
        if (list.length > 0) {
            return list.map((item: any) => ({
                 id: item.id,
                 name: item.name,
                 ar: item.artist ? item.artist.map((a: string) => ({ id: 0, name: a })) : [],
                 al: { id: 0, name: item.album || '', picUrl: toHttps(item.pic) },
                 dt: 0,
                 source: item.source || source,
                 url: toHttps(item.url)
            }));
        }
    } catch (e) {
        console.warn("Meting playlist fetch failed, trying fallback...", e);
    }

    // 2. Fallback to Netease Proxy (only for Netease)
    if (source === 'netease') {
        try {
            // Fetch playlist detail which usually includes tracks for charts
            const response = await fetch(`/netease-api/api/playlist/detail?id=${id}`);
            const data = await response.json();
            
            if (data.code === 200 && data.result && data.result.tracks) {
                return data.result.tracks.map((item: any) => ({
                    id: item.id,
                    name: item.name,
                    ar: item.artists ? item.artists.map((a: any) => ({ id: a.id, name: a.name })) : [],
                    al: { id: item.album?.id || 0, name: item.album?.name || '', picUrl: toHttps(item.album?.picUrl) },
                    dt: item.duration,
                    source: 'netease',
                    url: undefined
                }));
            }
        } catch (e) {
            console.error("Proxy playlist fetch failed", e);
        }
    }
    
    return [];
};

export const checkGuestLimit = async (): Promise<{ allowed: boolean, count: number }> => {
    const count = parseInt(localStorage.getItem('guest_play_count') || '0');
    const allowed = count < 20; 
    
    if (allowed) {
        localStorage.setItem('guest_play_count', (count + 1).toString());
    }
    
    return { allowed, count: allowed ? count + 1 : count };
};

export const addToHistory = async (userId: string, song: Song) => {
    try {
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
import { Song, Playlist, LyricLine } from '../types';
import { supabase } from './supabaseClient';

// API Configuration
const PARSE_API_URL = '/music-api/parse';   // Proxy endpoint for audio URLs
const CY_API_KEY = '62ccfd8be755cc5850046044c6348d6cac5ef31bd5874c1352287facc06f94c4';

// Quality Priority Chain
const QUALITY_LEVELS = ['flac24bit', 'flac', '320k', '128k'];

// Cache now stores an object containing URL and optional lyric
export const urlPromiseCache = new Map<string, Promise<{ url: string, lyric?: string } | null>>();

// Helper to enforce HTTPS
const toHttps = (url: string) => {
    if (!url) return '';
    return url.replace(/^http:\/\//i, 'https://');
};

// Helper to map internal source to Parse API platform param (Audio URL)
// Parse API usually expects 'qq' for QQ Music
const getParsePlatform = (source: string) => {
    return source; // 'netease' | 'qq' | 'kuwo'
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

// Mapper for GDStudio (MKOnlinePlayer style) response
const mapGDStudioItemToSong = (item: any): Song => {
    // Structure typically: 
    // { id, name, artist: [], album, pic_id, url_id, lyric_id, source, pic, url }
    
    let artists: { id: number; name: string }[] = [];
    if (Array.isArray(item.artist)) {
        artists = item.artist.map((a: string) => ({ id: 0, name: a }));
    } else if (typeof item.artist === 'string') {
        // Sometimes it's a comma separated string or just a name
        artists = [{ id: 0, name: item.artist }];
    } else {
        artists = [{ id: 0, name: 'Unknown Artist' }];
    }

    return {
        id: item.id,
        name: item.name,
        ar: artists,
        al: {
            id: 0,
            name: item.album || '',
            picUrl: toHttps(item.pic) || '' 
        },
        dt: 0, // Often missing in search results, filled later
        source: 'netease',
        url: item.url || undefined
    };
};

// Mapper for Netease Search API (Official /api/search/get)
// This endpoint often returns songs without cover images, so we provide a default
const mapNeteaseSearchItem = (item: any): Song => {
    const artists = item.artists 
        ? item.artists.map((a: any) => ({ id: a.id, name: a.name })) 
        : [{ id: 0, name: 'Unknown Artist' }];
    
    const album = item.album || {};
    
    return {
        id: item.id,
        name: item.name,
        ar: artists,
        al: {
            id: album.id || 0,
            name: album.name || 'Unknown Album',
            // Default Netease cover if missing
            picUrl: album.picUrl ? toHttps(album.picUrl) : 'https://p2.music.126.net/tGHU62DTszbFQ37W9qPHcg==/2002210674180197.jpg' 
        },
        dt: item.duration || 0,
        source: 'netease',
        url: undefined
    };
};

const mapQQItemToSong = (item: any): Song => {
    // QQ often uses 'mid' (media id) for playback and 'id' for metadata. 
    // TuneHub generally prefers 'mid' for QQ if available.
    // For search results from musicu.fcg, 'mid' is the string ID we want.
    const id = item.mid || item.file?.media_mid || item.id || item.songId; 
    const name = item.name || item.title || item.songname || 'Unknown Title';
    
    // Artist
    let artists = [{ id: 0, name: 'Unknown Artist' }];
    if (Array.isArray(item.singer)) {
        artists = item.singer.map((s: any) => ({ id: s.mid || 0, name: s.name || 'Unknown' }));
    } else if (Array.isArray(item.singers)) {
        artists = item.singers.map((s: any) => ({ id: s.mid || 0, name: s.name || 'Unknown' }));
    } else if (typeof item.singerName === 'string') {
        artists = item.singerName.split('/').map((n: string) => ({ id: 0, name: n.trim() }));
    } else if (typeof item.singer === 'string') {
        artists = [{ id: 0, name: item.singer }];
    }

    // Album
    // Handle various casing and nesting for album MID found in different QQ APIs
    const albumObj = item.album || {};
    const albumMid = albumObj.mid || albumObj.kid || item.albummid || item.albumMid || item.album_mid;
    const albumId = albumObj.id || item.albumid || item.albumId; // Integer ID as fallback
    const albumName = albumObj.name || item.albumname || item.albumName || 'Unknown Album';
    
    // Cover
    // 1. Try direct cover property (common in some endpoints)
    // 2. Try constructing from album mid
    // 3. Fallback to album id
    let picUrl = item.cover || item.albumpic || albumObj.cover || albumObj.pic;
    
    if (!picUrl) {
        if (albumMid) {
             picUrl = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`;
        } else if (albumId) {
             // Fallback using integer ID logic if MID is missing
             const albIdStr = String(albumId);
             picUrl = `https://imgcache.qq.com/music/photo/album_300/${albIdStr.length % 100}/300_albumpic_${albIdStr}_0.jpg`;
        }
    }
    
    return {
        id: id,
        name: name,
        ar: artists,
        al: { id: albumId || 0, name: albumName, picUrl: toHttps(picUrl) },
        dt: item.interval ? item.interval * 1000 : 0,
        source: 'qq',
        url: undefined
    };
};

const mapKuwoItemToSong = (item: any): Song => {
    // Kuwo IDs often look like "MUSIC_12345". 
    // Most parse APIs expect just the numeric part, but some handle both.
    // We strip "MUSIC_" to be safe for compatibility with generic Meting-style APIs.
    const rawId = item.MUSICRID || item.musicrid || '';
    const id = rawId.replace('MUSIC_', '');
    
    // Decode HTML entities in names if necessary (Kuwo sometimes returns encoded strings)
    const decode = (str: string) => {
        if (!str) return '';
        return str.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"');
    };

    const name = decode(item.SONGNAME || item.songname || 'Unknown Title');
    const artistName = decode(item.ARTIST || item.artist || 'Unknown Artist');
    const albumName = decode(item.ALBUM || item.album || 'Unknown Album');

    return {
        id: id,
        name: name,
        ar: [{ id: 0, name: artistName }],
        al: { 
            id: 0, 
            name: albumName, 
            // Kuwo search often doesn't return album art. 
            // We can try a heuristic or leave empty.
            // Some results might have `albumpic` or `web_albumpic_short`.
            picUrl: item.albumpic || item.web_albumpic_short || '' 
        },
        dt: item.duration ? parseInt(item.duration) * 1000 : 0,
        source: 'kuwo',
        url: undefined
    };
};

/**
 * Fetch a Random Song
 */
export const fetchRandomMusic = async (): Promise<Song | null> => {
    try {
        // Use the new proxy for random music
        const response = await fetch('/random-music-api/api/wangyi/randomMusic?type=json');
        
        if (!response.ok) {
            throw new Error(`Random Music API Error: ${response.status}`);
        }

        const json = await response.json();
        
        if (json.code === 200 && json.data) {
            const data = json.data;
            // Map the API response to our Song interface
            return {
                id: data.id || 'rand-' + Date.now(), 
                name: data.name || 'Unknown Title',
                ar: [{ id: 0, name: data.artistsname || 'Unknown Artist' }],
                al: { 
                    id: 0, 
                    name: data.album || 'Random Mix', 
                    picUrl: toHttps(data.picurl) || 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop'
                },
                dt: data.duration || 0, 
                url: toHttps(data.url), // The API provides the direct URL
                source: 'netease', // It comes from Wangyi API, so we use 'netease' to allow lyric fetching
                lyric: undefined
            };
        }
        return null;
    } catch (e) {
        console.warn("Fetch random music failed", e);
        return null;
    }
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
            source: 'netease' as const
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
        console.log("Fetching QQ Top Lists via Proxy...");
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
        
        if (!response.ok) throw new Error(`QQ API Network Error: ${response.status}`);

        const data = await response.json();
        
        const groups = data.toplist?.data?.group || [];
        let lists: Playlist[] = [];

        groups.forEach((group: any) => {
            const charts = group.toplist || group.list || [];
            if (Array.isArray(charts)) {
                const mapped = charts.map((item: any) => ({
                    id: item.topId, 
                    name: item.title || item.label || item.groupName,
                    coverImgUrl: toHttps(item.headPicUrl || item.frontPicUrl || item.pic),
                    description: item.intro || '',
                    trackCount: item.totalNum || 0, 
                    playCount: item.listenNum || 0,
                    source: 'qq' as const
                }));
                lists = lists.concat(mapped);
            }
        });

        // Filter valid ones and limit
        const result = lists.filter(l => l.id).slice(0, 20);
        console.log(`Parsed ${result.length} QQ charts.`);
        return result;
    } catch (e) {
        console.warn("Fetch QQ toplists failed", e);
        return [];
    }
};

/**
 * Fetch Kuwo Top Lists
 */
const fetchKuwoTopLists = async (): Promise<Playlist[]> => {
    try {
        const response = await fetch('/kuwo-data-api/q.k?op=query&cont=tree&node=2&pn=0&rn=1000&fmt=json&level=2');
        if (!response.ok) throw new Error(`Kuwo API Error: ${response.status}`);
        
        const data = await response.json();
        
        // The response structure is usually { child: [ ... ] }
        const rawList = data.child || [];
        let lists: Playlist[] = [];

        // Recursive helper to flatten the tree structure and extract actual lists
        const extractLists = (items: any[]) => {
            items.forEach(item => {
                // If it has a sourceid, it's a playlist we can use
                if (item.sourceid) { 
                    lists.push({
                        id: item.sourceid,
                        name: item.name || item.disname || 'Unknown List',
                        coverImgUrl: toHttps(item.pic || item.icon50), // icon50 might be too small
                        description: item.intro || '',
                        trackCount: 0, 
                        playCount: 0, 
                        source: 'kuwo' as const
                    });
                }
                // Recursively check children
                if (item.child && Array.isArray(item.child)) {
                    extractLists(item.child);
                }
            });
        };

        extractLists(rawList);
        
        // Limit to reasonable amount
        const result = lists.slice(0, 20);
        console.log(`Parsed ${result.length} Kuwo charts.`);
        return result;
    } catch (e) {
        console.warn("Fetch Kuwo toplists failed", e);
        return [];
    }
};

/**
 * Fetch Combined Top Lists
 */
export const fetchTopLists = async (): Promise<Playlist[]> => {
  console.log("Fetching Top Lists...");
  const [neteaseLists, qqLists, kuwoLists] = await Promise.all([
      fetchNeteaseTopLists(),
      fetchQQTopLists(),
      fetchKuwoTopLists()
  ]);
  console.log(`Fetched: Netease(${neteaseLists.length}), QQ(${qqLists.length}), Kuwo(${kuwoLists.length})`);

  return [...neteaseLists, ...qqLists, ...kuwoLists];
};

/**
 * Search Songs (Supports Netease, QQ, Kuwo)
 */
export const searchSongs = async (
    keywords: string, 
    source: 'netease' | 'qq' | 'kuwo' = 'netease', 
    page: number = 1, 
    limit: number = 20
): Promise<Song[]> => {
  try {
    // Netease Search API (Using new GDStudio API via GET request)
    if (source === 'netease') {
        try {
            const queryParams = new URLSearchParams({
                types: 'search',
                count: String(limit),
                source: 'netease',
                pages: String(page),
                name: keywords
            });

            // Make a GET request matching the provided URL format
            const response = await fetch(`/gdstudio-api/api.php?${queryParams.toString()}`);
            const data = await response.json();
            
            if (Array.isArray(data)) {
                return data.map(mapGDStudioItemToSong);
            }
            return [];
        } catch (e) {
            console.warn("Netease search failed", e);
        }
    }

    // QQ Direct Search via Proxy
    if (source === 'qq') {
        try {
            const response = await fetch('/qq-api/cgi-bin/musicu.fcg', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    comm: {
                        ct: "19",
                        cv: "1873",
                        uin: "0"
                    },
                    "music.search.SearchCgiService": {
                        method: "DoSearchForQQMusicDesktop",
                        module: "music.search.SearchCgiService",
                        param: {
                            grp: 1,
                            num_per_page: limit,
                            page_num: page,
                            query: keywords,
                            search_type: 0
                        }
                    }
                })
            });
            const data = await response.json();
            const searchResult = data['music.search.SearchCgiService']?.data?.body?.song?.list || [];
            
            if (searchResult.length > 0) {
                return searchResult.map(mapQQItemToSong);
            }
            return [];
        } catch (e) {
            console.warn("QQ direct search failed", e);
        }
    }

    // Kuwo Direct Search via Proxy (New Endpoint)
    if (source === 'kuwo') {
        try {
            const params = new URLSearchParams({
                vipver: '1',
                client: 'kt',
                ft: 'music',
                cluster: '0',
                strategy: '2012',
                encoding: 'utf8',
                rformat: 'json',
                mobi: '1',
                issubtitle: '1',
                show_copyright_off: '1',
                pn: String(page - 1), // 0-indexed
                rn: String(limit),
                all: keywords
            });

            // Use the new www.kuwo.cn proxy
            const response = await fetch(`/kuwo-www-api/search/searchMusicBykeyWord?${params.toString()}`);
            
            const text = await response.text();
            let data: any = {};
            
            try {
                // The response is usually JSON, but sometimes might need cleaning
                data = JSON.parse(text);
            } catch (e) {
                console.warn("Kuwo search returned non-standard JSON, trying to parse safely...", e);
                try {
                    // Fallback cleanup if needed (though searchMusicBykeyWord is usually standard JSON)
                    const fixedJson = text.replace(/([a-zA-Z0-9_]+?):/g, '"$1":').replace(/'/g, '"');
                    data = JSON.parse(fixedJson);
                } catch (e2) {
                    console.error("Failed to fix Kuwo JSON", e2);
                }
            }

            const abslist = data.abslist || [];
            if (abslist.length > 0) {
                return abslist.map(mapKuwoItemToSong);
            }
            return [];
        } catch (e) {
            console.warn("Kuwo direct search failed", e);
        }
    }

    return [];

  } catch (error) {
    console.error(`Search failed for ${source}:`, error);
    return [];
  }
};

/**
 * Batch resolve URLs (Converted to Single Requests Concurrently)
 */
export const resolveBatchUrls = async (songs: Song[], quality: string = '320k'): Promise<Song[]> => {
  if (songs.length === 0) return [];

  // Instead of grouping IDs and sending a batch request, 
  // we concurrently call fetchSongUrl for each song.
  // This reuses the single-parse logic which includes quality fallback.
  
  const songPromises = songs.map(async (song) => {
      // Reuse existing fetchSongUrl which handles caching and retry logic
      const result = await fetchSongUrl(
          song.id, 
          song.source || 'netease', 
          quality,
          { name: song.name, artist: song.ar?.[0]?.name }
      );
      
      return {
          ...song,
          url: result?.url || song.url, // Update if we found a URL, otherwise keep existing
          lyric: result?.lyric || song.lyric // Opportunistically update lyric if found in parse response
      };
  });

  // Wait for all single requests to complete
  const resolvedSongs = await Promise.all(songPromises);
  
  return resolvedSongs;
};

/**
 * Fetch a single song URL with fallback logic using PARSE endpoint.
 * Returns object with URL and optional lyrics.
 */
export const fetchSongUrl = async (
    id: string | number, 
    source: string = 'netease', 
    quality: string = '320k',
    metadata?: { name?: string, artist?: string }
): Promise<{ url: string, lyric?: string } | null> => {
    const cacheKey = `${id}-${quality}`;
    if (urlPromiseCache.has(cacheKey)) {
        return urlPromiseCache.get(cacheKey)!;
    }

    const startIdx = QUALITY_LEVELS.indexOf(quality);
    let qualitiesToTry = startIdx === -1 ? ['320k', '128k'] : QUALITY_LEVELS.slice(startIdx);

    // FIX: Kuwo FLAC is often OGG container which fails on Safari/iOS. 
    // Prefer 320k (MP3) for Kuwo to ensure playback compatibility unless 320k is not available then fallback.
    // We remove flac/flac24bit from priority list for Kuwo.
    if (source === 'kuwo') {
        qualitiesToTry = qualitiesToTry.filter(q => q !== 'flac' && q !== 'flac24bit');
        if (!qualitiesToTry.includes('320k')) qualitiesToTry.unshift('320k');
        if (!qualitiesToTry.includes('128k')) qualitiesToTry.push('128k');
    }

    // Special handling for random songs that already have a direct URL
    if (source === 'random') {
        return null;
    }

    // --- NETEASE LOGIC ---
    if (source === 'netease') {
         const fetchNetease = async (): Promise<{ url: string, lyric?: string } | null> => {
            try {
                // Use random-music-api for Netease URL fetching (Keeping original valid logic for URLs)
                const response = await fetch(`/random-music-api/api/wangyi/music?type=json&id=${id}`);
                const data = await response.json();
                if (data.code === 200 && data.data && data.data.url) {
                    return {
                        url: toHttps(data.data.url)
                    };
                }
            } catch (e) {
                console.error("Netease API fetch failed", e);
            }
            return null;
        };
        
        const promise = fetchNetease();
        urlPromiseCache.set(cacheKey, promise);
        promise.then(result => { if (!result) urlPromiseCache.delete(cacheKey); });
        return promise;
    }
    // ---------------------------

    // QQ Music: Use new Search-Based API (cyapi.top)
    if (source === 'qq' && metadata?.name) {
        const fetchQQTask = async (): Promise<{ url: string, lyric?: string } | null> => {
            try {
                // Use Name + Artist for better accuracy, or just Name
                const searchQuery = metadata.artist ? `${metadata.name} ${metadata.artist}` : metadata.name;
                const encodedMsg = encodeURIComponent(searchQuery || '');
                
                // Using new proxy /cy-api
                const response = await fetch(`/cy-api/API/qq_music.php?apikey=${CY_API_KEY}&type=json&n=1&msg=${encodedMsg}`, {
                    headers: { 'priority': 'u=1, i' }
                });
                
                if (!response.ok) throw new Error(`CY API Error: ${response.status}`);
                
                const json = await response.json();
                
                let data = json.data || json;
                if (Array.isArray(data)) data = data[0];

                const musicUrl = data.music_url || data.url || data.song_url || data.mp3;
                const lyric = data.lyric || data.lrc;

                if (musicUrl) {
                    return {
                        url: toHttps(musicUrl),
                        lyric: lyric && typeof lyric === 'object' ? lyric.text : lyric
                    };
                }
            } catch (e) {
                console.error("QQ CY API fetch failed", e);
            }
            return null;
        };
        
        const promise = fetchQQTask();
        urlPromiseCache.set(cacheKey, promise);
        promise.then(result => { if (!result) urlPromiseCache.delete(cacheKey); });
        return promise;
    }

    // Kuwo Music: Use new API (yunzhiapi.cn)
    if (source === 'kuwo' && metadata?.name) {
        const fetchKuwoTask = async (): Promise<{ url: string, lyric?: string } | null> => {
            try {
                // Just use the name as per new API spec requirement
                const searchQuery = metadata.name; 
                const encodedMsg = encodeURIComponent(searchQuery || '');
                
                // Use proxy for Yunzhi API
                const response = await fetch(`/yunzhi-api/API/kwyyjx.php?msg=${encodedMsg}&n=1`);
                
                if (!response.ok) throw new Error(`Yunzhi API Error: ${response.status}`);
                
                const json = await response.json();
                
                // Flexible parsing logic for typical JX APIs
                // Often structure is: { code: 200, data: { url: ... } } or { url: ... }
                const data = json.data || json;
                
                // Field names might vary
                const musicUrl = data.url || data.music_url || data.mp3 || json.url;
                const lyric = data.lyric || data.lrc || json.lyric; 

                if (musicUrl) {
                    return {
                        url: toHttps(musicUrl),
                        lyric: lyric
                    };
                }
            } catch (e) {
                console.error("Kuwo Yunzhi API fetch failed", e);
            }
            return null;
        };
        
        const promise = fetchKuwoTask();
        urlPromiseCache.set(cacheKey, promise);
        promise.then(result => { if (!result) urlPromiseCache.delete(cacheKey); });
        return promise;
    }

    const fetchTask = async (): Promise<{ url: string, lyric?: string } | null> => {
        for (const q of qualitiesToTry) {
            try {
                const response = await fetch(PARSE_API_URL, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ 
                        platform: getParsePlatform(source), 
                        ids: String(id), // Parsing single ID
                        quality: q 
                    })
                });
                const data = await response.json();
                
                // Robust response parsing to handle different nesting levels
                // Structure can be: 
                // 1. Array directly: [...]
                // 2. Standard wrapper: { data: [...] }
                // 3. Nested wrapper (QQ): { data: { data: [...] } }
                let list: any[] = [];
                if (Array.isArray(data)) {
                    list = data;
                } else if (data.data) {
                    if (Array.isArray(data.data)) {
                        list = data.data;
                    } else if (typeof data.data === 'object' && data.data.data && Array.isArray(data.data.data)) {
                        list = data.data.data;
                    }
                }
                
                if (list.length > 0 && list[0].url) {
                    return {
                        url: toHttps(list[0].url),
                        lyric: list[0].lyrics || undefined 
                    };
                }
            } catch (e) {
                console.error(`Fetch URL failed for ${q}`, e);
            }
        }
        return null;
    };

    const promise = fetchTask();
    urlPromiseCache.set(cacheKey, promise);
    
    promise.then(result => {
        if (!result) urlPromiseCache.delete(cacheKey);
    });

    return promise;
};

export const fetchSongDetail = async (id: string | number, source: string = 'netease'): Promise<Song | null> => {
    // Direct Netease Proxy fallback since TuneHub is removed
    if (source === 'netease') {
        try {
            const response = await fetch(`/netease-api/api/song/detail?ids=${id}`);
            const data = await response.json();
            if (data.songs && data.songs.length > 0) {
                return mapApiItemToSong(data.songs[0]);
            }
        } catch (e) {
            console.error("Netease detail fetch failed", e);
        }
    }
    // For other sources, if detail is missing, we might return null.
    // Usually lists already contain most info.
    return null;
};

// Modified to return both parsed lines and raw text for storage
export const fetchLyrics = async (id: string | number, source: string = 'netease'): Promise<{ lines: LyricLine[], raw: string }> => {
    // Direct Netease Proxy fallback since TuneHub is removed
    if (source === 'netease') {
        try {
            // Using random-music-api for Netease lyrics via proxy (Keeping original valid logic for Lyrics)
            const response = await fetch(`/random-music-api/api/wangyi/lyrics?id=${id}`);
            const data = await response.json();
            
            // Expected structure: { code: 200, data: { lyric: "..." } }
            if (data.code === 200 && data.data && data.data.lyric) {
                return {
                    lines: parseLyrics(data.data.lyric),
                    raw: data.data.lyric
                };
            }
        } catch (e) {
            console.error("Netease lyrics fetch failed", e);
        }
    }
    
    // QQ lyrics are often handled via fetchSongUrl (Parse/CY API)
    return { lines: [], raw: '' };
};

export const parseLyrics = (lrc: string): LyricLine[] => {
    if (!lrc) return [];
    const lines = lrc.split('\n');
    const result: LyricLine[] = [];
    // Relaxed regex: 
    // Group 1: Min (1-2 digits)
    // Group 2: Sec (1-2 digits)
    // Group 3: Optional MS (1-3 digits), allowing . or : as separator
    const timeRegex = /\[(\d{1,2}):(\d{1,2})(?:[\.:](\d{1,3}))?\]/;
    
    for (const line of lines) {
        const match = timeRegex.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const msStr = match[3];
            let msInSeconds = 0;
            
            if (msStr) {
                const ms = parseInt(msStr);
                if (msStr.length === 2) msInSeconds = ms / 100;
                else if (msStr.length === 3) msInSeconds = ms / 1000;
                else msInSeconds = ms / 10;
            }
            
            const time = min * 60 + sec + msInSeconds;
            const text = line.replace(timeRegex, '').trim();
            if (text) result.push({ time, text });
        }
    }
    return result;
};

/**
 * Fetch Playlist Details with Fallback
 * Tries Netease Proxy if source is netease, then QQ Proxy if source is qq
 */
export const fetchPlaylistDetails = async (id: string | number, source: string = 'netease'): Promise<Song[]> => {
    console.log(`fetchPlaylistDetails: id=${id}, source=${source}`);
    
    // QQ Music Handling (Keep as is, uses Proxy)
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
            // Typically songInfoList is at data.toplist.data.songInfoList
            // Fallback to data.detail or just data.songInfoList if structure varies
            const songList = data.toplist?.data?.songInfoList || 
                             data.detail?.data?.songInfoList || 
                             data.songInfoList || 
                             [];
            console.log(`QQ Playlist fetched: ${songList.length} songs`);
            return songList.map(mapQQItemToSong);
        } catch (e) {
            console.error("QQ Playlist detail fetch failed", e);
            return [];
        }
    }

    // Netease Handling
    // Priority 1: Direct Proxy (Optimized for Large Lists)
    if (source === 'netease') {
        try {
            console.log("Fetching Netease playlist via Proxy...");
            const response = await fetch(`/netease-api/api/playlist/detail?id=${id}`);
            const data = await response.json();
            
            const resultObj = data.result || data.playlist;
            
            if (data.code === 200 && resultObj) {
                // OPTIMIZATION:
                // Official Top Lists or large playlists often return incomplete 'tracks' array
                // or throttle the response if we rely on it.
                // However, 'trackIds' is always complete.
                // We use trackIds to fetch details via /song/detail which is much faster and reliable.
                
                const trackIds = resultObj.trackIds || [];
                
                if (trackIds.length > 0) {
                     console.log(`Netease Proxy: Found ${trackIds.length} IDs, fetching details...`);
                     const ids = trackIds.map((t: any) => t.id);
                     
                     // Fetch in chunks of 500 to be safe (URL length limits)
                     // Netease supports many IDs, but 500 is a safe upper bound for GET requests
                     const chunkSize = 500;
                     const chunks = [];
                     for (let i = 0; i < ids.length; i += chunkSize) {
                         const chunk = ids.slice(i, i + chunkSize);
                         chunks.push(chunk.join(','));
                     }

                     const responses = await Promise.all(chunks.map(chunkIds => 
                         fetch(`/netease-api/api/song/detail?ids=${chunkIds}`).then(res => res.json())
                     ));
                     
                     let allSongs: any[] = [];
                     responses.forEach(res => {
                         if (res.songs) allSongs = allSongs.concat(res.songs);
                     });

                     if (allSongs.length > 0) {
                        console.log(`Netease Proxy: Fetched ${allSongs.length} song details successfully.`);
                        return allSongs.map(mapApiItemToSong);
                     }
                }
                
                // Fallback: If trackIds logic fails, try the standard tracks array
                if (resultObj.tracks && resultObj.tracks.length > 0) {
                    console.log(`Netease Proxy: Fallback to existing tracks array`);
                    return resultObj.tracks.map((item: any) => ({
                        id: item.id,
                        name: item.name,
                        ar: item.artists ? item.artists.map((a: any) => ({ id: a.id, name: a.name })) : (item.ar || []),
                        al: { 
                            id: item.album?.id || 0, 
                            name: item.album?.name || '', 
                            picUrl: toHttps(item.album?.picUrl || item.al?.picUrl) 
                        },
                        dt: item.duration || item.dt,
                        source: 'netease' as const,
                        url: undefined
                    }));
                }
            }
        } catch (e) {
            console.warn("Netease Proxy playlist fetch failed", e);
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

// Updated to save lyric AND url
export const addToHistory = async (userId: string, song: Song, lyric?: string) => {
    try {
        const { data: existing } = await supabase
            .from('music_history')
            .select('id')
            .eq('user_id', userId)
            .eq('song_id', String(song.id))
            .single();

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
             // Only update fields, preserve ID
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

// Updated to save lyric AND url
export const toggleLike = async (userId: string, song: Song, lyric?: string): Promise<boolean> => {
    const { data } = await supabase
        .from('liked_songs')
        .select('id')
        .eq('user_id', userId)
        .eq('song_id', String(song.id))
        .single();
        
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
        .single();
    return !!data;
};
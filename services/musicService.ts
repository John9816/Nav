import { Song, Playlist, LyricLine } from '../types';
import { supabase } from './supabaseClient';

// API Configuration
const PARSE_API_URL = '/music-api/parse';   // Proxy endpoint for audio URLs
const CY_API_KEY = '62ccfd8be755cc5850046044c6348d6cac5ef31bd5874c1352287facc06f94c4';

// Quality Priority Chain
const QUALITY_LEVELS = ['flac24bit', 'flac', '320k', '128k'];

// Cache for audio URLs
export const urlPromiseCache = new Map<string, Promise<{ url: string, lyric?: string } | null>>();

// Cache for Cover URLs to avoid repeated API calls
const coverCache = new Map<string, Promise<string | undefined>>();

// Helper to enforce HTTPS
const toHttps = (url: string) => {
    if (!url) return '';
    return url.replace(/^http:\/\//i, 'https://');
};

// Helper to resolve Netease Cover URL from GDStudio JSON API
const resolveNeteaseCover = async (picId: string | number): Promise<string | undefined> => {
    if (!picId) return undefined;
    const key = String(picId);
    
    if (coverCache.has(key)) {
        return coverCache.get(key);
    }

    const fetchTask = async () => {
        try {
            // Using the interface provided by user which returns JSON
            const response = await fetch(`/gdstudio-api/api.php?types=pic&source=netease&id=${picId}&size=500`);
            const data = await response.json();
            if (data && data.url) {
                return toHttps(data.url);
            }
        } catch (e) {
            console.warn(`Failed to resolve cover for ${picId}`, e);
        }
        return undefined;
    };

    const promise = fetchTask();
    coverCache.set(key, promise);
    return promise;
};

// Helper to map internal source to Parse API platform param (Audio URL)
const getParsePlatform = (source: string) => {
    return source; // 'netease' | 'qq' | 'kuwo'
};

// --- Mappers now return Promises to handle async cover fetching ---

const mapApiItemToSong = async (item: any): Promise<Song> => {
  const id = item.id || item.rid;
  const name = item.name || item.songName || 'Unknown Title';
  
  // Artist
  const ar = item.ar || item.artists || (item.artist ? [{name: item.artist}] : []) || [];
  const artists = Array.isArray(ar) 
      ? ar.map((a: any) => ({ id: a.id || 0, name: a.name || 'Unknown' })) 
      : [{ id: 0, name: String(ar) }];

  // Album
  const al = item.al || item.album || {};
  let picUrl = toHttps(al.picUrl || item.picUrl || item.img120 || '');
  
  // Try to resolve cover via API if picId exists
  // We prioritize this if the original picUrl is suspicious or just to ensure we use the requested interface
  if (al.picId) {
      const resolvedUrl = await resolveNeteaseCover(al.picId);
      if (resolvedUrl) {
          picUrl = resolvedUrl;
      }
  }

  const album = {
      id: al.id || 0,
      name: al.name || item.albumName || 'Unknown Album',
      picUrl: picUrl
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
const mapGDStudioItemToSong = async (item: any): Promise<Song> => {
    let artists: { id: number; name: string }[] = [];
    if (Array.isArray(item.artist)) {
        artists = item.artist.map((a: string) => ({ id: 0, name: a }));
    } else if (typeof item.artist === 'string') {
        artists = [{ id: 0, name: item.artist }];
    } else {
        artists = [{ id: 0, name: 'Unknown Artist' }];
    }

    let picUrl = toHttps(item.pic) || '';
    
    // Resolve via API if pic_id exists
    if (item.pic_id) {
        const resolvedUrl = await resolveNeteaseCover(item.pic_id);
        if (resolvedUrl) {
            picUrl = resolvedUrl;
        }
    }

    return {
        id: item.id,
        name: item.name,
        ar: artists,
        al: {
            id: 0,
            name: item.album || '',
            picUrl: picUrl
        },
        dt: 0, 
        source: 'netease',
        url: item.url || undefined
    };
};

const mapQQItemToSong = (item: any): Song => {
    // QQ logic remains synchronous as we handle URLs differently
    const id = item.mid || item.file?.media_mid || item.id || item.songId; 
    const name = item.name || item.title || item.songname || 'Unknown Title';
    
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

    const albumObj = item.album || {};
    const albumMid = albumObj.mid || albumObj.kid || item.albummid || item.albumMid || item.album_mid;
    const albumId = albumObj.id || item.albumid || item.albumId; 
    const albumName = albumObj.name || item.albumname || item.albumName || 'Unknown Album';
    
    let picUrl = item.cover || item.albumpic || albumObj.cover || albumObj.pic;
    
    if (!picUrl) {
        if (albumMid) {
             picUrl = `https://y.gtimg.cn/music/photo_new/T002R300x300M000${albumMid}.jpg`;
        } else if (albumId) {
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
    const rawId = item.MUSICRID || item.musicrid || '';
    const id = rawId.replace('MUSIC_', '');
    
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
        const response = await fetch('/random-music-api/api/wangyi/randomMusic?type=json');
        
        if (!response.ok) {
            throw new Error(`Random Music API Error: ${response.status}`);
        }

        const json = await response.json();
        
        if (json.code === 200 && json.data) {
            const data = json.data;
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
                url: toHttps(data.url), 
                source: 'netease', 
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
                comm: { cv: 4747474, ct: 24, format: "json", inCharset: "utf-8", outCharset: "utf-8", uin: 0 },
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

        return lists.filter(l => l.id).slice(0, 20);
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
        const rawList = data.child || [];
        let lists: Playlist[] = [];

        const extractLists = (items: any[]) => {
            items.forEach(item => {
                if (item.sourceid) { 
                    lists.push({
                        id: item.sourceid,
                        name: item.name || item.disname || 'Unknown List',
                        coverImgUrl: toHttps(item.pic || item.icon50), 
                        description: item.intro || '',
                        trackCount: 0, 
                        playCount: 0, 
                        source: 'kuwo' as const
                    });
                }
                if (item.child && Array.isArray(item.child)) {
                    extractLists(item.child);
                }
            });
        };

        extractLists(rawList);
        return lists.slice(0, 20);
    } catch (e) {
        console.warn("Fetch Kuwo toplists failed", e);
        return [];
    }
};

/**
 * Fetch Combined Top Lists
 */
export const fetchTopLists = async (): Promise<Playlist[]> => {
  const [neteaseLists, qqLists, kuwoLists] = await Promise.all([
      fetchNeteaseTopLists(),
      fetchQQTopLists(),
      fetchKuwoTopLists()
  ]);
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
    // Netease Search API
    if (source === 'netease') {
        try {
            const queryParams = new URLSearchParams({
                types: 'search',
                count: String(limit),
                source: 'netease',
                pages: String(page),
                name: keywords
            });

            const response = await fetch(`/gdstudio-api/api.php?${queryParams.toString()}`);
            const data = await response.json();
            
            if (Array.isArray(data)) {
                // Map asynchronously to resolve covers
                return await Promise.all(data.map(mapGDStudioItemToSong));
            }
            return [];
        } catch (e) {
            console.warn("Netease search failed", e);
        }
    }

    // QQ Direct Search
    if (source === 'qq') {
        try {
            const response = await fetch('/qq-api/cgi-bin/musicu.fcg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    comm: { ct: "19", cv: "1873", uin: "0" },
                    "music.search.SearchCgiService": {
                        method: "DoSearchForQQMusicDesktop",
                        module: "music.search.SearchCgiService",
                        param: { grp: 1, num_per_page: limit, page_num: page, query: keywords, search_type: 0 }
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

    // Kuwo Direct Search
    if (source === 'kuwo') {
        try {
            const params = new URLSearchParams({
                vipver: '1', client: 'kt', ft: 'music', cluster: '0', strategy: '2012', encoding: 'utf8', rformat: 'json',
                mobi: '1', issubtitle: '1', show_copyright_off: '1', pn: String(page - 1), rn: String(limit), all: keywords
            });

            const response = await fetch(`/kuwo-www-api/search/searchMusicBykeyWord?${params.toString()}`);
            const text = await response.text();
            let data: any = {};
            try { data = JSON.parse(text); } catch (e) { 
                try { data = JSON.parse(text.replace(/([a-zA-Z0-9_]+?):/g, '"$1":').replace(/'/g, '"')); } catch (e2) {}
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
 * Batch resolve URLs
 */
export const resolveBatchUrls = async (songs: Song[], quality: string = '320k'): Promise<Song[]> => {
  if (songs.length === 0) return [];
  
  const songPromises = songs.map(async (song) => {
      const result = await fetchSongUrl(
          song.id, 
          song.source || 'netease', 
          quality,
          { name: song.name, artist: song.ar?.[0]?.name }
      );
      return {
          ...song,
          url: result?.url || song.url, 
          lyric: result?.lyric || song.lyric 
      };
  });

  return await Promise.all(songPromises);
};

/**
 * Fetch a single song URL
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

    if (source === 'kuwo') {
        qualitiesToTry = qualitiesToTry.filter(q => q !== 'flac' && q !== 'flac24bit');
        if (!qualitiesToTry.includes('320k')) qualitiesToTry.unshift('320k');
        if (!qualitiesToTry.includes('128k')) qualitiesToTry.push('128k');
    }

    if (source === 'random') return null;

    // Netease (GDStudio URL)
    if (source === 'netease') {
         const fetchNetease = async (): Promise<{ url: string, lyric?: string } | null> => {
            try {
                const response = await fetch(`/gdstudio-api/api.php?types=url&source=netease&id=${id}&br=999`);
                const data = await response.json();
                if (data && data.url) {
                    return { url: toHttps(data.url) };
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

    // QQ Music (CY API)
    if (source === 'qq' && metadata?.name) {
        const fetchQQTask = async (): Promise<{ url: string, lyric?: string } | null> => {
            try {
                const searchQuery = metadata.artist ? `${metadata.name} ${metadata.artist}` : metadata.name;
                const encodedMsg = encodeURIComponent(searchQuery || '');
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

    // Kuwo Music (Yunzhi API)
    if (source === 'kuwo' && metadata?.name) {
        const fetchKuwoTask = async (): Promise<{ url: string, lyric?: string } | null> => {
            try {
                const searchQuery = metadata.name; 
                const encodedMsg = encodeURIComponent(searchQuery || '');
                const response = await fetch(`/yunzhi-api/API/kwyyjx.php?msg=${encodedMsg}&n=1`);
                
                if (!response.ok) throw new Error(`Yunzhi API Error: ${response.status}`);
                const json = await response.json();
                const data = json.data || json;
                const musicUrl = data.url || data.music_url || data.mp3 || json.url;
                const lyric = data.lyric || data.lrc || json.lyric; 

                if (musicUrl) {
                    return { url: toHttps(musicUrl), lyric: lyric };
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

    // Default Parse API
    const fetchTask = async (): Promise<{ url: string, lyric?: string } | null> => {
        for (const q of qualitiesToTry) {
            try {
                const response = await fetch(PARSE_API_URL, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ platform: getParsePlatform(source), ids: String(id), quality: q })
                });
                const data = await response.json();
                let list: any[] = [];
                if (Array.isArray(data)) list = data;
                else if (data.data) {
                    if (Array.isArray(data.data)) list = data.data;
                    else if (typeof data.data === 'object' && data.data.data && Array.isArray(data.data.data)) list = data.data.data;
                }
                
                if (list.length > 0 && list[0].url) {
                    return { url: toHttps(list[0].url), lyric: list[0].lyrics || undefined };
                }
            } catch (e) {
                console.error(`Fetch URL failed for ${q}`, e);
            }
        }
        return null;
    };

    const promise = fetchTask();
    urlPromiseCache.set(cacheKey, promise);
    promise.then(result => { if (!result) urlPromiseCache.delete(cacheKey); });
    return promise;
};

export const fetchSongDetail = async (id: string | number, source: string = 'netease'): Promise<Song | null> => {
    if (source === 'netease') {
        try {
            const response = await fetch(`/netease-api/api/song/detail?ids=${id}`);
            const data = await response.json();
            if (data.songs && data.songs.length > 0) {
                return await mapApiItemToSong(data.songs[0]);
            }
        } catch (e) {
            console.error("Netease detail fetch failed", e);
        }
    }
    return null;
};

// Lyrics
export const fetchLyrics = async (id: string | number, source: string = 'netease'): Promise<{ lines: LyricLine[], raw: string }> => {
    if (source === 'netease') {
        try {
            const response = await fetch(`/random-music-api/api/wangyi/lyrics?id=${id}`);
            const data = await response.json();
            if (data.code === 200 && data.data && data.data.lyric) {
                return { lines: parseLyrics(data.data.lyric), raw: data.data.lyric };
            }
        } catch (e) {
            console.error("Netease lyrics fetch failed", e);
        }
    }
    return { lines: [], raw: '' };
};

export const parseLyrics = (lrc: string): LyricLine[] => {
    if (!lrc) return [];
    const lines = lrc.split('\n');
    const result: LyricLine[] = [];
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
 */
export const fetchPlaylistDetails = async (id: string | number, source: string = 'netease'): Promise<Song[]> => {
    console.log(`fetchPlaylistDetails: id=${id}, source=${source}`);
    
    if (source === 'qq') {
        try {
            const response = await fetch('/qq-api/cgi-bin/musicu.fcg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    comm: { cv: 4747474, ct: 24, format: "json", inCharset: "utf-8", outCharset: "utf-8", uin: 0 },
                    toplist: { module: "musicToplist.ToplistInfoServer", method: "GetDetail", param: { topId: Number(id), offset: 0, num: 100, period: "" } }
                })
            });
            const data = await response.json();
            const songList = data.toplist?.data?.songInfoList || data.detail?.data?.songInfoList || data.songInfoList || [];
            return songList.map(mapQQItemToSong);
        } catch (e) {
            console.error("QQ Playlist detail fetch failed", e);
            return [];
        }
    }

    if (source === 'netease') {
        try {
            console.log("Fetching Netease playlist via Proxy...");
            const response = await fetch(`/netease-api/api/playlist/detail?id=${id}`);
            const data = await response.json();
            
            const resultObj = data.result || data.playlist;
            
            if (data.code === 200 && resultObj) {
                const trackIds = resultObj.trackIds || [];
                
                if (trackIds.length > 0) {
                     console.log(`Netease Proxy: Found ${trackIds.length} IDs, fetching details...`);
                     const ids = trackIds.map((t: any) => t.id);
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
                        // Map all songs asynchronously to resolve covers
                        // We use Promise.all to fetch covers in parallel where needed
                        return await Promise.all(allSongs.map(mapApiItemToSong));
                     }
                }
                
                if (resultObj.tracks && resultObj.tracks.length > 0) {
                    // Fallback to tracks array
                    // Since this item structure mimics the detail structure, we can reuse mapApiItemToSong
                    return await Promise.all(resultObj.tracks.map(mapApiItemToSong));
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
        
        if (lyric) payload.lyric = lyric;
        if (song.url) payload.url = song.url;

        if (existing) {
             const { user_id, song_id, ...updates } = payload;
             await supabase.from('music_history').update(updates).eq('id', existing.id);
        } else {
             await supabase.from('music_history').insert(payload);
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
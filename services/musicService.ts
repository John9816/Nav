import { Playlist, Song, LyricLine } from '../types';
import { supabase } from './supabaseClient';

// Public Netease Cloud Music API instance (TuneHub)
const API_BASE = 'https://tunehub.sayqz.com'; 
const API_KEY = 'th_3063e4ad2ef8075774abd413a417ce31914b60d8776c5549';

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

// Helper to ensure HTTPS
const toHttps = (url: string) => {
  if (!url) return '';
  if (url.startsWith('http:')) {
    return url.replace('http:', 'https:');
  }
  return url;
};

// Robust Fetch Helper for Netease API
const fetchNetease = async (endpoint: string, params: Record<string, string> = {}) => {
  // Construct URL path and search query
  const urlObj = new URL('https://music.163.com' + endpoint);
  Object.entries(params).forEach(([k, v]) => urlObj.searchParams.append(k, v));
  const fullPath = urlObj.pathname + urlObj.search;

  // 1. Try Local Proxy (Primary) - Maps to https://music.163.com via Vite/Vercel
  // This handles CORS and Referer headers on the server side (vite.config.ts / vercel.json)
  try {
    const localUrl = `/netease-api${fullPath}`;
    const response = await fetch(localUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      }
    });

    if (response.ok) {
      // Some proxies return 200 but HTML error pages
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }
    }
  } catch (e) {
    console.warn("Local proxy fetch failed, trying fallback...", e);
  }

  // 2. Fallback to AllOrigins Raw (Often more reliable for Netease than corsproxy.io)
  // We use 'raw' to get the JSON directly
  try {
    const targetUrl = `https://music.163.com${fullPath}`;
    const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      referrerPolicy: 'no-referrer' // Important: Try to hide our origin
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // console.warn("AllOrigins fallback failed", e);
  }

  // 3. Fallback to CORS Proxy (corsproxy.io)
  try {
    const targetUrl = `https://music.163.com${fullPath}`;
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      referrerPolicy: 'no-referrer' // Try to avoid sending origin that Netease might block
    });

    if (response.ok) {
      return await response.json();
    }
  } catch (e) {
    // console.warn("Corsproxy fallback failed", e);
  }

  throw new Error(`All fallbacks failed for ${endpoint}`);
};

// Helper to map API item to Song type
const mapApiItemToSong = (item: any): Song => {
  const id = item.id || item.rid; // netease uses id, some others might use rid
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
    source: 'netease', // Default, but might be overridden if we add source param later
    url: undefined // URL fetched separately
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
// Multi-Platform Aggregator
// ==========================================

// 类型定义
type Platform = 'kuwo' | 'netease' | 'qq' | string;

interface MethodConfig {
  type: string; // "http"
  method: string; // "GET" | "POST"
  url: string;
  params?: Record<string, string>;
  body?: Record<string, any>;
  headers?: Record<string, string>;
  transform?: string;
}

interface TemplateVariables {
  keyword: string;
  page: string;
  pageSize: string;
  limit?: string; // Alias for pageSize
  id?: string;
  br?: string;
}

interface NormalizedSong {
  id: string | number;
  name: string;
  artist: string;
  album: string;
  duration: number;
  platform: Platform;
  platforms?: Platform[];  // 多平台可用时标记
  cover?: string;
  url?: string | null;
  quality?: '128k' | '320k' | 'flac' | string;
  raw?: unknown; // 保留原始数据备用
}

interface UpstreamResponse {
  platform: Platform;
  data: unknown;
  raw: unknown;
}

interface SearchResult {
  total: number;
  items: NormalizedSong[];
  platforms: PlatformStat[];
}

interface PlatformStat {
  platform: Platform;
  status: 'fulfilled' | 'rejected';
  count: number;
  error?: string;
}

class MultiPlatformAggregator {
  private platforms: Platform[];
  private baseUrl: string;
  private proxyUrl: string;

  constructor(
    platforms: Platform[] = ['kuwo', 'netease', 'qq'],
    baseUrl: string = '/api/v1/methods',
    // Direct request without proxy
    proxyUrl: string = '' 
  ) {
    this.platforms = platforms;
    this.baseUrl = baseUrl;
    this.proxyUrl = proxyUrl;
  }

  /**
   * 主搜索方法：仅使用网易云音乐接口
   */
  public async search(
    keyword: string,
    page: number = 0,
    pageSize: number = 20
  ): Promise<SearchResult> {
    try {
      const offset = page * pageSize;
      
      // Use helper to fetch with fallback
      const data = await fetchNetease('/api/search/get/web', {
          s: keyword,
          type: '1',
          offset: String(offset),
          limit: String(pageSize)
      });

      const songs = data.result?.songs || [];
      
      const items: NormalizedSong[] = songs.map((item: any) => ({
          id: String(item.id),
          name: item.name,
          artist: item.artists ? item.artists.map((a: any) => a.name).join(', ') : (item.artist || 'Unknown'),
          album: item.album ? item.album.name : '',
          duration: item.duration || 0,
          platform: 'netease',
          cover: item.album?.picUrl || '',
          url: undefined 
      }));

      return {
          total: items.length,
          items: items,
          platforms: [{ platform: 'netease', status: 'fulfilled', count: items.length }]
      };

    } catch (error) {
      console.error('Search failed:', error);
      return {
          total: 0,
          items: [],
          platforms: [{ platform: 'netease', status: 'rejected', count: 0, error: String(error) }]
      };
    }
  }

  /**
   * 通用方法调用
   */
  public async executeMethod(
    platform: Platform,
    func: string,
    variables: Partial<TemplateVariables> = {}
  ): Promise<any> {
    const config = await this.getMethodConfig(platform, func);
    const vars: TemplateVariables = {
        keyword: variables.keyword || '',
        page: variables.page || '0',
        pageSize: variables.pageSize || '20',
        limit: variables.limit || variables.pageSize || '20',
        id: variables.id || '',
        br: variables.br || ''
    };
    
    const response = await this.requestUpstream(config, vars, platform);
    return response.data;
  }

  /**
   * 获取方法配置（方法下发）
   */
  private async getMethodConfig(
    platform: Platform, 
    func: string
  ): Promise<MethodConfig> {
    // Hardcoded config for Netease Search to use specific API endpoint
    if (platform === 'netease' && func === 'search') {
       return {
           type: "http",
           method: "GET",
           url: "https://music.163.com/api/search/get/web",
           params: {
               s: "{{keyword}}",
               type: "1",
               offset: "{{((page || 1) - 1) * (limit || 20)}}",
               limit: "{{limit || 20}}"
           },
           headers: {
               "Referer": "https://music.163.com/",
               "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
               "Accept": "application/json, text/plain, */*",
               "Accept-Language": "zh-CN,zh;q=0.9"
           },
           transform: `function(response) {
               var songs = response.result && response.result.songs;
               if (!songs) return [];
               return songs.map(function(item) {
                 return {
                   id: String(item.id),
                   name: item.name,
                   artist: item.artists.map(function(a) { return a.name; }).join(', '),
                   album: item.album && item.album.name || ''
                 };
               });
             }`
       };
    }

    const url = `${API_BASE}${this.baseUrl}/${platform}/${func}`;
    const response = await fetch(url, {
      headers: { 
          'Accept': 'application/json',
          'X-API-Key': API_KEY 
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result: { code: number; data: MethodConfig; msg?: string } = 
      await response.json();
    
    if (result.code !== 0) {
      throw new Error(result.msg || 'Invalid config response');
    }

    return result.data;
  }

  /**
   * 向上游平台发起请求
   */
  private async requestUpstream(
    config: MethodConfig,
    variables: TemplateVariables,
    platform: Platform
  ): Promise<UpstreamResponse> {
    
    // 1. 处理 Params
    const params: Record<string, string> = {};
    if (config.params) {
        for (const [key, value] of Object.entries(config.params)) {
            params[key] = this.replaceVariables(String(value), variables);
        }
    }
    
    // 2. 构建 URL
    const urlObj = new URL(config.url);
    // 将 params 添加到 URL
    Object.entries(params).forEach(([key, value]) => {
      urlObj.searchParams.set(key, value);
    });

    // 3. 处理 Body (如果是 POST)
    let body: BodyInit | null = null;
    if (config.method === 'POST' && config.body) {
        // 如果 body 是 JSON 对象，需要进行变量替换
        const processedBody: Record<string, any> = {};
        for (const [key, value] of Object.entries(config.body)) {
             if (typeof value === 'string') {
                 processedBody[key] = this.replaceVariables(value, variables);
             } else {
                 processedBody[key] = value;
             }
        }
        body = JSON.stringify(processedBody);
    }

    // 4. 处理 Headers
    const headers: Record<string, string> = config.headers || {};
    if (config.method === 'POST' && !headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
    }

    // 5. 发起请求 (使用代理转发)
    let fetchUrl = urlObj.toString();
    
    if (this.proxyUrl) {
         const fullProxyUrl = this.proxyUrl.startsWith('http') 
            ? this.proxyUrl 
            : `${API_BASE}${this.proxyUrl}`;
         
         // 包装成代理请求
         // 注意：corsproxy.io 只需要将 URL 拼接到后面
         fetchUrl = `${fullProxyUrl}${encodeURIComponent(fetchUrl)}`;
    }

    const response = await fetch(fetchUrl, {
      method: config.method,
      headers: headers,
      body: body
    });

    if (!response.ok) {
      throw new Error(`Upstream HTTP ${response.status}`);
    }

    const data: unknown = await response.json();
    
    // 6. 执行 Transform
    let processedData = data;
    if (config.transform) {
      processedData = this.executeTransform(config.transform, data);
    }
    
    // 确保 processedData 是数组
    if (!Array.isArray(processedData)) {
        if (processedData && typeof processedData === 'object' && 'list' in (processedData as any)) {
             processedData = (processedData as any).list;
        }
    }

    return { platform, data: processedData, raw: data };
  }

  private replaceVariables(str: string, variables: TemplateVariables): string {
      return str.replace(/{{(.*?)}}/g, (match, expression) => {
          const key = expression.trim();
          // 1. Simple replacement
          if (key in variables) {
              return (variables as any)[key] || '';
          }

          // 2. Expression evaluation
          try {
              // Convert string numbers to actual numbers for math operations
              const ctx: Record<string, any> = {};
              for (const [k, v] of Object.entries(variables)) {
                  const num = Number(v);
                  ctx[k] = (v !== '' && !isNaN(num)) ? num : v;
              }

              const keys = Object.keys(ctx);
              const values = keys.map(k => ctx[k]);
              
              // Create function with variable names as arguments
              const fn = new Function(...keys, `return ${expression}`);
              return String(fn(...values));
          } catch (e) {
              // console.warn(`Template evaluation failed for "${expression}":`, e);
              return match;
          }
      });
  }

  /**
   * 执行 transform 函数字符串
   */
  private executeTransform(
    transformStr: string,
    response: unknown
  ): any {
    try {
      const fn = new Function('response', `return (${transformStr})(response)`);
      return fn(response);
    } catch (error) {
      console.warn('Transform execution failed:', error);
      return []; 
    }
  }

  /**
   * 合并多个平台的结果
   */
  private mergeResults(
    results: PromiseSettledResult<UpstreamResponse>[],
    keyword: string
  ): NormalizedSong[] {
    const allItems: NormalizedSong[] = [];

    results.forEach((result, index) => {
      const platform = this.platforms[index];
      
      if (result.status !== 'fulfilled') {
        return;
      }
      
      const val = result.value;
      if ((val as any).error) return; 

      const data = val.data;

      // Validate and cast data
      if (Array.isArray(data)) {
          const normalized = data.map((item: any) => this.ensureNormalized(item, platform));
          allItems.push(...normalized);
      }
    });

    // 去重并标记多平台
    const deduped = this.deduplicate(allItems);
    
    // 排序
    return this.sortResults(deduped, keyword);
  }

  /**
   * 确保数据符合 NormalizedSong 接口
   */
  private ensureNormalized(item: any, platform: Platform): NormalizedSong {
      return {
          id: item.id || item.rid || item.musicrid || 0,
          name: item.name || item.songName || 'Unknown',
          artist: item.artist || (Array.isArray(item.ar) ? item.ar.map((a:any)=>a.name).join('/') : '') || 'Unknown',
          album: item.album || (item.al ? item.al.name : '') || '',
          duration: Number(item.duration || item.dt || 0),
          platform: platform,
          cover: item.cover || item.pic || item.picUrl || '',
          quality: item.quality,
          url: item.url
      };
  }

  /**
   * 去重逻辑
   */
  private deduplicate(items: NormalizedSong[]): NormalizedSong[] {
    const unique: NormalizedSong[] = [];
    const seen = new Map<string, NormalizedSong>(); 

    items.forEach(item => {
      const fingerprint = this.generateFingerprint(item.name, item.artist);
      const existing = seen.get(fingerprint);

      if (!existing) {
        seen.set(fingerprint, { ...item, platforms: [item.platform] });
        unique.push(seen.get(fingerprint)!);
      } else {
        if (!existing.platforms?.includes(item.platform)) {
          existing.platforms!.push(item.platform);
        }
        if (item.cover && !existing.cover) existing.cover = item.cover;
      }
    });

    return unique;
  }

  private generateFingerprint(name: string, artist: string): string {
    const normalize = (str: string) => 
      String(str).toLowerCase()
         .replace(/[\s\-·．•]+/g, '') 
         .replace(/[^\w\u4e00-\u9fa5]/g, ''); 
    
    return `${normalize(name)}-${normalize(artist)}`;
  }

  private sortResults(items: NormalizedSong[], keyword: string): NormalizedSong[] {
    const platformWeight: Record<string, number> = {
      netease: 3,
      qq: 2,
      kuwo: 1
    };

    const lowerKeyword = keyword.toLowerCase();

    return items.sort((a, b) => {
      const aExact = a.name.toLowerCase() === lowerKeyword ? 2 : 
                     a.name.toLowerCase().includes(lowerKeyword) ? 1 : 0;
      const bExact = b.name.toLowerCase() === lowerKeyword ? 2 : 
                     b.name.toLowerCase().includes(lowerKeyword) ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;

      const weightDiff = (platformWeight[b.platform] || 0) - (platformWeight[a.platform] || 0);
      if (weightDiff !== 0) return weightDiff;

      return 0;
    });
  }

  private getPlatformStats(
    results: PromiseSettledResult<UpstreamResponse>[]
  ): PlatformStat[] {
    return results.map((result, index) => {
      const platform = this.platforms[index];
      if (result.status === 'fulfilled' && !(result.value as any).error) {
        const count = Array.isArray(result.value.data) ? result.value.data.length : 0;
        return {
          platform,
          status: 'fulfilled',
          count
        };
      } else {
        return {
          platform,
          status: 'rejected',
          count: 0,
          error: result.status === 'rejected' ? String(result.reason) : String((result.value as any).error)
        };
      }
    });
  }
}

// Instantiate the aggregator with proxy
const aggregator = new MultiPlatformAggregator();

// Existing other methods (fetchTopLists, etc.) remain...

export const fetchTopLists = async (): Promise<Playlist[]> => {
  try {
    // Use robust fetchNetease which includes fallbacks
    const data = await fetchNetease('/api/toplist');
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
    // Use robust fetchNetease which includes fallbacks
    const data = await fetchNetease('/api/playlist/detail', {
        id: String(id),
        n: '100000',
        s: '8'
    });
    
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
    // Use fetchNetease to be robust
    const data = await fetchNetease('/api/song/detail', { ids: `[${id}]` });
    
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

export const fetchSongUrl = async (id: number | string, source: string = 'netease', br: string = '320k'): Promise<string | null> => {
  // 1. Try API via TuneHub v1/parse
  try {
      const response = await fetch('https://tunehub.sayqz.com/v1/parse', {
          method: 'POST',
          headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
              'Content-Type': 'application/json',
              'Origin': 'https://tunehub.sayqz.com',
              'Priority': 'u=1, i',
              'Referer': 'https://tunehub.sayqz.com/test',
              'X-API-Key': API_KEY
          },
          body: JSON.stringify({
              platform: source,
              ids: String(id),
              quality: br
          })
      });

      if (response.ok) {
          const result = await response.json();
          // Handle response format from user example
          if (result && result.success && result.data && Array.isArray(result.data.data) && result.data.data.length > 0) {
              const songData = result.data.data[0];
              if (songData && songData.success && songData.url) {
                  return toHttps(songData.url);
              }
          }
      }
  } catch(e) {
      console.warn("API URL fetch failed, using fallback", e);
  }

  // 2. Fallback to Direct standard Netease URL (Most reliable for free songs)
  return `https://music.163.com/song/media/outer/url?id=${id}.mp3`;
};

export const fetchLyrics = async (id: number | string, source: string = 'netease'): Promise<LyricLine[]> => {
  try {
    // 1. Try API via TuneHub v1/parse (same as song url)
    const response = await fetch('https://tunehub.sayqz.com/v1/parse', {
          method: 'POST',
          headers: {
              'Accept': 'application/json, text/plain, */*',
              'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
              'Content-Type': 'application/json',
              'Origin': 'https://tunehub.sayqz.com',
              'Priority': 'u=1, i',
              'Referer': 'https://tunehub.sayqz.com/test',
              'X-API-Key': API_KEY
          },
          body: JSON.stringify({
              platform: source,
              ids: String(id),
              quality: 'flac24bit' // Quality doesn't matter for lyrics, but required
          })
      });

    if (response.ok) {
        const result = await response.json();
        if (result && result.success && result.data && Array.isArray(result.data.data) && result.data.data.length > 0) {
            const songData = result.data.data[0];
            if (songData && songData.success && songData.lyrics) {
                return parseLrc(songData.lyrics);
            }
        }
    }

    return [];
  } catch (error) {
    console.error(`Failed to fetch lyrics for ${id}:`, error);
    return [];
  }
};

// Updated searchSongs using Aggregator with Config Logic
export const searchSongs = async (keywords: string, page: number = 1, limit: number = 10): Promise<Song[]> => {
  try {
    const pageIndex = page > 0 ? page - 1 : 0;
    
    // Use aggregator.search but ensure it uses the robust fetchNetease internally if we updated it
    const result = await aggregator.search(keywords, pageIndex, limit);
    
    // Map NormalizedSong to Application Song Interface
    return result.items.map(item => ({
       id: item.id,
       name: item.name,
       ar: [{ id: 0, name: item.artist }],
       al: { id: 0, name: item.album, picUrl: toHttps(item.cover || '') },
       dt: item.duration, // Should be ms
       source: item.platform,
       url: item.url || undefined
    }));
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
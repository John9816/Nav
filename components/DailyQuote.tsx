import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Quote, RefreshCw } from 'lucide-react';

interface QuoteData {
  hitokoto: string;
  from: string;
  from_who: string | null;
}

const CACHE_KEY = 'daily_quote_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000; // 6 Hours

const BACKUP_QUOTES: QuoteData[] = [
  { hitokoto: "生活原本沉闷，但跑起来就有风。", from: "网络", from_who: null },
  { hitokoto: "热爱可抵岁月漫长。", from: "网络", from_who: null },
  { hitokoto: "星光不问赶路人，时光不负有心人。", from: "网络", from_who: null },
  { hitokoto: "凡是过往，皆为序章。", from: "暴风雨", from_who: "莎士比亚" },
  { hitokoto: "满地都是六便士，他却抬头看见了月亮。", from: "月亮与六便士", from_who: "毛姆" },
  { hitokoto: "人生天地间，忽如远行客。", from: "古诗十九首", from_who: null },
  { hitokoto: "既然选择了远方，便只顾风雨兼程。", from: "热爱生命", from_who: "汪国真" },
  { hitokoto: "海内存知己，天涯若比邻。", from: "送杜少府之任蜀州", from_who: "王勃" },
  { hitokoto: "未曾长夜痛哭者，不足以语人生。", from: "网络", from_who: "歌德" },
  { hitokoto: "知我者，谓我心忧；不知我者，谓我何求。", from: "诗经", from_who: null }
];

const DailyQuote: React.FC = () => {
  // Initialize state from Cache to render immediately
  const [quote, setQuote] = useState<QuoteData | null>(() => {
    try {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            return parsed.data;
        }
    } catch (e) {
        console.warn("Failed to parse quote cache", e);
    }
    return null;
  });

  const [isFetching, setIsFetching] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchQuote = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    
    // Prevent multiple requests
    if (isFetchingRef.current) return;
    
    isFetchingRef.current = true;
    setIsFetching(true);

    // Add timestamp to prevent browser caching
    // Set a timeout to avoid hanging indefinitely
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(`https://v1.hitokoto.cn?t=${Date.now()}`, { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error("Network response was not ok");
        return response.json();
      })
      .then(data => {
        setQuote(data);
        // Update Cache
        try {
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: data,
                timestamp: Date.now()
            }));
        } catch (e) {
            console.warn("Failed to cache quote", e);
        }
      })
      .catch(err => {
        // Only warn, don't error, to keep console clean
        console.warn("Daily Quote API unavailable, switching to backup.", err.name === 'AbortError' ? 'Request Timeout' : err.message);
        
        // Pick a random backup
        const randomBackup = BACKUP_QUOTES[Math.floor(Math.random() * BACKUP_QUOTES.length)];
        
        // If we already have a quote (e.g. from cache but user clicked refresh), 
        // ensure we change it to something else if possible, or just set random.
        setQuote(randomBackup);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsFetching(false);
        isFetchingRef.current = false;
      });
  }, []);

  useEffect(() => {
    // Check if we need to fetch (if no cache or cache is stale)
    const cached = localStorage.getItem(CACHE_KEY);
    let shouldFetch = true;

    if (cached) {
        try {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < CACHE_DURATION) {
                shouldFetch = false;
            }
        } catch(e) {
            // ignore error
        }
    }

    // If we have no quote in state (init failed) OR cache is stale, fetch.
    if (!quote || shouldFetch) {
        fetchQuote();
    }
  }, [fetchQuote]); // Removed 'quote' dependency to avoid circular dependency logic

  // Initial Loading Skeleton (Only when no quote is available at all)
  if (!quote) return (
    <div className="flex flex-col items-center mt-8 space-y-2 select-none h-[68px] justify-center">
      <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
      <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
    </div>
  );

  return (
    <div 
      onClick={fetchQuote}
      className={`flex flex-col items-center mt-8 max-w-3xl mx-auto px-4 text-center animate-in fade-in slide-in-from-bottom-2 duration-700 delay-200 group cursor-pointer select-none transition-all active:scale-95 
        ${isFetching ? 'cursor-wait' : 'active:opacity-70'}
      `}
      title="点击切换每日一言"
    >
      <div className="relative px-8 py-1">
        <Quote className="absolute -top-1 left-0 w-3 h-3 text-slate-300 dark:text-slate-600 transform -scale-x-100 opacity-0 group-hover:opacity-100 transition-opacity" />
        <p className="text-sm md:text-base font-medium text-slate-600 dark:text-slate-300 tracking-wide leading-relaxed font-serif min-h-[1.5rem]">
          {quote.hitokoto}
        </p>
        <Quote className="absolute -bottom-1 right-0 w-3 h-3 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>
      <div className="mt-2 text-xs text-slate-400 dark:text-slate-500 font-medium flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity">
        <span>—</span>
        <span>{quote.from_who ? `${quote.from_who} ` : ''}</span>
        <span>«{quote.from}»</span>
        <RefreshCw 
            size={10} 
            className={`ml-1 transition-all ${isFetching ? 'animate-spin opacity-100' : 'opacity-0 group-hover:opacity-100'}`} 
        />
      </div>
    </div>
  );
};

export default DailyQuote;
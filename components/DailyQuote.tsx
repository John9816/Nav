import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Quote, RefreshCw } from 'lucide-react';

interface QuoteData {
  hitokoto: string;
  from: string;
  from_who: string | null;
}

const CACHE_KEY = 'daily_quote_cache';
const CACHE_DURATION = 6 * 60 * 60 * 1000;

const BACKUP_QUOTES: QuoteData[] = [
  { hitokoto: '生活原本沉闷，但跑起来就有风。', from: '网络', from_who: null },
  { hitokoto: '热爱可抵岁月漫长。', from: '网络', from_who: null },
  { hitokoto: '星光不问赶路人，时光不负有心人。', from: '网络', from_who: null },
  { hitokoto: '凡是过往，皆为序章。', from: '暴风雨', from_who: '莎士比亚' },
  { hitokoto: '满地都是六便士，他却抬头看见了月亮。', from: '月亮与六便士', from_who: '毛姆' },
  { hitokoto: '人生天地间，忽如远行客。', from: '古诗十九首', from_who: null },
  { hitokoto: '既然选择了远方，便只顾风雨兼程。', from: '热爱生命', from_who: '汪国真' },
  { hitokoto: '海内存知己，天涯若比邻。', from: '送杜少府之任蜀州', from_who: '王勃' },
  { hitokoto: '未曾长夜痛哭者，不足以语人生。', from: '网络', from_who: '歌德' },
  { hitokoto: '知我者，谓我心忧；不知我者，谓我何求。', from: '诗经', from_who: null }
];

const DailyQuote: React.FC = () => {
  const [quote, setQuote] = useState<QuoteData | null>(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        return parsed.data;
      }
    } catch (error) {
      console.warn('Failed to parse quote cache', error);
    }
    return null;
  });

  const [isFetching, setIsFetching] = useState(false);
  const isFetchingRef = useRef(false);

  const fetchQuote = useCallback((e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    setIsFetching(true);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    fetch(`https://v1.hitokoto.cn?t=${Date.now()}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Network response was not ok');
        return response.json();
      })
      .then((data) => {
        setQuote(data);
        try {
          localStorage.setItem(
            CACHE_KEY,
            JSON.stringify({
              data,
              timestamp: Date.now(),
            })
          );
        } catch (error) {
          console.warn('Failed to cache quote', error);
        }
      })
      .catch((error) => {
        console.warn(
          'Daily quote API unavailable, switching to backup.',
          error.name === 'AbortError' ? 'Request Timeout' : error.message
        );
        const randomBackup = BACKUP_QUOTES[Math.floor(Math.random() * BACKUP_QUOTES.length)];
        setQuote(randomBackup);
      })
      .finally(() => {
        clearTimeout(timeoutId);
        setIsFetching(false);
        isFetchingRef.current = false;
      });
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(CACHE_KEY);
    let shouldFetch = true;

    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.timestamp < CACHE_DURATION) {
          shouldFetch = false;
        }
      } catch {
        // ignore invalid cache
      }
    }

    if (!quote || shouldFetch) {
      fetchQuote();
    }
  }, [fetchQuote, quote]);

  if (!quote) {
    return (
      <div className="surface-card surface-card-soft rounded-[1.45rem] w-full px-5 py-4">
        <div className="h-4 w-64 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        <div className="h-3 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse mt-3"></div>
      </div>
    );
  }

  return (
    <div
      onClick={fetchQuote}
      className={`surface-card surface-card-soft rounded-[1.55rem] w-full px-4 py-4 md:px-5 md:py-5 group cursor-pointer select-none transition-all active:scale-[0.99]
        ${isFetching ? 'cursor-wait' : 'hover:-translate-y-0.5'}
      `}
      title="点击切换一言"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-[11px] tracking-[0.22em] text-slate-400 dark:text-slate-500">
            <Quote size={14} className="text-amber-600 dark:text-amber-300" />
            一言
          </div>
          <p className="mt-3 text-sm md:text-base font-medium text-slate-700 dark:text-slate-200 leading-7">
            {quote.hitokoto}
          </p>
          <div className="mt-3 text-xs text-slate-500 dark:text-slate-400 font-medium flex items-center gap-1">
            <span>—</span>
            <span>{quote.from_who ? `${quote.from_who} · ` : ''}</span>
            <span>{quote.from}</span>
          </div>
        </div>
        <div className="shrink-0 p-2 rounded-full bg-white/70 dark:bg-slate-900/70 border border-white/60 dark:border-slate-700/60">
          <RefreshCw
            size={14}
            className={`transition-all ${isFetching ? 'animate-spin text-amber-600 dark:text-amber-300' : 'text-slate-400 group-hover:text-amber-600 dark:group-hover:text-amber-300'}`}
          />
        </div>
      </div>
    </div>
  );
};

export default DailyQuote;





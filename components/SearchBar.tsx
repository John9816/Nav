import React, { useState } from 'react';
import { Search, Globe, ChevronDown, X, ArrowUpRight } from 'lucide-react';
import { SearchEngine } from '../types';

const SearchBar: React.FC = () => {
  const [query, setQuery] = useState('');
  const [engine, setEngine] = useState<SearchEngine>(SearchEngine.Google);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    window.location.href = `${engine}${encodeURIComponent(query)}`;
  };

  const clearSearch = () => {
    setQuery('');
  };

  const engineLabel = (value: SearchEngine) => {
    switch (value) {
      case SearchEngine.Google:
        return '谷歌';
      case SearchEngine.Bing:
        return '必应';
      case SearchEngine.Baidu:
        return '百度';
      case SearchEngine.DuckDuckGo:
        return 'DuckDuckGo';
      default:
        return '搜索';
    }
  };

  return (
    <div className="w-full relative z-20">
      <div className="surface-card surface-card-soft rounded-[1.6rem] px-3 py-3 md:px-3.5 md:py-3.5">
        <form onSubmit={handleSearch} className="relative group">
          <div className="absolute inset-y-0 left-0 pl-5 flex items-center pointer-events-none">
            <Search className="h-5 w-5 transition-colors duration-300 text-slate-400 group-focus-within:text-amber-600 dark:group-focus-within:text-amber-300" />
          </div>

          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜索内容"
            className="w-full pl-14 pr-36 md:pr-44 py-[1.125rem] rounded-[1.2rem] text-[15px] transition-all duration-300 shadow-[0_22px_54px_-38px_rgba(66,45,22,0.32)] bg-white/80 border border-white/75 placeholder-slate-400 text-slate-800 hover:bg-white focus:outline-none focus:ring-4 focus:ring-amber-500/10 focus:border-amber-400/35 focus:shadow-[0_28px_64px_-36px_rgba(201,131,77,0.38)] dark:bg-[rgba(7,17,24,0.88)] dark:border-slate-700/70 dark:placeholder-slate-500 dark:text-slate-100 dark:hover:bg-[rgba(9,20,28,0.94)] dark:focus:bg-[rgba(9,20,28,0.98)] dark:focus:ring-amber-400/10 dark:focus:border-amber-300/25"
          />

          <div className="absolute inset-y-0 right-2 flex items-center gap-1.5">
            {query.length > 0 && (
              <button
                type="button"
                onClick={clearSearch}
                className="p-2 rounded-full hover:bg-amber-50 dark:hover:bg-slate-800 text-slate-400 hover:text-amber-600 dark:hover:text-amber-300 transition-colors"
                aria-label="清空搜索"
              >
                <X size={15} />
              </button>
            )}

            <button
              type="button"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-label={`切换搜索引擎，当前${engineLabel(engine)}`}
              title={engineLabel(engine)}
              className="flex items-center justify-center px-3 py-2.5 rounded-[1rem] text-xs font-semibold transition-colors border shadow-sm bg-white/78 hover:bg-amber-50 text-slate-700 border-[rgba(148,114,70,0.14)] dark:bg-slate-900/72 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
            >
              <Globe size={12} />
              <ChevronDown size={10} className={`transition-transform ${isMenuOpen ? 'rotate-180' : ''}`} />
            </button>

            <button
              type="submit"
              className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-[0.95rem] text-xs font-semibold text-white bg-gradient-to-r from-amber-500 to-orange-400 shadow-[0_18px_30px_-20px_rgba(201,131,77,0.42)] hover:translate-y-[-1px] transition-transform dark:from-amber-500 dark:to-orange-400 dark:shadow-[0_18px_30px_-20px_rgba(201,131,77,0.28)]"
            >
              <ArrowUpRight size={12} />
            </button>
          </div>

          {isMenuOpen && (
            <div className="absolute top-full right-0 mt-3 w-44 rounded-[1.4rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50 border bg-[rgba(255,251,245,0.98)] border-[rgba(148,114,70,0.12)] dark:bg-[rgba(9,20,28,0.98)] dark:border-slate-700">
              {Object.values(SearchEngine).map((eng) => (
                <button
                  key={eng}
                  type="button"
                  onClick={() => {
                    setEngine(eng);
                    setIsMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 text-xs transition-colors font-medium hover:bg-amber-50 dark:hover:bg-slate-800 ${
                    engine === eng
                      ? 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-500/10'
                      : 'text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {engineLabel(eng as SearchEngine)}
                </button>
              ))}
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default SearchBar;







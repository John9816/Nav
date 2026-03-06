import React, { useState } from 'react';
import { Search, Globe, ChevronDown, X } from 'lucide-react';
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

  const engineLabel = (e: SearchEngine) => {
    switch(e) {
      case SearchEngine.Google: return 'Google';
      case SearchEngine.Bing: return 'Bing';
      case SearchEngine.Baidu: return 'Baidu';
      case SearchEngine.DuckDuckGo: return 'DuckDuckGo';
      default: return 'Search';
    }
  };

  return (
    <div className="w-full max-w-3xl mx-auto relative z-20">
      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 transition-colors duration-300
            text-slate-400 group-focus-within:text-orange-500 dark:group-focus-within:text-teal-300
          " />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`用 ${engineLabel(engine)} 搜索你想去的地方...`}
          className="w-full pl-12 pr-32 py-5 rounded-[1.8rem] text-base transition-all duration-300 shadow-[0_24px_60px_-34px_rgba(66,45,22,0.45)]
            bg-[rgba(255,252,247,0.88)] border border-white/70 placeholder-slate-400 text-slate-800
            hover:shadow-[0_28px_64px_-36px_rgba(66,45,22,0.5)] hover:bg-white
            focus:outline-none focus:ring-4 focus:ring-orange-500/10 focus:border-orange-400/40 focus:shadow-[0_30px_70px_-36px_rgba(217,119,69,0.5)] focus:bg-white
            dark:bg-[rgba(9,20,28,0.84)] dark:border-slate-700/70 dark:placeholder-slate-500 dark:text-slate-100 
            dark:hover:bg-[rgba(9,20,28,0.92)] dark:hover:shadow-black/30
            dark:focus:bg-[rgba(9,20,28,0.96)] dark:focus:ring-teal-400/10 dark:focus:border-teal-300/30
            backdrop-blur-md
          "
        />

        {/* Right side controls container */}
        <div className="absolute inset-y-0 right-2 flex items-center space-x-1">
          {query.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1.5 rounded-full hover:bg-orange-50 dark:hover:bg-slate-800 text-slate-400 hover:text-orange-500 dark:hover:text-teal-300 transition-colors mr-1"
            >
              <X size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center space-x-1 px-3 py-2 rounded-2xl text-xs font-semibold transition-colors border shadow-sm
              bg-white/70 hover:bg-orange-50 text-slate-700 border-[rgba(148,114,70,0.14)]
              dark:bg-slate-900/65 dark:hover:bg-slate-800 dark:text-slate-300 dark:border-slate-700
            "
          >
            <Globe size={12} />
            <span>{engineLabel(engine)}</span>
            <ChevronDown size={10} />
          </button>
        </div>

        {isMenuOpen && (
          <div className="absolute top-full right-0 mt-3 w-40 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50 border
            bg-[rgba(255,251,245,0.96)] border-[rgba(148,114,70,0.12)]
            dark:bg-[rgba(9,20,28,0.96)] dark:border-slate-700
          ">
            {Object.values(SearchEngine).map((eng) => (
              <button
                key={eng}
                type="button"
                onClick={() => {
                  setEngine(eng);
                  setIsMenuOpen(false);
                }}
                className={`w-full text-left px-4 py-2.5 text-xs transition-colors font-medium
                  hover:bg-orange-50 dark:hover:bg-slate-800
                  ${engine === eng 
                    ? 'text-orange-600 bg-orange-50 dark:text-teal-300 dark:bg-teal-500/10' 
                    : 'text-slate-600 dark:text-slate-300'
                  }
                `}
              >
                {engineLabel(eng as SearchEngine)}
              </button>
            ))}
          </div>
        )}
      </form>
    </div>
  );
};

export default SearchBar;

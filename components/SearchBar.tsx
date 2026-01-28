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
    <div className="w-full max-w-2xl mx-auto relative z-20">
      <form onSubmit={handleSearch} className="relative group">
        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
          <Search className="h-5 w-5 transition-colors duration-300
            text-slate-400 group-focus-within:text-blue-500
          " />
        </div>
        
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search with ${engineLabel(engine)}...`}
          className="w-full pl-12 pr-28 py-4 rounded-2xl text-base transition-all duration-300 shadow-sm
            bg-white/80 border border-slate-200 placeholder-slate-400 text-slate-800
            hover:shadow-md hover:bg-white
            focus:outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500/50 focus:shadow-xl focus:bg-white
            dark:bg-slate-800/80 dark:border-slate-700 dark:placeholder-slate-500 dark:text-slate-100 
            dark:hover:bg-slate-800 dark:hover:shadow-blue-900/10
            dark:focus:bg-slate-800 dark:focus:ring-blue-400/10 dark:focus:border-blue-400/50
            backdrop-blur-md
          "
        />

        {/* Right side controls container */}
        <div className="absolute inset-y-0 right-2 flex items-center space-x-1">
          {query.length > 0 && (
            <button
              type="button"
              onClick={clearSearch}
              className="p-1.5 rounded-full hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors mr-1"
            >
              <X size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex items-center space-x-1 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors border shadow-sm
              bg-slate-50 hover:bg-slate-100 text-slate-600 border-slate-200
              dark:bg-slate-700/50 dark:hover:bg-slate-700 dark:text-slate-300 dark:border-slate-600
            "
          >
            <Globe size={12} />
            <span>{engineLabel(engine)}</span>
            <ChevronDown size={10} />
          </button>
        </div>

        {isMenuOpen && (
          <div className="absolute top-full right-0 mt-2 w-36 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 z-50 border
            bg-white border-slate-100
            dark:bg-slate-800 dark:border-slate-700
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
                  hover:bg-slate-50 dark:hover:bg-slate-700/50
                  ${engine === eng 
                    ? 'text-blue-600 bg-blue-50/50 dark:text-blue-400 dark:bg-blue-500/10' 
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
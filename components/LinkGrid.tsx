import React from 'react';
import { Category } from '../types';
import { ExternalLink, Hash } from 'lucide-react';

interface LinkGridProps {
  categories: Category[];
}

const LinkGrid: React.FC<LinkGridProps> = ({ categories }) => {
  return (
    <div className="grid gap-12 w-full">
      {categories.map((category) => (
        <div
          key={category.id}
          id={category.id}
          className="scroll-mt-24 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="flex items-center justify-between gap-4 pb-3 border-b border-[rgba(148,114,70,0.16)] dark:border-[rgba(94,234,212,0.1)]">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-orange-100 to-amber-50 text-orange-600 dark:from-teal-500/10 dark:to-cyan-500/10 dark:text-teal-300 shadow-inner">
                {category.icon || <Hash size={18} />}
              </div>
              <h2 className="text-lg font-[Outfit] font-semibold tracking-[0.08em] text-slate-800 dark:text-slate-100">
                {category.title}
              </h2>
            </div>
            <span className="hidden md:inline-flex text-[11px] uppercase tracking-[0.24em] text-slate-400 dark:text-slate-500">
              {category.links.length} Links
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {category.links.map((link) => (
              <div key={link.id} className="relative group">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex flex-col p-5 h-full rounded-[1.75rem] transition-all duration-300 overflow-hidden
                    bg-[rgba(255,251,246,0.84)] border border-white/70 shadow-[0_22px_50px_-34px_rgba(66,45,22,0.45)] hover:shadow-[0_30px_68px_-34px_rgba(66,45,22,0.55)]
                    dark:bg-[rgba(9,20,28,0.75)] dark:border-slate-700/60 dark:hover:bg-[rgba(11,24,33,0.92)] dark:hover:border-slate-600 dark:hover:shadow-black/30 dark:backdrop-blur-sm
                    hover:-translate-y-1.5 hover:border-orange-200 dark:hover:border-teal-400/20"
                >
                  <div className="absolute inset-x-4 top-0 h-px bg-gradient-to-r from-transparent via-orange-300/70 to-transparent dark:via-teal-300/40" />

                  <div className="flex items-start justify-between mb-3 relative z-10">
                    <div className="p-3 rounded-2xl transition-colors duration-300
                      bg-gradient-to-br from-white to-orange-50 text-slate-600 group-hover:from-orange-50 group-hover:to-amber-50 group-hover:text-orange-600
                      dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-teal-500/20 dark:group-hover:text-teal-300"
                    >
                      {link.icon}
                    </div>
                    <ExternalLink
                      size={14}
                      className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0 text-slate-400 dark:text-slate-500"
                    />
                  </div>

                  <div className="flex-1 min-w-0 relative z-10">
                    <h3 className="text-[15px] font-semibold transition-colors mb-1 truncate text-slate-800 group-hover:text-orange-600 dark:text-slate-100 dark:group-hover:text-teal-300">
                      {link.title}
                    </h3>
                    <p className="text-xs leading-relaxed line-clamp-2 text-slate-500 group-hover:text-slate-700 dark:text-slate-500 dark:group-hover:text-slate-300">
                      {link.description || '暂无描述'}
                    </p>
                  </div>

                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-orange-100/45 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none transform translate-y-full group-hover:-translate-y-full transition-transform duration-1000 ease-in-out dark:via-teal-400/10" />
                </a>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
};

export default LinkGrid;

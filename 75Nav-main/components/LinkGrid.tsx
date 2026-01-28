import React from 'react';
import { Category, LinkItem } from '../types';
import { ExternalLink, Hash } from 'lucide-react';

interface LinkGridProps {
  categories: Category[];
}

const LinkGrid: React.FC<LinkGridProps> = ({ 
  categories
}) => {
  return (
    <div className="grid gap-10 w-full">
      {categories.map((category) => (
        <div 
          key={category.id} 
          id={category.id}
          className="scroll-mt-24 space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          {/* Section Header */}
          <div className="flex items-center space-x-3 pb-2 border-b border-slate-200 dark:border-slate-800/60">
            <div className="p-1.5 rounded-lg bg-blue-100/50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
              {category.icon || <Hash size={18} />}
            </div>
            <h2 className="text-base font-bold tracking-wide text-slate-700 dark:text-slate-200">
              {category.title}
            </h2>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4">
            {category.links.map((link) => (
              <div key={link.id} className="relative group">
                <a
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="relative flex flex-col p-4 h-full rounded-2xl transition-all duration-300 overflow-hidden
                    bg-white border border-slate-100 shadow-sm hover:shadow-md
                    dark:bg-slate-800/40 dark:border-slate-700/50 dark:hover:bg-slate-800/60 dark:hover:border-slate-600 dark:hover:shadow-lg dark:hover:shadow-blue-900/10 dark:backdrop-blur-sm
                    hover:-translate-y-1 hover:border-blue-200
                  "
                >
                  {/* Header: Icon & External Link */}
                  <div className="flex items-start justify-between mb-3 relative z-10">
                    <div className="p-2.5 rounded-xl transition-colors duration-300
                      bg-slate-50 text-slate-500 group-hover:bg-blue-50 group-hover:text-blue-600
                      dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-blue-500/20 dark:group-hover:text-blue-300
                    ">
                      {link.icon}
                    </div>
                    <ExternalLink size={14} className="opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0
                        text-slate-400 dark:text-slate-500
                    " />
                  </div>
                  
                  {/* Text Content */}
                  <div className="flex-1 min-w-0 relative z-10">
                    <h3 className="text-[15px] font-semibold transition-colors mb-1 truncate
                      text-slate-700 group-hover:text-blue-600
                      dark:text-slate-200 dark:group-hover:text-blue-300
                    ">
                      {link.title}
                    </h3>
                    <p className="text-xs leading-relaxed line-clamp-2
                      text-slate-500 group-hover:text-slate-600
                      dark:text-slate-500 dark:group-hover:text-slate-400
                    ">
                      {link.description || '暂无描述'}
                    </p>
                  </div>
                  
                  {/* Decoration: Subtle Gradient Shine */}
                  <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none transform translate-y-full group-hover:-translate-y-full transition-transform duration-1000 ease-in-out dark:via-slate-700/10" />
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
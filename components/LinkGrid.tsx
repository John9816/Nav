import React from 'react';
import { Category } from '../types';
import { Hash, ArrowUpRight } from 'lucide-react';

interface LinkGridProps {
  categories: Category[];
}

const getHostname = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
};

const LinkGrid: React.FC<LinkGridProps> = ({ categories }) => {
  return (
    <div className="grid gap-6 w-full">
      {categories.map((category) => (
        <section
          key={category.id}
          id={category.id}
          className="scroll-mt-24 animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div className="mb-3 flex items-center gap-3 px-1">
            <div className="flex h-[2.125rem] w-[2.125rem] shrink-0 items-center justify-center rounded-[0.95rem] bg-gradient-to-br from-amber-100 to-orange-50 text-amber-700 dark:from-amber-500/10 dark:to-orange-400/10 dark:text-amber-300 border border-white/70 dark:border-slate-700/60">
              {category.icon || <Hash size={17} />}
            </div>
            <h2 className="shrink-0 text-[1.18rem] font-[Outfit] font-semibold tracking-[-0.03em] text-slate-900 dark:text-slate-100">
              {category.title}
            </h2>
            <div className="h-px flex-1 bg-gradient-to-r from-[rgba(201,131,77,0.18)] via-[rgba(201,131,77,0.08)] to-transparent dark:from-[rgba(201,131,77,0.16)] dark:via-[rgba(201,131,77,0.07)] dark:to-transparent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6 gap-3">
            {category.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="surface-card surface-card-soft group relative flex min-h-[6.7rem] flex-col rounded-[1.05rem] px-3 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-amber-200/70 dark:hover:border-amber-400/20"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.8rem] bg-white/80 dark:bg-slate-900/70 text-slate-600 transition-colors group-hover:text-amber-700 dark:text-slate-400 dark:group-hover:text-amber-300 border border-white/70 dark:border-slate-700/60">
                    {link.icon}
                  </div>
                  <ArrowUpRight size={13} className="mt-0.5 shrink-0 text-slate-400 transition-colors group-hover:text-amber-700 dark:text-slate-500 dark:group-hover:text-amber-300" />
                </div>

                <div className="mt-2.5 min-w-0 flex-1">
                  <h3 className="truncate text-[13px] font-semibold leading-5 text-slate-800 transition-colors group-hover:text-amber-700 dark:text-slate-100 dark:group-hover:text-amber-300">
                    {link.title}
                  </h3>
                  {link.description && (
                    <p className="mt-1 line-clamp-1 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                      {link.description}
                    </p>
                  )}
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2 pt-2 border-t border-[rgba(148,114,70,0.08)] dark:border-slate-800/80">
                  <span className="truncate text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    {getHostname(link.url)}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};

export default LinkGrid;



import React from 'react';
import { Hash, ChevronLeft, ChevronRight, Sparkles } from 'lucide-react';
import { Category } from '../types';

interface SidebarProps {
  categories: Category[];
  activeSection: string;
  isCollapsed: boolean;
  toggleCollapse: () => void;
  isMobileOpen: boolean;
  closeMobileSidebar: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  categories,
  activeSection,
  isCollapsed,
  toggleCollapse,
  isMobileOpen,
  closeMobileSidebar
}) => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    const container = document.getElementById('dashboard-container');

    if (!element || !container) return;

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const relativeTop = elementRect.top - containerRect.top;
    const offset = 20;

    container.scrollTo({
      top: container.scrollTop + relativeTop - offset,
      behavior: 'smooth'
    });

    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  };

  const isDesktop = window.innerWidth >= 768;
  const showExpanded = isDesktop && !isCollapsed;
  const showLabels = showExpanded;

  return (
      <div
        className={`fixed left-0 top-[4.5rem] bottom-0 z-40 glass-sidebar sidebar-shell border-r border-[rgba(148,114,70,0.12)] dark:border-[rgba(94,234,212,0.1)] transition-[width] duration-300 ease-in-out
          ${isCollapsed ? 'w-20 md:w-20' : 'w-20 md:w-72'}
        `}
      >
        <div className="relative z-10 flex h-full flex-col gap-4 p-4">
          <div className={`sidebar-card overflow-hidden ${showExpanded ? 'px-4 py-4' : 'px-3 py-4'}`}>
            <div className={`flex items-center ${showExpanded ? 'justify-between gap-3' : 'justify-center'}`}>
              <div className={`flex items-center ${showExpanded ? 'gap-3 min-w-0' : 'justify-center'}`}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 via-amber-500 to-teal-500 text-white shadow-[0_18px_30px_-18px_rgba(217,119,69,0.85)]">
                  <Sparkles size={18} />
                </div>
                {showExpanded && (
                  <div className="min-w-0">
                    <div className="font-[Outfit] text-base font-semibold tracking-[0.12em] text-slate-900 dark:text-slate-100">
                      {'\u4e03\u4e94\u5bfc\u822a'}
                    </div>
                    <div className="mt-0.5 text-[11px] uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                      Sections
                    </div>
                  </div>
                )}
              </div>

              {showExpanded && (
                <div className="rounded-full border border-[rgba(148,114,70,0.14)] bg-white/65 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500 dark:border-slate-700 dark:bg-slate-900/65 dark:text-slate-400">
                  {categories.length} {'\u9879'}
                </div>
              )}
            </div>

            {showExpanded && (
              <div className="mt-4 rounded-2xl bg-[rgba(255,247,239,0.82)] px-3.5 py-3 text-xs leading-5 text-slate-600 dark:bg-[rgba(13,29,38,0.82)] dark:text-slate-300">
                {'\u8ba9\u5de6\u680f\u53d8\u6210\u7a33\u5b9a\u7684\u5bfc\u822a\u9762\u677f\uff0c\u800c\u4e0d\u662f\u4e00\u5217\u677e\u6563\u6309\u94ae\u3002'}
              </div>
            )}
          </div>

          <div className="sidebar-card flex min-h-0 flex-1 flex-col p-3">
            {showExpanded && (
              <div className="px-2 pb-2">
                <div className="text-[10px] font-bold uppercase tracking-[0.26em] text-slate-400 dark:text-slate-500">
                  {'\u5feb\u901f\u5bfc\u822a'}
                </div>
              </div>
            )}

            <nav className="flex-1 space-y-1.5 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
              {categories.map((category, index) => (
                <button
                  key={category.id}
                  onClick={() => scrollToSection(category.id)}
                  title={isCollapsed ? category.title : ''}
                  className={`group relative w-full rounded-[1.3rem] transition-all duration-200 ${
                    showExpanded ? 'px-2 py-1' : 'flex justify-center px-0 py-2.5'
                  } ${
                    activeSection === category.id
                      ? 'bg-gradient-to-r from-orange-500/14 via-orange-500/10 to-teal-500/12 shadow-[0_22px_38px_-30px_rgba(217,119,69,0.9)]'
                      : 'hover:bg-white/70 dark:hover:bg-slate-800/55'
                  }`}
                >
                  <div className={`flex items-center rounded-[1.1rem] px-2.5 py-2.5 ${showExpanded ? 'gap-3' : 'justify-center'}`}>
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
                        activeSection === category.id
                          ? 'border-orange-200/80 bg-gradient-to-br from-orange-500 to-amber-500 text-white dark:border-teal-400/20 dark:from-orange-500 dark:to-teal-500'
                          : 'border-[rgba(148,114,70,0.12)] bg-white/78 text-slate-400 group-hover:text-orange-500 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-500 dark:group-hover:text-teal-300'
                      }`}
                    >
                      {category.icon || <Hash size={18} />}
                    </span>

                    {showLabels && (
                      <div className="min-w-0 flex-1 text-left">
                        <div
                          className={`truncate text-sm font-semibold ${
                            activeSection === category.id ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'
                          }`}
                        >
                          {category.title}
                        </div>
                        <div className="mt-0.5 text-[11px] text-slate-400 dark:text-slate-500">
                          {'\u7b2c'} {index + 1} {'\u7ec4'}
                        </div>
                      </div>
                    )}

                    {showExpanded && (
                      <span
                        className={`h-2.5 w-2.5 rounded-full transition-all ${
                          activeSection === category.id
                            ? 'bg-gradient-to-r from-orange-500 to-teal-500'
                            : 'bg-slate-200 group-hover:bg-orange-200 dark:bg-slate-700 dark:group-hover:bg-teal-500/30'
                        }`}
                      />
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          <div className="hidden md:block sidebar-card p-2.5">
            <button
              onClick={toggleCollapse}
              title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              className={`w-full rounded-[1.25rem] text-slate-500 transition-colors hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-800/70 ${
                isCollapsed ? 'flex justify-center p-2.5' : 'flex items-center gap-3 px-3 py-3'
              }`}
            >
              {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              {showExpanded && <span className="text-sm font-medium">{'\u6536\u8d77\u4fa7\u680f'}</span>}
            </button>
          </div>
        </div>
      </div>
  );
};

export default Sidebar;

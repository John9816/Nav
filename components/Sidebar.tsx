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

    container.scrollTo({
      top: container.scrollTop + relativeTop - 20,
      behavior: 'smooth'
    });

    if (window.innerWidth < 768) {
      closeMobileSidebar();
    }
  };

  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 768;
  const showExpanded = isDesktop && !isCollapsed;

  return (
    <>
      <div
        className={`md:hidden fixed inset-0 bg-slate-950/25 backdrop-blur-sm z-30 transition-opacity duration-300 ${
          isMobileOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={closeMobileSidebar}
      />

      <div
        className={`fixed left-0 top-[4.5rem] bottom-0 z-40 glass-sidebar sidebar-shell border-r border-[rgba(148,114,70,0.12)] dark:border-[rgba(209,154,102,0.1)] transition-[width,transform] duration-300 ease-in-out ${
          isCollapsed ? 'w-20 md:w-20' : 'w-64 md:w-64'
        } ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-[110%] md:translate-x-0'
        }`}
      >
        <div className="relative z-10 flex h-full flex-col gap-3 p-3.5">
          <div className={`sidebar-card overflow-hidden ${showExpanded ? 'px-4 py-3.5' : 'px-3 py-3.5'}`}>
            <div className={`flex items-center ${showExpanded ? 'justify-between gap-3' : 'justify-center'}`}>
              <div className={`flex items-center ${showExpanded ? 'gap-3 min-w-0' : 'justify-center'}`}>
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[1.15rem] bg-gradient-to-br from-amber-500 via-orange-400 to-orange-300 text-white shadow-[0_18px_30px_-18px_rgba(217,119,69,0.85)]">
                  <Sparkles size={18} />
                </div>
                {showExpanded && (
                  <div className="min-w-0">
                    <div className="font-[Outfit] text-sm font-semibold tracking-[0.1em] text-slate-900 dark:text-slate-100">
                      七五导航
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="sidebar-card flex min-h-0 flex-1 flex-col p-3">
            <nav className="flex-1 space-y-1 overflow-y-auto overflow-x-hidden pr-1 custom-scrollbar">
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => scrollToSection(category.id)}
                  title={isCollapsed ? category.title : ''}
                  className={`group relative w-full rounded-[1.05rem] transition-all duration-200 ${
                    showExpanded ? 'px-2 py-0.5' : 'flex justify-center px-0 py-2'
                  } ${
                    activeSection === category.id
                      ? 'bg-gradient-to-r from-amber-500/14 via-amber-500/10 to-orange-400/10 shadow-[0_22px_38px_-30px_rgba(201,131,77,0.38)]'
                      : 'hover:bg-white/70 dark:hover:bg-slate-800/55'
                  }`}
                >
                  <div className={`flex items-center rounded-[0.95rem] px-2.5 py-2.5 ${showExpanded ? 'gap-3' : 'justify-center'}`}>
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[1rem] border transition-colors ${
                        activeSection === category.id
                          ? 'border-amber-200/80 bg-gradient-to-br from-amber-500 to-orange-400 text-white dark:border-amber-400/20 dark:from-amber-500 dark:to-orange-400'
                          : 'border-[rgba(148,114,70,0.12)] bg-white/78 text-slate-400 group-hover:text-amber-600 dark:border-slate-700 dark:bg-slate-900/70 dark:text-slate-500 dark:group-hover:text-amber-300'
                      }`}
                    >
                      {category.icon || <Hash size={18} />}
                    </span>

                    {showExpanded && (
                      <div className="min-w-0 flex-1 text-left">
                        <div className={`truncate text-sm font-semibold ${activeSection === category.id ? 'text-slate-900 dark:text-slate-100' : 'text-slate-700 dark:text-slate-200'}`}>
                          {category.title}
                        </div>
                      </div>
                    )}

                    {showExpanded && (
                      <span className={`h-2 w-2 rounded-full transition-all ${activeSection === category.id ? 'bg-gradient-to-r from-amber-500 to-orange-400' : 'bg-slate-200 group-hover:bg-amber-200 dark:bg-slate-700 dark:group-hover:bg-amber-500/20'}`} />
                    )}
                  </div>
                </button>
              ))}
            </nav>
          </div>

          <div className="hidden md:block sidebar-card p-2.5">
            <button
              onClick={toggleCollapse}
              title={isCollapsed ? '展开侧栏' : '收起侧栏'}
              className={`w-full rounded-[1.25rem] text-slate-500 transition-colors hover:bg-white/70 dark:text-slate-400 dark:hover:bg-slate-800/70 ${
                isCollapsed ? 'flex justify-center p-2.5' : 'flex items-center justify-between gap-3 px-3 py-3'
              }`}
            >
              <div className="flex items-center gap-3">
                {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                {showExpanded && <span className="text-sm font-medium">收起侧栏</span>}
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Sidebar;







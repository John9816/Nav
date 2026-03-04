import React from 'react';
import { Category } from '../types';
import { Hash, ChevronLeft, ChevronRight, X } from 'lucide-react';

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
    
    if (element && container) {
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      const relativeTop = elementRect.top - containerRect.top;
      const offset = 20; 
      const scrollTop = container.scrollTop + relativeTop - offset;

      container.scrollTo({
          top: scrollTop,
          behavior: "smooth"
      });
      
      // Close sidebar on mobile after selection
      if (window.innerWidth < 768) {
        closeMobileSidebar();
      }
    }
  };

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`fixed inset-0 bg-black/50 z-40 transition-opacity duration-300 md:hidden
          ${isMobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible pointer-events-none'}
        `}
        onClick={closeMobileSidebar}
      />

      {/* Sidebar Container */}
      <div className={`fixed left-0 top-0 bottom-0 z-50 glass-sidebar border-r border-slate-200 dark:border-slate-800 flex flex-col transition-transform duration-300 ease-in-out md:top-16
        ${isMobileOpen ? 'translate-x-0' : '-translate-x-full'} 
        md:translate-x-0
        ${isCollapsed ? 'md:w-16' : 'md:w-56'}
        w-64
      `}>
        
        {/* Mobile Header */}
        <div className="md:hidden flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700/50">
           <span className="font-bold text-slate-800 dark:text-slate-100">分类导航</span>
           <button onClick={closeMobileSidebar} className="p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500">
             <X size={20} />
           </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto overflow-x-hidden py-4 md:py-6 space-y-1 custom-scrollbar px-3">
          {categories.map((category) => (
            <div key={category.id} className="relative group">
              <button
                onClick={() => scrollToSection(category.id)}
                title={isCollapsed ? category.title : ''}
                className={`w-full flex items-center transition-all duration-200 rounded-lg relative
                  ${isCollapsed ? 'md:justify-center md:px-0 md:py-3 px-3 py-3' : 'space-x-3 px-3 py-2.5'}
                  ${activeSection === category.id
                    ? 'bg-blue-50 text-blue-600 dark:bg-blue-600/10 dark:text-blue-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:bg-slate-800/50'
                  }
                `}
              >
                <span className={`transition-colors shrink-0
                  ${activeSection === category.id 
                    ? 'text-blue-600 dark:text-blue-400' 
                    : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300'
                  }
                `}>
                   {category.icon || <Hash size={20} />}
                </span>
                
                {(!isCollapsed || window.innerWidth < 768) && (
                  <span className="font-medium text-sm truncate flex-1 text-left ml-3 md:ml-0">{category.title}</span>
                )}
                
                {/* Active Indicator Bar (Left) */}
                {activeSection === category.id && (
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
                )}
              </button>
            </div>
          ))}
        </nav>

        {/* Collapse Toggle (Desktop Only) */}
        <div className="hidden md:block p-3 border-t border-slate-200 dark:border-slate-800/50">
          <button
            onClick={toggleCollapse}
            title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`w-full flex items-center rounded-lg transition-colors hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400
               ${isCollapsed ? 'justify-center p-2' : 'px-3 py-2 gap-3'}
            `}
          >
             {isCollapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
             {!isCollapsed && (
              <span className="text-sm font-medium">
                收起侧栏
              </span>
            )}
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
import React from 'react';
import { Category } from '../types';
import { Hash, ChevronLeft, ChevronRight } from 'lucide-react';

interface SidebarProps {
  categories: Category[];
  activeSection: string;
  isCollapsed: boolean;
  toggleCollapse: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ 
  categories, 
  activeSection, 
  isCollapsed, 
  toggleCollapse
}) => {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    const container = document.getElementById('dashboard-container');
    
    if (element && container) {
      // Get positions relative to the viewport
      const elementRect = element.getBoundingClientRect();
      const containerRect = container.getBoundingClientRect();
      
      // Calculate element's position relative to the container's *visible* top
      const relativeTop = elementRect.top - containerRect.top;
      
      // Calculate final scroll position: current scroll + relative position - padding offset
      // A small offset ensures the section header isn't right at the very edge
      const offset = 20; 
      const scrollTop = container.scrollTop + relativeTop - offset;

      container.scrollTo({
          top: scrollTop,
          behavior: "smooth"
      });
    }
  };

  return (
    <div className={`hidden md:flex flex-col fixed left-0 top-16 bottom-0 z-30 glass-sidebar transition-all duration-300 ease-in-out border-r border-slate-200 dark:border-slate-800
      ${isCollapsed ? 'w-16' : 'w-56'}
    `}>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-6 space-y-1 custom-scrollbar px-3">
        {categories.map((category) => (
          <div key={category.id} className="relative group">
            <button
              onClick={() => scrollToSection(category.id)}
              title={isCollapsed ? category.title : ''}
              className={`w-full flex items-center transition-all duration-200 rounded-lg relative
                ${isCollapsed ? 'justify-center px-0 py-3' : 'space-x-3 px-3 py-2.5'}
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
              
              {!isCollapsed && (
                <span className="font-medium text-sm truncate flex-1 text-left">{category.title}</span>
              )}
              
              {/* Active Indicator Bar (Left) */}
              {activeSection === category.id && (
                 <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-blue-500 rounded-r-full" />
              )}
            </button>
          </div>
        ))}
      </nav>

      {/* Collapse Toggle */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/50">
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
  );
};

export default Sidebar;
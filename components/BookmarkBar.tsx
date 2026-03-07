import React, { useState, useRef, useEffect } from 'react';
import { Category, LinkItem } from '../types';
import { Folder, ChevronDown, ChevronRight } from 'lucide-react';

interface BookmarkBarProps {
  categories: Category[];
}

interface TreeNode {
  name: string;
  fullTitle: string;
  links: LinkItem[];
  children: TreeNode[];
}

const FolderDropdown: React.FC<{ node: TreeNode; depth?: number; alignRight?: boolean }> = ({ node, depth = 0, alignRight = false }) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseEnter = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setIsOpen(true);
  };

  const handleMouseLeave = () => {
    closeTimer.current = setTimeout(() => {
      setIsOpen(false);
    }, 200);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const positionClass = depth === 0
    ? (alignRight ? "top-full right-0 mt-1.5 origin-top-right" : "top-full left-0 mt-1.5 origin-top-left")
    : (alignRight ? "top-0 right-full mr-1 origin-top-right" : "top-0 left-full ml-1 origin-top-left");

  return (
    <div
      ref={ref}
      className="relative flex items-center group"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        className={`flex items-center gap-1 px-3 py-2 rounded-full text-xs font-medium transition-colors whitespace-nowrap h-9 max-w-[180px]
          ${isOpen
            ? 'bg-gradient-to-r from-orange-500 to-amber-500 text-white'
            : 'text-slate-700 dark:text-slate-200 hover:bg-white/70 dark:hover:bg-slate-800/70'
          }
          ${depth > 0 ? 'w-full justify-between rounded-2xl px-3 py-2.5 h-auto' : ''}
        `}
      >
        <div className="flex items-center gap-2 truncate">
          <Folder size={14} className={`shrink-0 ${isOpen ? 'text-white' : 'text-amber-500 opacity-90'}`} />
          <span className="truncate">{node.name}</span>
        </div>
        {depth > 0 ? (
          <ChevronRight size={10} className={`${isOpen ? 'opacity-80' : 'opacity-40'}`} />
        ) : (
          <ChevronDown size={10} className={`opacity-50 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && (
        <div
          className={`absolute ${positionClass} min-w-[220px] max-w-[280px] bg-[rgba(255,251,245,0.97)] dark:bg-[rgba(9,20,28,0.97)] rounded-2xl shadow-2xl border border-[rgba(148,114,70,0.12)] dark:border-slate-700 py-2 z-[100] animate-in fade-in zoom-in-95 duration-100 max-h-[75vh] overflow-y-auto custom-scrollbar`}
        >
          {node.children.map(child => (
            <div key={child.fullTitle} className="px-2 relative">
              <FolderDropdown node={child} depth={depth + 1} alignRight={alignRight} />
            </div>
          ))}

          {node.children.length > 0 && node.links.length > 0 && (
            <div className="my-2 border-b border-[rgba(148,114,70,0.1)] dark:border-slate-800 mx-3"></div>
          )}

          {node.links.map(link => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-orange-50 dark:hover:bg-slate-800 hover:text-orange-600 dark:hover:text-teal-300 transition-colors mx-2 rounded-xl"
              title={link.url}
            >
              <span className="shrink-0 w-4 h-4 flex items-center justify-center opacity-70">
                {link.icon}
              </span>
              <span className="truncate">{link.title}</span>
            </a>
          ))}

          {node.children.length === 0 && node.links.length === 0 && (
            <div className="px-3 py-2 text-xs text-slate-400 italic text-center">绌烘枃浠跺す</div>
          )}
        </div>
      )}
    </div>
  );
};

const BookmarkBar: React.FC<BookmarkBarProps> = ({ categories }) => {
  if (!categories || categories.length === 0) return null;

  const bookmarkBarRootTitle = '\u4e66\u7b7e\u680f';
  const rootNode: TreeNode = { name: bookmarkBarRootTitle, fullTitle: bookmarkBarRootTitle, links: [], children: [] };
  const nodesMap = new Map<string, TreeNode>();
  nodesMap.set(bookmarkBarRootTitle, rootNode);
  
  const sortedCats = [...categories].sort((a, b) => a.title.length - b.title.length);
  
  sortedCats.forEach(cat => {
    if (cat.title === bookmarkBarRootTitle) {
      rootNode.links = cat.links;
    } else {
      const parts = cat.title.split('/');
      let currentPath = parts[0];
      if (currentPath !== bookmarkBarRootTitle) return;
 
      let currentNode = nodesMap.get(currentPath)!;

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        if (!part) continue;
        const path = parts.slice(0, i + 1).join('/');

        if (!nodesMap.has(path)) {
          const newNode: TreeNode = {
            name: part,
            fullTitle: path,
            links: [],
            children: []
          };
          nodesMap.set(path, newNode);
          currentNode.children.push(newNode);
        }
        currentNode = nodesMap.get(path)!;
      }

      currentNode.links = cat.links;
    }
  });

  const totalRootItems = rootNode.links.length + rootNode.children.length;

  return (
    <div className="max-w-[1820px] mx-auto px-4 sm:px-8 md:px-10 xl:px-12 py-3">
      <div className="glass-panel rounded-[1.7rem] px-3 py-3 md:px-4 md:py-3.5">
        <div className="flex items-center gap-2.5 w-full h-full overflow-x-auto flex-nowrap md:flex-wrap scrollbar-hide md:overflow-visible">
          <div className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-white dark:text-slate-900 select-none shrink-0 mr-1 rounded-full bg-slate-900 dark:bg-slate-100 border border-slate-900/10 dark:border-white/20 shadow-[0_18px_34px_-26px_rgba(15,23,42,0.65)]">
            <Folder size={14} className="text-amber-400 dark:text-amber-500" />
            <span className="whitespace-nowrap">Bookmarks</span>
          </div>

          {rootNode.links.map((link) => (
            <a
              key={link.id}
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3.5 py-2.5 rounded-full text-xs font-medium text-slate-700 dark:text-slate-200 bg-white/55 dark:bg-slate-900/50 border border-white/65 dark:border-slate-700/60 hover:bg-white dark:hover:bg-slate-800/80 hover:text-orange-600 dark:hover:text-teal-300 transition-colors whitespace-nowrap shrink-0 max-w-[220px]"
              title={link.description || link.title}
            >
              <span className="shrink-0 opacity-70 scale-90">{link.icon}</span>
              <span className="truncate">{link.title}</span>
            </a>
          ))}

          {rootNode.children.map((child, index) => {
            const currentIdx = rootNode.links.length + index;
            const alignRight = totalRootItems > 3 && currentIdx > totalRootItems / 2;
            return (
              <FolderDropdown key={child.fullTitle} node={child} alignRight={alignRight} />
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default BookmarkBar;

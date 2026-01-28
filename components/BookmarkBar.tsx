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

// Recursive Dropdown Component
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
        }, 200); // Slightly longer delay to allow moving to submenu
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (ref.current && !ref.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Calculate position classes based on depth and alignment
    let positionClass = "";
    if (depth === 0) {
        // Root level
        positionClass = alignRight 
            ? "top-full right-0 mt-1 origin-top-right" 
            : "top-full left-0 mt-1 origin-top-left";
    } else {
        // Nested level
        positionClass = alignRight
            ? "top-0 right-full mr-0.5 origin-top-right"
            : "top-0 left-full ml-0.5 origin-top-left";
    }

    return (
        <div 
            ref={ref}
            className="relative flex items-center group"
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <button 
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap h-7 max-w-[160px]
                    ${isOpen ? 'bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400'}
                    ${depth > 0 ? 'w-full justify-between' : ''}
                `}
            >
                <div className="flex items-center gap-1.5 truncate">
                    <Folder size={14} className={`shrink-0 ${isOpen ? 'text-blue-500' : 'text-yellow-500 opacity-80'}`} />
                    <span className="truncate">{node.name}</span>
                </div>
                {depth > 0 ? (
                    <ChevronRight size={10} className="opacity-40" />
                ) : (
                    <ChevronDown size={10} className={`opacity-40 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                )}
            </button>

            {isOpen && (
                <div 
                    className={`absolute ${positionClass} min-w-[200px] max-w-[260px] bg-white dark:bg-slate-900 rounded-lg shadow-xl border border-slate-200 dark:border-slate-700 py-1.5 z-[100] animate-in fade-in zoom-in-95 duration-75 max-h-[75vh] overflow-y-auto custom-scrollbar`}
                >
                    {node.children.map(child => (
                        <div key={child.fullTitle} className="px-1 relative">
                             {/* Pass alignRight to children so nested menus also align correctly */}
                             <FolderDropdown node={child} depth={depth + 1} alignRight={alignRight} />
                        </div>
                    ))}
                    
                    {node.children.length > 0 && node.links.length > 0 && (
                        <div className="my-1 border-b border-slate-100 dark:border-slate-800 mx-2"></div>
                    )}

                    {node.links.map(link => (
                        <a
                            key={link.id}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mx-1 rounded-md"
                            title={link.url}
                        >
                            <span className="shrink-0 w-4 h-4 flex items-center justify-center opacity-70">
                                {link.icon}
                            </span>
                            <span className="truncate">{link.title}</span>
                        </a>
                    ))}
                    
                    {node.children.length === 0 && node.links.length === 0 && (
                         <div className="px-3 py-2 text-xs text-slate-400 italic text-center">空文件夹</div>
                    )}
                </div>
            )}
        </div>
    );
};

const BookmarkBar: React.FC<BookmarkBarProps> = ({ categories }) => {
  if (!categories || categories.length === 0) return null;

  // Reconstruct Tree from flattened categories
  // Root is "书签栏". Children are "书签栏/Folder".

  const rootNode: TreeNode = { name: '书签栏', fullTitle: '书签栏', links: [], children: [] };
  const nodesMap = new Map<string, TreeNode>();
  nodesMap.set('书签栏', rootNode);

  // 1. Create Nodes
  // We sort by length first to ensure parents (shorter paths) usually come before children, 
  // though the logic handles out-of-order creation anyway.
  const sortedCats = [...categories].sort((a, b) => a.title.length - b.title.length);

  sortedCats.forEach(cat => {
      if (cat.title === '书签栏') {
          rootNode.links = cat.links;
      } else {
          // It's a subfolder like "书签栏/Tech" or "书签栏/Tech/Web"
          const parts = cat.title.split('/');
          // Ensure path exists
          let currentPath = parts[0]; // should be "书签栏"
          
          // If the root name in the path isn't "书签栏" (unlikely due to filtering, but safe to check), handle it
          if (currentPath !== '书签栏') return;

          let currentNode = nodesMap.get(currentPath)!; // Root should exist
          
          for (let i = 1; i < parts.length; i++) {
              const part = parts[i];
              if (!part) continue; // Skip empty parts
              
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
          // Now currentNode is the node for this category. Assign links.
          currentNode.links = cat.links;
      }
  });

  const totalRootItems = rootNode.links.length + rootNode.children.length;

  return (
    <div className="max-w-[1920px] mx-auto px-4 sm:px-6 min-h-[40px] flex items-center py-1">
        {/* We use flex-wrap to prevent clipping of right-most items, allowing bar to expand vertically if needed */}
        <div className="flex items-center gap-1 w-full h-full flex-wrap">
            {/* Label */}
            <div className="flex items-center gap-1.5 px-2 py-1 text-xs font-bold text-slate-400 select-none shrink-0 mr-2 border-r border-slate-200 dark:border-slate-700 pr-3 h-6">
               <Folder size={14} />
               <span>书签栏</span>
            </div>

            {/* Render Root Links first */}
            {rootNode.links.map((link) => (
              <a
                key={link.id}
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-blue-600 dark:hover:text-blue-400 transition-colors whitespace-nowrap shrink-0 max-w-[200px]"
                title={link.description || link.title}
              >
                <span className="shrink-0 opacity-70 scale-90">{link.icon}</span>
                <span className="truncate">{link.title}</span>
              </a>
            ))}

            {/* Render Root Children as Dropdowns */}
            {rootNode.children.map((child, index) => {
                // Determine if we should align right (if in the second half of items, and there are enough items)
                const currentIdx = rootNode.links.length + index;
                const alignRight = totalRootItems > 3 && currentIdx > totalRootItems / 2;
                
                return (
                    <FolderDropdown key={child.fullTitle} node={child} alignRight={alignRight} />
                );
            })}
        </div>
    </div>
  );
};

export default BookmarkBar;
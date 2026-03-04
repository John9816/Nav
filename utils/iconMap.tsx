import React from 'react';
import { 
  Book, Code, Server, Sparkles, FileJson, Table, Clipboard, 
  Scissors, Network, Mail, Plane, Globe, Film, PlayCircle, 
  MessageSquare, Cpu, Compass, Bot, Zap, Coffee, Box, MonitorPlay, Users, Hash
} from 'lucide-react';

export const AVAILABLE_ICONS = [
  'Zap', 'Book', 'Code', 'Server', 'Sparkles', 'Bot', 'Box', 
  'FileJson', 'Table', 'Clipboard', 'Scissors', 'Network', 'Coffee', 
  'Mail', 'Plane', 'Globe', 'MonitorPlay', 'Film', 'PlayCircle', 
  'Users', 'MessageSquare', 'Cpu', 'Compass', 'Hash'
];

export const getIconByName = (name: string | null | undefined, className?: string) => {
  const props = { size: 18, className };
  
  switch (name) {
    case 'Zap': return <Zap {...props} />;
    case 'Book': return <Book {...props} />;
    case 'Code': return <Code {...props} />;
    case 'Server': return <Server {...props} />;
    case 'Sparkles': return <Sparkles {...props} />;
    case 'Bot': return <Bot {...props} />;
    case 'Box': return <Box {...props} />;
    case 'FileJson': return <FileJson {...props} />;
    case 'Table': return <Table {...props} />;
    case 'Clipboard': return <Clipboard {...props} />;
    case 'Scissors': return <Scissors {...props} />;
    case 'Network': return <Network {...props} />;
    case 'Coffee': return <Coffee {...props} />;
    case 'Mail': return <Mail {...props} />;
    case 'Plane': return <Plane {...props} />;
    case 'Globe': return <Globe {...props} />;
    case 'MonitorPlay': return <MonitorPlay {...props} />;
    case 'Film': return <Film {...props} />;
    case 'PlayCircle': return <PlayCircle {...props} />;
    case 'Users': return <Users {...props} />;
    case 'MessageSquare': return <MessageSquare {...props} />;
    case 'Cpu': return <Cpu {...props} />;
    case 'Compass': return <Compass {...props} />;
    default: return <Hash {...props} />;
  }
};

// Helper to map default category IDs to icon names for initial import
export const getDefaultIconName = (id: string, isCategory: boolean = false): string => {
  // Category Icons
  if (id === 'quick') return 'Zap';
  if (id === 'ai') return 'Sparkles';
  if (id === 'tools') return 'Box';
  if (id === 'interest') return 'Coffee';
  if (id === 'media') return 'MonitorPlay';
  if (id === 'community') return 'Users';
  if (id === 'nav') return 'Compass';

  // Link Icons (Sample mapping based on constants.tsx)
  if (id.includes('quick-1')) return 'Book';
  if (id.includes('quick-2')) return 'Code';
  if (id.includes('quick-3')) return 'Server';
  
  if (id.includes('ai-1')) return 'Sparkles';
  if (id.includes('ai-2')) return 'Bot';
  
  if (id.includes('tool-1')) return 'FileJson';
  if (id.includes('tool-2')) return 'Table';
  if (id.includes('tool-3')) return 'Clipboard';
  if (id.includes('tool-4')) return 'Scissors';
  if (id.includes('tool-5')) return 'Network';
  
  if (id.includes('int-1')) return 'Mail';
  if (id.includes('int-2')) return 'Plane';
  if (id.includes('int-3')) return 'Plane';
  if (id.includes('int-4')) return 'Globe';
  if (id.includes('int-5')) return 'Globe';
  
  if (id.includes('med-1')) return 'Film';
  if (id.includes('med-2')) return 'PlayCircle';
  
  if (id.includes('com-1')) return 'MessageSquare';
  if (id.includes('com-2')) return 'Cpu';
  if (id.includes('com-3')) return 'Server';
  
  if (id.includes('nav-1')) return 'Compass';
  if (id.includes('nav-2')) return 'Bot';

  return isCategory ? 'Hash' : 'Globe';
};
import React from 'react';
import { Music } from 'lucide-react';

interface MusicPlayerProps {
  onLaunch: () => void;
}

const MusicPlayer: React.FC<MusicPlayerProps> = ({ onLaunch }) => {
  return (
    <button
      onClick={onLaunch}
      className="fixed bottom-24 right-6 z-40 p-3 rounded-full shadow-lg transition-all duration-300 hover:scale-105 group
        bg-white text-slate-700 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700
        hover:bg-red-50 hover:text-red-500 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-900/50
      "
      title="进入音乐平台"
    >
      <Music size={20} className="group-hover:rotate-12 transition-transform duration-300" />
      <span className="absolute -top-1 -right-1 flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
      </span>
    </button>
  );
};

export default MusicPlayer;
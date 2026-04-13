import React from 'react';

export interface LinkItem {
  id: string;
  title: string;
  url: string;
  icon: React.ReactNode;
  description?: string;
}

export interface Category {
  id: string;
  title: string;
  icon?: React.ReactNode;
  links: LinkItem[];
}

export interface WeatherData {
  temperature: number;
  weatherCode: number;
  isDay: boolean;
  windSpeed: number;
}

export enum SearchEngine {
  Google = 'https://www.google.com/search?q=',
  Bing = 'https://www.bing.com/search?q=',
  Baidu = 'https://www.baidu.com/s?wd=',
  DuckDuckGo = 'https://duckduckgo.com/?q='
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  imageUrl?: string;
  isLoading?: boolean;
}

// User Profile based on the 'users' table screenshot
export interface UserProfile {
  id: string; // uuid
  email: string | null;
  username: string | null;
  nickname: string | null;
  signature: string | null;
  badge: string | null;
  avatar_url: string | null;
  created_at?: string;
}

// Guestbook Message
export interface GuestbookMessage {
  id: string;
  user_id: string;
  content: string;
  nickname: string | null;
  avatar_url: string | null;
  created_at: string;
}

// Spark / Inspiration
export interface Spark {
  id: string;
  user_id: string;
  type: 'text' | 'image';
  content: string;
  created_at: string;
}

// Music Types
export interface Artist {
  id: number | string;
  name: string;
}

export interface Album {
  id: number | string;
  name: string;
  picUrl: string;
}

export interface Song {
  id: number | string;
  name: string;
  ar: Artist[];
  al: Album;
  dt: number; // Duration in ms
  url?: string; // Populated after fetching
  source?: string; // 'netease', 'kuwo', 'qq', etc.
  lyric?: string; // Raw lyric text
}

export interface Playlist {
  id: number | string;
  name: string;
  coverImgUrl: string;
  description: string;
  trackCount: number;
  playCount: number;
  source?: 'netease' | 'qq' | 'kuwo';
  // Extended info for Album details
  artist?: string;
  publishTime?: string;
  company?: string;
}

export interface MVItem {
  id: number | string;
  name: string;
  artistName?: string;
  cover?: string;
  playCount?: number;
  duration?: number;
}

export interface LyricLine {
  time: number; // Time in seconds
  text: string;
}

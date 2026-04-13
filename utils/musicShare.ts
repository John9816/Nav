import { SharedSongRequest, Song } from '../types';

export const MUSIC_SHARE_PARAM_KEYS = [
  'musicShare',
  'musicSongId',
  'musicSource',
  'musicName',
  'musicArtist',
  'musicAlbum',
  'musicAlbumId',
  'musicCover',
  'musicDuration',
] as const;

const DEFAULT_COVER = `data:image/svg+xml;utf8,${encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="24" fill="#e2e8f0"/><circle cx="60" cy="60" r="28" fill="#94a3b8"/><circle cx="60" cy="60" r="9" fill="#e2e8f0"/></svg>'
)}`;

const splitArtists = (value: string | null) => {
  if (!value) return [];
  return value
    .split(' / ')
    .map(item => item.trim())
    .filter(Boolean);
};

export const buildSongShareUrl = (song: Song, baseUrl?: string) => {
  const targetUrl = baseUrl ?? (typeof window !== 'undefined' ? window.location.href : 'http://localhost/');
  const url = new URL(targetUrl);

  MUSIC_SHARE_PARAM_KEYS.forEach(key => url.searchParams.delete(key));

  url.searchParams.set('musicShare', '1');
  url.searchParams.set('musicSongId', String(song.id));
  url.searchParams.set('musicSource', song.source || 'netease');
  url.searchParams.set('musicName', song.name);

  const artistText = song.ar.map(artist => artist.name).filter(Boolean).join(' / ');
  if (artistText) {
    url.searchParams.set('musicArtist', artistText);
  }

  if (song.al?.name) {
    url.searchParams.set('musicAlbum', song.al.name);
  }

  if (song.al?.id !== undefined && song.al?.id !== null) {
    url.searchParams.set('musicAlbumId', String(song.al.id));
  }

  if (song.al?.picUrl && !song.al.picUrl.startsWith('data:image/svg+xml')) {
    url.searchParams.set('musicCover', song.al.picUrl);
  }

  if (Number.isFinite(song.dt) && song.dt > 0) {
    url.searchParams.set('musicDuration', String(song.dt));
  }

  return url.toString();
};

export const parseSharedSongRequest = (urlString?: string): SharedSongRequest | null => {
  const targetUrl = urlString ?? (typeof window !== 'undefined' ? window.location.href : null);
  if (!targetUrl) return null;

  const url = new URL(targetUrl);
  if (url.searchParams.get('musicShare') !== '1') {
    return null;
  }

  const id = url.searchParams.get('musicSongId');
  if (!id) {
    return null;
  }

  const durationText = url.searchParams.get('musicDuration');
  const duration = durationText ? Number(durationText) : undefined;

  return {
    id,
    source: url.searchParams.get('musicSource') || 'netease',
    name: url.searchParams.get('musicName') || undefined,
    artists: splitArtists(url.searchParams.get('musicArtist')),
    album: url.searchParams.get('musicAlbum') || undefined,
    albumId: url.searchParams.get('musicAlbumId') || undefined,
    cover: url.searchParams.get('musicCover') || undefined,
    duration: Number.isFinite(duration) ? duration : undefined,
  };
};

export const buildSongFromSharedRequest = (request: SharedSongRequest): Song => {
  const artists = request.artists && request.artists.length > 0
    ? request.artists
    : ['Unknown Artist'];

  return {
    id: request.id,
    name: request.name || 'Unknown Title',
    ar: artists.map((name, index) => ({
      id: `shared-artist-${index}`,
      name,
    })),
    al: {
      id: request.albumId || `shared-album-${request.id}`,
      name: request.album || 'Shared Song',
      picUrl: request.cover || DEFAULT_COVER,
    },
    dt: request.duration || 0,
    source: request.source || 'netease',
  };
};

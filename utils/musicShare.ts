import { Song } from '../types';

export const buildSongShareUrl = (song: Song) => {
  const source = song.source || 'netease';
  const id = encodeURIComponent(String(song.id));

  switch (source) {
    case 'qq':
      return `https://y.qq.com/n/ryqq/songDetail/${id}`;
    case 'kuwo':
      return `https://www.kuwo.cn/play_detail/${id}`;
    case 'netease':
    default:
      return `https://music.163.com/#/song?id=${id}`;
  }
};

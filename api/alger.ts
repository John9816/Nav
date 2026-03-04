import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as http from 'http';

export default function handler(req: VercelRequest, res: VercelResponse) {
  // _path is set by vercel.json rewrite, e.g. "api/top/playlist"
  const urlPath = (req.query._path as string) || '';

  // Forward all query params except the internal _path
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(req.query)) {
    if (key === '_path') continue;
    if (Array.isArray(value)) value.forEach(v => qs.append(key, v));
    else if (value !== undefined) qs.set(key, value as string);
  }
  const search = qs.toString() ? `?${qs.toString()}` : '';

  const options: http.RequestOptions = {
    hostname: 'mc.alger.fun',
    path: `/${urlPath}${search}`,
    method: 'GET',
    headers: {
      'Referer': 'http://mc.alger.fun/',
      'Origin': 'http://mc.alger.fun/',
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
      'Cookie': 'Hm_lvt_75a7ee3d3875dfdd2fe9d134883ddcbd=1770619363; Hm_lpvt_75a7ee3d3875dfdd2fe9d134883ddcbd=1770619363; HMACCOUNT=391951E145164861; Hm_lvt_27b3850e627d266b20b38cce19af18f7=1770619363; Hm_lpvt_27b3850e627d266b20b38cce19af18f7=1770619363; NMTID=00OJmnLN0vuY4_DNEWjghYex0iwyA4AAAGcQSUqFw',
    },
  };

  const proxyReq = http.request(options, (proxyRes) => {
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(proxyRes.statusCode || 200);
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (e) => {
    res.status(502).json({ error: 'Upstream request failed', detail: String(e) });
  });

  proxyReq.end();
}

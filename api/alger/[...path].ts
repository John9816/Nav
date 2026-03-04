import type { VercelRequest, VercelResponse } from '@vercel/node';

const TARGET = 'http://mc.alger.fun';

const FORWARD_HEADERS: Record<string, string> = {
  'Referer': 'http://mc.alger.fun/',
  'Origin': 'http://mc.alger.fun/',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36',
  'Cookie': 'Hm_lvt_75a7ee3d3875dfdd2fe9d134883ddcbd=1770619363; Hm_lpvt_75a7ee3d3875dfdd2fe9d134883ddcbd=1770619363; HMACCOUNT=391951E145164861; Hm_lvt_27b3850e627d266b20b38cce19af18f7=1770619363; Hm_lpvt_27b3850e627d266b20b38cce19af18f7=1770619363; NMTID=00OJmnLN0vuY4_DNEWjghYex0iwyA4AAAGcQSUqFw',
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const pathSegments = (req.query.path as string[]) || [];
  const path = pathSegments.join('/');
  const search = req.url?.split('?')[1] ? `?${req.url.split('?')[1]}` : '';
  const url = `${TARGET}/${path}${search}`;

  try {
    const upstream = await fetch(url, {
      method: req.method,
      headers: FORWARD_HEADERS,
    });

    const body = await upstream.text();

    res.setHeader('Content-Type', upstream.headers.get('Content-Type') || 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(upstream.status).send(body);
  } catch (e) {
    res.status(502).json({ error: 'Upstream request failed', detail: String(e) });
  }
}

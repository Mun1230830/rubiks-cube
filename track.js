// ソルブ完了1回につき1回呼ばれる、記録用の受け口。
// 個人情報は扱わず、日別の解いた回数とガイド使用状況だけを集計する。
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method not allowed' });
    return;
  }

  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    // データベース未設定でもアプリ本体は壊さない。
    res.status(200).json({ ok: false, reason: 'storage not configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = {}; }
  }
  const { oll, pll, zbll, help, size } = body || {};

  const today = new Date().toISOString().slice(0, 10);
  const cmds = [
    ['INCR', 'solves:total'],
    ['INCR', `solves:day:${today}`],
    ['SADD', 'solves:days', today]
  ];
  if (oll) cmds.push(['INCR', 'solves:oll']);
  if (pll) cmds.push(['INCR', 'solves:pll']);
  if (zbll) cmds.push(['INCR', 'solves:zbll']);
  if (help) cmds.push(['INCR', 'solves:help']);
  if (typeof size === 'number' && isFinite(size)) {
    cmds.push(['INCRBY', 'solves:size:sum', Math.round(size)]);
    cmds.push(['INCR', 'solves:size:count']);
  }

  try {
    await fetch(`${url}/pipeline`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(cmds)
    });
  } catch (err) {
    // 記録の取りこぼしは許容する(アプリ本体の動作を優先)。
  }

  res.status(204).end();
}

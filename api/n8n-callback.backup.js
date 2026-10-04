module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const callbackSecret = req.headers['x-callback-secret'];
  if (!process.env.N8N_CALLBACK_SECRET || callbackSecret !== process.env.N8N_CALLBACK_SECRET) {
    return res.status(401).json({ error: 'Yetkisiz callback.' });
  }

  const taskId = String(req.body?.taskId || '').trim();
  const status = String(req.body?.status || '').trim();
  if (!/^[0-9a-f-]{36}$/i.test(taskId)) return res.status(400).json({ error: 'Geçerli taskId gerekli.' });
  if (!['processed', 'failed'].includes(status)) return res.status(400).json({ error: 'status processed veya failed olmalı.' });

  const url = process.env.SUPABASE_URL;
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!url || !secretKey) return res.status(500).json({ error: 'Server-side Supabase secret tanımlı değil.' });

  const response = await fetch(`${url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      apikey: secretKey,
      Prefer: 'return=minimal'
    },
    body: JSON.stringify({ automation_status: status, updated_at: new Date().toISOString() })
  });

  if (!response.ok) {
    const text = await response.text();
    return res.status(502).json({ error: `Supabase callback update başarısız: ${text.slice(0, 300)}` });
  }

  return res.status(200).json({ ok: true });
};

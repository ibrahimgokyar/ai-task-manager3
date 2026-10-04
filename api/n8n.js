const { verifySupabaseUser } = require('./_auth');

async function getTaskForUser(taskId, userId, userToken) {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;
  const response = await fetch(`${url}/rest/v1/tasks?id=eq.${encodeURIComponent(taskId)}&user_id=eq.${encodeURIComponent(userId)}&select=id,title,description,status,priority,due_date,automation_status`, {
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${userToken}`
    }
  });
  if (!response.ok) throw new Error('Görev doğrulanamadı.');
  const rows = await response.json();
  return rows[0] || null;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const user = await verifySupabaseUser(req);
    const taskId = String(req.body?.taskId || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(taskId)) return res.status(400).json({ error: 'Geçerli taskId gerekli.' });

    const authHeader = req.headers.authorization || '';
    const userToken = authHeader.slice(7);
    const task = await getTaskForUser(taskId, user.id, userToken);
    if (!task) return res.status(404).json({ error: 'Görev bulunamadı veya erişim yetkiniz yok.' });

    const webhookUrl = process.env.N8N_WEBHOOK_URL;
    const webhookSecret = process.env.N8N_WEBHOOK_SECRET;
    if (!webhookUrl || !webhookSecret) {
      return res.status(500).json({ error: 'n8n environment ayarları eksik.' });
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': webhookSecret
      },
      body: JSON.stringify({
        event: 'task.automation.requested',
        requestedAt: new Date().toISOString(),
        userId: user.id,
        task
      })
    });

    const responseText = await response.text();
    if (!response.ok) {
      return res.status(502).json({ error: `n8n HTTP ${response.status}: ${responseText.slice(0, 300)}` });
    }

    let payload = null;
    try { payload = responseText ? JSON.parse(responseText) : null; } catch { payload = { raw: responseText }; }
    return res.status(200).json({ message: 'Görev n8n workflowuna gönderildi.', workflow: payload });
  } catch (error) {
    return res.status(error.statusCode || 500).json({ error: error.message });
  }
};

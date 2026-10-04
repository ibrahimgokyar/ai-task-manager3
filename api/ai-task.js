const { verifySupabaseUser } = require('./_auth');

function cleanJsonText(text) {
  return String(text || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
}

function validateSuggestion(value) {
  if (!value || typeof value !== 'object') throw new Error('AI sonucu nesne değil.');
  if (typeof value.title !== 'string' || !value.title.trim()) throw new Error('AI sonucu title içermiyor.');

  const priority = ['low', 'normal', 'high'].includes(value.priority) ? value.priority : 'normal';
  const dueDate = typeof value.due_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.due_date)
    ? value.due_date
    : null;

  return {
    title: value.title.trim().slice(0, 120),
    description: typeof value.description === 'string' ? value.description.trim().slice(0, 1200) : '',
    priority,
    due_date: dueDate,
    subtasks: Array.isArray(value.subtasks)
      ? value.subtasks.filter(x => typeof x === 'string').slice(0, 8).map(x => x.trim().slice(0, 160))
      : []
  };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    await verifySupabaseUser(req);
    const text = String(req.body?.text || '').trim();
    if (text.length < 5 || text.length > 2000) {
      return res.status(400).json({ error: 'text alanı 5-2000 karakter arasında olmalıdır.' });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY tanımlı değil.' });

    const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 25000);

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model,
        max_tokens: 700,
        system: 'Sen bir görev planlama asistanısın. Yalnızca verilen görev isteğini yapılandır. Hassas bilgi isteme. Cevabın yalnızca geçerli JSON olsun.',
        messages: [{
          role: 'user',
          content: `Aşağıdaki isteği görev nesnesine dönüştür. Sadece JSON döndür. Alanlar: title (string), description (string), priority (low|normal|high), due_date (YYYY-MM-DD veya null), subtasks (string array, en fazla 8). Kullanıcı isteği: ${text}`
        }]
      })
    }).finally(() => clearTimeout(timeout));

    const body = await response.json();
    if (!response.ok) {
      const message = body?.error?.message || `Anthropic API HTTP ${response.status}`;
      return res.status(response.status === 429 ? 429 : 502).json({ error: message });
    }

    const content = Array.isArray(body.content) ? body.content.find(x => x.type === 'text')?.text : '';
    if (!content) return res.status(502).json({ error: 'Model metin yanıtı üretmedi.' });

    let parsed;
    try {
      parsed = JSON.parse(cleanJsonText(content));
    } catch {
      return res.status(502).json({ error: 'Model geçerli JSON üretmedi.' });
    }

    const suggestion = validateSuggestion(parsed);
    return res.status(200).json({ suggestion });
  } catch (error) {
    const status = error.name === 'AbortError' ? 504 : (error.statusCode || 500);
    return res.status(status).json({ error: error.name === 'AbortError' ? 'AI isteği zaman aşımına uğradı.' : error.message });
  }
};

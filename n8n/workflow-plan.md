# n8n Entegrasyon Planı

## Akış
1. Web uygulamasında kullanıcı "n8n Otomasyonuna Gönder" butonuna basar.
2. Browser, Supabase access token ile `POST /api/n8n` çağırır.
3. Vercel Function kullanıcı tokenını Supabase Auth üzerinden doğrular.
4. Function görevin gerçekten o kullanıcıya ait olduğunu RLS etkili REST çağrısıyla kontrol eder.
5. Function n8n Production Webhook URL'sine `X-Webhook-Secret` header ve görev JSON'u gönderir.
6. n8n Webhook node isteği alır.
7. Edit Fields/Code ile payload normalize edilir.
8. İsteğe göre e-posta, Google Docs, Slack, CRM veya başka bir servis çalıştırılır.
9. n8n HTTP Request node, Vercel `POST /api/n8n-callback` endpoint'ine taskId + status gönderir.
10. Callback endpoint, yalnızca server-side Supabase secret kullanarak `automation_status` alanını günceller.

## n8n Webhook
- Method: POST
- Production path: `ai-task-event`
- Authentication: Header Auth önerilir.
- Header: `X-Webhook-Secret`
- Value: Vercel'deki `N8N_WEBHOOK_SECRET` ile aynı değer.

## Gelen örnek payload
```json
{
  "event": "task.automation.requested",
  "requestedAt": "2026-09-12T12:00:00.000Z",
  "userId": "...",
  "task": {
    "id": "...",
    "title": "Müşteri demosunu hazırla",
    "description": "...",
    "status": "todo",
    "priority": "high",
    "due_date": "2026-09-18",
    "automation_status": "queued"
  }
}
```

## HTTP Request node ile callback
- Method: POST
- URL: `https://YOUR-APP.vercel.app/api/n8n-callback`
- Header: `X-Callback-Secret: <N8N_CALLBACK_SECRET>`
- JSON Body:
```json
{
  "taskId": "={{ $json.task.id }}",
  "status": "processed"
}
```

## Güvenlik notları
- Webhook URL'sini browser koduna koymayın.
- n8n webhook'u header authentication ile koruyun.
- Callback secret'ı n8n credential/secret yönetiminde saklayın.
- Supabase secret/service-role anahtarı yalnızca server-side function içinde olmalıdır.
- Workflow loglarında API key, access token veya parola kaydetmeyin.

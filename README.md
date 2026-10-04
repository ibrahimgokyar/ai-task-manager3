# AI Task Manager - YZ Destekli Web Uygulaması Geliştirme Akademisi

Vanilla HTML/CSS/JavaScript, Supabase, Claude API, Vercel Functions ve n8n entegrasyonunu birlikte gösteren final proje.

## Özellikler
- Supabase email/password Authentication
- RLS korumalı görev CRUD
- AI ile görev önerisi (server-side Claude API)
- Kullanıcı onayı sonrası görev kaydetme (human-in-the-loop)
- Geri bildirim formu
- Vercel deploy
- n8n Webhook + HTTP Request callback entegrasyonu
- Health endpoint

## 1. Supabase
1. Yeni proje oluşturun.
2. SQL Editor'da `sql/schema.sql` dosyasını çalıştırın.
3. Authentication > Email provider ayarlarını kontrol edin.
4. Project Settings/API bölümünden URL ve publishable key alın.
5. Server-side callback için Supabase secret key kullanın. Bu anahtarı browser'a koymayın.

## 2. Local environment
`.env.example` dosyasını `.env` olarak kopyalayın ve değerleri doldurun. Vercel Functions yerelde test edilecekse Vercel CLI kullanılabilir.

## 3. Vercel Environment Variables
Project > Settings > Environment Variables bölümüne ekleyin:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `ANTHROPIC_API_KEY`
- `ANTHROPIC_MODEL` (örn. `claude-sonnet-5`; hesabınızda aktif model kullanın)
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_SECRET`
- `N8N_CALLBACK_SECRET`

Değişken ekledikten/değiştirdikten sonra redeploy edin.

## 4. GitHub ve Vercel
```bash
git init
git add .
git commit -m "Initial AI task manager"
git branch -M main
git remote add origin https://github.com/USERNAME/REPO.git
git push -u origin main
```
Vercel'de New Project > GitHub repository > Deploy.

## 5. n8n
`n8n/workflow-plan.md` dosyasını okuyun. `n8n/sample-workflow.json` örnek başlangıç workflowudur. Import sonrası:
1. Webhook node için Header Auth credential ekleyin ve `X-Webhook-Secret` değerini Vercel `N8N_WEBHOOK_SECRET` ile eşleyin (veya reverse proxy/Code kontrolü uygulayın).
2. Production webhook URL'sini Vercel `N8N_WEBHOOK_URL` olarak kaydedin.
3. HTTP Request callback URL'sinde `YOUR-APP` alanını gerçek Vercel domainiyle değiştirin.
4. n8n ortamında `N8N_CALLBACK_SECRET` tanımlayın veya secret'ı bir credential üzerinden yönetin.
5. Workflow'u Publish/Active hale getirin.

## 6. Test sırası
- Kayıt ol / giriş yap
- Görev ekle
- Sayfayı yenile; görev kalmalı
- İkinci kullanıcıyla giriş yap; ilk kullanıcının görevleri görünmemeli
- AI önerisi al; önce forma dolmalı, otomatik kaydedilmemeli
- n8n otomasyonuna gönder; `automation_status` queued -> processed olmalı
- `/api/health` çağrısı 200 dönmeli

## Güvenlik
- `SUPABASE_SECRET_KEY`, `ANTHROPIC_API_KEY`, n8n secret değerleri frontend'e konmaz.
- Public/publishable Supabase key tek başına yetkilendirme sağlamaz; RLS zorunludur.
- `innerHTML` ile kullanıcı/AI çıktısı basmak yerine `textContent` tercih edilmiştir.
- n8n webhook ve callback secret ile korunmalıdır.

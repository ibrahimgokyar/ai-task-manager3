let supabaseClient = null;
let currentUser = null;

const $ = (id) => document.getElementById(id);

function showMessage(message, isError = false) {
  const el = $('globalMessage');
  el.textContent = message;
  el.style.background = isError ? '#7a271a' : '#111827';
  el.hidden = false;
  window.clearTimeout(showMessage.timer);
  showMessage.timer = window.setTimeout(() => {
    el.hidden = true;
  }, 4000);
}

function setBusy(button, busy, busyText = 'İşleniyor...') {
  if (!button) return;

  if (busy) {
    button.dataset.originalText = button.textContent;
    button.textContent = busyText;
    button.disabled = true;
  } else {
    button.textContent =
      button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const bodyText = await response.text();

  let body = null;

  if (bodyText) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      body = { raw: bodyText };
    }
  }

  if (!response.ok) {
    const message =
      body?.error ||
      body?.message ||
      `HTTP ${response.status}`;

    throw new Error(message);
  }

  return body;
}

async function init() {
  try {
    const config = await fetchJson('/api/config');

    if (
      !config.supabaseUrl ||
      !config.supabasePublishableKey
    ) {
      throw new Error(
        'Supabase public yapılandırması eksik.'
      );
    }

    supabaseClient = window.supabase.createClient(
      config.supabaseUrl,
      config.supabasePublishableKey
    );

    bindEvents();

    const {
      data: { session }
    } = await supabaseClient.auth.getSession();

    await applySession(session);

    supabaseClient.auth.onAuthStateChange(
      async (_event, session) => {
        await applySession(session);
      }
    );
  } catch (error) {
    console.error(error);

    showMessage(
      `Başlatma hatası: ${error.message}`,
      true
    );
  }
}

function bindEvents() {
  $('loginForm').addEventListener('submit', login);
  $('registerForm').addEventListener('submit', register);
  $('logoutBtn').addEventListener('click', logout);
  $('taskForm').addEventListener('submit', saveTask);
  $('cancelEditBtn').addEventListener('click', resetTaskForm);
  $('refreshBtn').addEventListener('click', loadTasks);
  $('aiSuggestBtn').addEventListener('click', getAiSuggestion);
  $('feedbackForm').addEventListener('submit', submitFeedback);
}

async function applySession(session) {
  currentUser = session?.user || null;

  $('authSection').hidden = Boolean(currentUser);
  $('appSection').hidden = !currentUser;
  $('sessionBox').hidden = !currentUser;
  $('sessionEmail').textContent =
    currentUser?.email || '';

  if (currentUser) {
    await loadTasks();
  }
}

async function register(event) {
  event.preventDefault();

  const button = event.submitter;
  const email = $('registerEmail').value.trim();
  const password = $('registerPassword').value;

  if (!email || password.length < 6) {
    showMessage(
      'Geçerli e-posta ve en az 6 karakter şifre girin.',
      true
    );
    return;
  }

  try {
    setBusy(button, true, 'Kayıt yapılıyor...');

    const { error } =
      await supabaseClient.auth.signUp({
        email,
        password
      });

    if (error) throw error;

    showMessage(
      'Kayıt oluşturuldu. Proje ayarınıza göre e-posta doğrulaması gerekebilir.'
    );
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(button, false);
  }
}

async function login(event) {
  event.preventDefault();

  const button = event.submitter;
  const email = $('loginEmail').value.trim();
  const password = $('loginPassword').value;

  try {
    setBusy(button, true, 'Giriş yapılıyor...');

    const { error } =
      await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    showMessage('Giriş başarılı.');
  } catch (error) {
    showMessage(
      'Giriş başarısız: ' + error.message,
      true
    );
  } finally {
    setBusy(button, false);
  }
}

async function logout() {
  try {
    const { error } =
      await supabaseClient.auth.signOut();

    if (error) throw error;

    resetTaskForm();
    showMessage('Oturum kapatıldı.');
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function loadTasks() {
  if (!currentUser) return;

  const list = $('taskList');
  list.textContent = 'Görevler yükleniyor...';

  try {
    const { data, error } =
      await supabaseClient
        .from('tasks')
        .select(
          'id,title,description,status,priority,due_date,automation_status,ai_analysis,created_at'
        )
        .order('created_at', { ascending: false });

    if (error) throw error;

    renderTasks(data || []);
  } catch (error) {
    list.textContent = '';

    const p = document.createElement('p');
    p.className = 'status-error';
    p.textContent =
      'Görevler alınamadı: ' + error.message;

    list.appendChild(p);
  }
}

function renderTasks(tasks) {
  const list = $('taskList');
  list.textContent = '';

  if (!tasks.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent =
      'Henüz görev yok. İlk görevinizi oluşturun.';

    list.appendChild(empty);
    return;
  }

  for (const task of tasks) {
    const card = document.createElement('article');
    card.className = 'task-card';

    const title = document.createElement('h3');
    title.textContent = task.title;
    card.appendChild(title);

    if (task.description) {
      const desc = document.createElement('p');
      desc.textContent = task.description;
      card.appendChild(desc);
    }

    const meta = document.createElement('div');
    meta.className = 'task-meta';

    for (const label of [
      `Durum: ${task.status}`,
      `Öncelik: ${task.priority}`,
      task.due_date
        ? `Bitiş: ${task.due_date}`
        : null,
      `n8n: ${task.automation_status || 'not_sent'}`
    ].filter(Boolean)) {
      const badge = document.createElement('span');
      badge.className = 'badge';
      badge.textContent = label;
      meta.appendChild(badge);
    }

    card.appendChild(meta);

    /*
     * CLAUDE AI ANALİZİ
     * ai_analysis doluysa Göster/Gizle bölümü oluşturulur.
     */
    if (task.ai_analysis) {
      const aiSection = document.createElement('div');
      aiSection.className = 'ai-analysis-section';

      const aiToggleBtn = document.createElement('button');
      aiToggleBtn.type = 'button';
      aiToggleBtn.className = 'btn btn-secondary';
      aiToggleBtn.textContent =
        '✨ Claude AI Analizini Göster';

      const aiContent = document.createElement('div');
      aiContent.className = 'ai-analysis-content';
      aiContent.hidden = true;

      const aiText = document.createElement('pre');
      aiText.className = 'ai-analysis-text';

      /*
       * textContent kullanıyoruz.
       * Claude çıktısını doğrudan HTML olarak çalıştırmıyoruz.
       */
      aiText.textContent = task.ai_analysis;

      aiContent.appendChild(aiText);

      aiToggleBtn.addEventListener('click', () => {
        aiContent.hidden = !aiContent.hidden;

        aiToggleBtn.textContent = aiContent.hidden
          ? '✨ Claude AI Analizini Göster'
          : '✨ Claude AI Analizini Gizle';
      });

      aiSection.append(aiToggleBtn, aiContent);
      card.appendChild(aiSection);
    }

    const actions = document.createElement('div');
    actions.className = 'task-actions';

    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'btn btn-secondary';
    editBtn.textContent = 'Düzenle';
    editBtn.addEventListener(
      'click',
      () => editTask(task)
    );

    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'btn btn-danger';
    deleteBtn.textContent = 'Sil';
    deleteBtn.addEventListener(
      'click',
      () => deleteTask(task.id)
    );

    const automateBtn = document.createElement('button');
    automateBtn.type = 'button';
    automateBtn.className = 'btn';
    automateBtn.textContent =
      'n8n Otomasyonuna Gönder';

    automateBtn.addEventListener(
      'click',
      () => sendTaskToN8n(task, automateBtn)
    );

    actions.append(
      editBtn,
      deleteBtn,
      automateBtn
    );

    card.appendChild(actions);
    list.appendChild(card);
  }
}

function editTask(task) {
  $('taskId').value = task.id;
  $('taskTitle').value = task.title || '';
  $('taskDescription').value =
    task.description || '';
  $('taskStatus').value =
    task.status || 'todo';
  $('taskPriority').value =
    task.priority || 'normal';
  $('taskDueDate').value =
    task.due_date || '';

  $('saveTaskBtn').textContent =
    'Güncelle';

  $('cancelEditBtn').hidden = false;
  $('taskTitle').focus();
}

function resetTaskForm() {
  $('taskForm').reset();

  $('taskId').value = '';
  $('taskStatus').value = 'todo';
  $('taskPriority').value = 'normal';
  $('saveTaskBtn').textContent = 'Kaydet';
  $('cancelEditBtn').hidden = true;
}

async function saveTask(event) {
  event.preventDefault();

  if (!currentUser) return;

  const button = event.submitter;
  const id = $('taskId').value;
  const title = $('taskTitle').value.trim();

  if (!title) {
    showMessage(
      'Başlık zorunludur.',
      true
    );
    return;
  }

  const payload = {
    user_id: currentUser.id,
    title,
    description:
      $('taskDescription').value.trim() || null,
    status: $('taskStatus').value,
    priority: $('taskPriority').value,
    due_date: $('taskDueDate').value || null,
    updated_at: new Date().toISOString()
  };

  try {
    setBusy(
      button,
      true,
      id ? 'Güncelleniyor...' : 'Kaydediliyor...'
    );

    let result;

    if (id) {
      result =
        await supabaseClient
          .from('tasks')
          .update(payload)
          .eq('id', id);
    } else {
      result =
        await supabaseClient
          .from('tasks')
          .insert(payload);
    }

    if (result.error) {
      throw result.error;
    }

    showMessage(
      id
        ? 'Görev güncellendi.'
        : 'Görev oluşturuldu.'
    );

    resetTaskForm();
    await loadTasks();
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(button, false);
  }
}

async function deleteTask(id) {
  if (
    !window.confirm(
      'Bu görevi silmek istediğinize emin misiniz?'
    )
  ) {
    return;
  }

  try {
    const { error } =
      await supabaseClient
        .from('tasks')
        .delete()
        .eq('id', id);

    if (error) throw error;

    showMessage('Görev silindi.');
    await loadTasks();
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function getAccessToken() {
  const {
    data: { session }
  } = await supabaseClient.auth.getSession();

  if (!session?.access_token) {
    throw new Error(
      'Aktif oturum bulunamadı.'
    );
  }

  return session.access_token;
}

async function getAiSuggestion() {
  const button = $('aiSuggestBtn');
  const prompt = $('aiPrompt').value.trim();

  if (prompt.length < 5) {
    showMessage(
      'AI için en az 5 karakterlik bir açıklama girin.',
      true
    );
    return;
  }

  try {
    setBusy(
      button,
      true,
      'AI düşünüyor...'
    );

    const token = await getAccessToken();

    const result =
      await fetchJson(
        '/api/ai-task',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            text: prompt
          })
        }
      );

    const suggestion = result.suggestion;

    $('taskTitle').value =
      suggestion.title || '';

    $('taskDescription').value =
      [
        suggestion.description || '',
        Array.isArray(suggestion.subtasks) &&
        suggestion.subtasks.length
          ? `\nAlt görevler:\n- ${suggestion.subtasks.join('\n- ')}`
          : ''
      ].join('').trim();

    if (
      ['low', 'normal', 'high'].includes(
        suggestion.priority
      )
    ) {
      $('taskPriority').value =
        suggestion.priority;
    }

    if (
      suggestion.due_date &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        suggestion.due_date
      )
    ) {
      $('taskDueDate').value =
        suggestion.due_date;
    }

    $('aiResult').textContent =
      'AI önerisi forma aktarıldı. İnceleyip düzenledikten sonra Kaydet butonuyla onaylayın.';

    $('aiResult').hidden = false;
    $('taskTitle').focus();
  } catch (error) {
    $('aiResult').hidden = true;

    showMessage(
      'AI önerisi alınamadı: ' +
        error.message,
      true
    );
  } finally {
    setBusy(button, false);
  }
}

async function sendTaskToN8n(task, button) {
  try {
    setBusy(
      button,
      true,
      'Gönderiliyor...'
    );

    const token = await getAccessToken();

    const { error } =
      await supabaseClient
        .from('tasks')
        .update({
          automation_status: 'queued',
          updated_at:
            new Date().toISOString()
        })
        .eq('id', task.id);

    if (error) {
      throw error;
    }

    const result =
      await fetchJson(
        '/api/n8n',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            taskId: task.id
          })
        }
      );

    showMessage(
      result.message ||
        'Görev n8n workflowuna gönderildi.'
    );

    await loadTasks();
  } catch (error) {
    await supabaseClient
      .from('tasks')
      .update({
        automation_status: 'failed'
      })
      .eq('id', task.id);

    showMessage(
      'n8n gönderimi başarısız: ' +
        error.message,
      true
    );
  } finally {
    setBusy(button, false);
  }
}

async function submitFeedback(event) {
  event.preventDefault();

  const button = event.submitter;
  const message =
    $('feedbackMessage').value.trim();

  if (!message) {
    showMessage(
      'Geri bildirim mesajı zorunludur.',
      true
    );
    return;
  }

  try {
    setBusy(
      button,
      true,
      'Gönderiliyor...'
    );

    const { error } =
      await supabaseClient
        .from('feedback')
        .insert({
          user_id: currentUser.id,
          type: $('feedbackType').value,
          message,
          status: 'new'
        });

    if (error) {
      throw error;
    }

    $('feedbackForm').reset();

    showMessage(
      'Geri bildiriminiz alındı.'
    );
  } catch (error) {
    showMessage(error.message, true);
  } finally {
    setBusy(button, false);
  }
}

document.addEventListener(
  'DOMContentLoaded',
  init
);
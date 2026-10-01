const telegram = window.Telegram?.WebApp;

if (telegram) {
  const applyTheme = () => { document.documentElement.style.colorScheme = telegram.colorScheme; };
  applyTheme();
  telegram.onEvent('themeChanged', applyTheme);
  telegram.ready();
  telegram.expand();
}

const byId = (id) => typeof document !== 'undefined' && typeof document.getElementById === 'function' ? document.getElementById(id) : null;
const show = (id, visible = true) => { const node = byId(id); if (node) node.hidden = !visible; };
let currentPublication = null;

function toast(message, error = false) {
  const node = byId('toast');
  if (!node) return;
  node.textContent = message;
  node.className = error ? 'visible error' : 'visible';
  window.setTimeout?.(() => { node.className = ''; }, 3500);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    method: options.method || 'GET',
    headers: {
      Authorization: `tma ${telegram?.initData || ''}`,
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`);
  return payload;
}

function renderGate(membership, channelUrl) {
  show('loading', false); show('error-screen', false); show('member-app', false); show('membership-gate', true);
  const link = byId('join-channel');
  if (link && channelUrl) { link.hidden = false; link.href = channelUrl; link.dataset.url = channelUrl; }
  if (byId('membership-status')) byId('membership-status').textContent = `Last status: ${membership.status}`;
}

function renderSession(data) {
  if (!data.membership.authorized) { renderGate(data.membership, data.channelUrl); return; }
  show('loading', false); show('error-screen', false); show('membership-gate', false); show('member-app', true);
  const name = data.profile.firstName || data.profile.username || 'member';
  if (byId('welcome-title')) byId('welcome-title').textContent = `Welcome, ${name}`;
  if (byId('account-label')) byId('account-label').textContent = data.isAdmin ? 'Administrator' : 'Channel member';
  show('admin-area', data.isAdmin);
  if (data.isAdmin) loadPublications();
}

function showError(message) {
  show('loading', false); show('membership-gate', false); show('member-app', false); show('error-screen', true);
  if (byId('error-message')) byId('error-message').textContent = message;
}

async function bootstrap() {
  show('loading', true); show('error-screen', false);
  if (!telegram?.initData) { showError('Open this page from the REFIJIN LABS bot inside Telegram.'); return; }
  try { renderSession(await api('/api/auth/bootstrap', { method: 'POST' })); }
  catch (error) { showError(error.message); }
}

function formatDate(value) {
  if (!value) return 'Not yet';
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function publicationItem(publication) {
  const button = document.createElement('button');
  button.className = 'list-item';
  const title = document.createElement('strong'); title.textContent = publication.title;
  const meta = document.createElement('span'); meta.textContent = `${publication.status} · ${formatDate(publication.updatedAt)}`;
  button.append(title, meta);
  button.addEventListener('click', () => openEditor(publication));
  return button;
}

async function loadPublications() {
  const list = byId('publication-list');
  if (!list) return;
  list.textContent = 'Loading…';
  try {
    const data = await api('/api/admin/publications');
    list.replaceChildren(...data.publications.map(publicationItem));
    if (!data.publications.length) list.textContent = 'No publications yet.';
  } catch (error) { list.textContent = error.message; }
}

function openEditor(publication = null) {
  currentPublication = publication;
  show('publications-panel', false); show('editor-panel', true); show('publication-preview', false);
  byId('publication-id').value = publication?.id || '';
  byId('publication-title').value = publication?.title || '';
  byId('publication-body').value = publication?.body || '';
  byId('publication-meta').textContent = publication ? `${publication.status} · Updated ${formatDate(publication.updatedAt)}` : 'New draft';
  byId('delete-publication').hidden = publication?.status !== 'DRAFT';
  byId('publish-publication').hidden = publication?.status === 'PUBLISHED';
}

function formValue() {
  return { title: byId('publication-title').value, body: byId('publication-body').value };
}

async function savePublication() {
  const id = byId('publication-id').value;
  const data = await api(id ? `/api/admin/publications/${id}` : '/api/admin/publications', {
    method: id ? 'PATCH' : 'POST', body: formValue(),
  });
  currentPublication = data.publication;
  openEditor(currentPublication);
  toast('Publication saved.');
  return currentPublication;
}

async function loadSubscribers() {
  const list = byId('subscriber-list');
  list.textContent = 'Loading…';
  try {
    const data = await api('/api/admin/subscribers');
    const nodes = data.subscribers.map((subscriber) => {
      const item = document.createElement('div'); item.className = 'list-item static';
      const name = document.createElement('strong');
      name.textContent = [subscriber.first_name, subscriber.last_name].filter(Boolean).join(' ') || `Telegram ${subscriber.telegram_user_id}`;
      const meta = document.createElement('span');
      meta.textContent = `${subscriber.membership_status || 'unknown'} · Last seen ${formatDate(subscriber.last_seen_at)}`;
      item.append(name, meta); return item;
    });
    list.replaceChildren(...nodes);
    if (!nodes.length) list.textContent = 'No known users yet.';
  } catch (error) { list.textContent = error.message; }
}

if (typeof document !== 'undefined' && typeof document.getElementById === 'function') {
  byId('retry-bootstrap')?.addEventListener('click', bootstrap);
  byId('recheck-membership')?.addEventListener('click', async () => {
    try {
      const data = await api('/api/auth/recheck-membership', { method: 'POST' });
      if (data.membership.authorized) await bootstrap(); else renderGate(data.membership, data.channelUrl);
    } catch (error) { toast(error.message, true); }
  });
  byId('join-channel')?.addEventListener('click', (event) => {
    const url = event.currentTarget.dataset.url;
    if (telegram?.openTelegramLink && url) { event.preventDefault(); telegram.openTelegramLink(url); }
  });
  document.querySelectorAll?.('.tab').forEach((tab) => tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach((item) => item.classList.toggle('active', item === tab));
    const publications = tab.dataset.tab === 'publications';
    show('publications-panel', publications); show('editor-panel', false); show('subscribers-panel', !publications);
    if (!publications) loadSubscribers(); else loadPublications();
  }));
  byId('new-publication')?.addEventListener('click', () => openEditor());
  byId('close-editor')?.addEventListener('click', () => { show('editor-panel', false); show('publications-panel', true); loadPublications(); });
  byId('publication-form')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    try { await savePublication(); } catch (error) { toast(error.message, true); }
  });
  byId('preview-publication')?.addEventListener('click', () => {
    const value = formValue(); const preview = byId('publication-preview');
    preview.querySelector('h3').textContent = value.title || 'Untitled';
    preview.querySelector('p').textContent = value.body || 'No content'; show('publication-preview', true);
  });
  byId('publish-publication')?.addEventListener('click', async () => {
    try {
      const publication = await savePublication();
      const result = await api(`/api/admin/publications/${publication.id}/publish`, { method: 'POST' });
      openEditor(result.publication); toast('Published to the REFIJIN LABS channel.');
    } catch (error) { toast(error.message, true); }
  });
  byId('delete-publication')?.addEventListener('click', async () => {
    if (!currentPublication?.id || !window.confirm('Delete this draft?')) return;
    try {
      await api(`/api/admin/publications/${currentPublication.id}`, { method: 'DELETE' });
      currentPublication = null; show('editor-panel', false); show('publications-panel', true); await loadPublications(); toast('Draft deleted.');
    } catch (error) { toast(error.message, true); }
  });
  bootstrap();
}

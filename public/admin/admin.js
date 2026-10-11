(() => {
  const $ = (s) => document.querySelector(s);
  const st = { list: [], editing: null, logo: null, dims: null, tileTouched: false };

  async function api(path, opt = {}) {
    const r = await fetch('/api' + path, { credentials: 'same-origin', headers: { 'content-type': 'application/json' }, ...opt });
    let d = {}; try { d = await r.json(); } catch (e) {}
    if (!r.ok) { const err = new Error(d.error || 'Request failed (' + r.status + ')'); err.status = r.status; throw err; }
    return d;
  }
  const show = (signedIn) => { $('#loginView').hidden = signedIn; $('#dash').hidden = !signedIn; $('#logout').hidden = !signedIn; };
  const say = (el, text, isErr) => { el.textContent = text || ''; el.classList.toggle('err', !!isErr); };
  const guard = (e) => { if (e.status === 401) { show(false); say($('#loginMsg'), e.message, true); return true; } return false; };

  function readLogo(file) {
    return new Promise((res, rej) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => {
        const k = Math.min(1, 1000 / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        res({ data: c.toDataURL('image/webp', 0.9), w, h });
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error('That file could not be read as an image.')); };
      img.src = url;
    });
  }

  function preview(src, tile, flush, cap) {
    $('#preview').hidden = !src;
    if (!src) return;
    const t = $('#pvTile');
    t.style.setProperty('--tile', tile || '#ffffff');
    t.classList.toggle('flush', !!flush);
    t.style.setProperty('--cap', cap ? cap + 'px' : '100%');
    $('#pvImg').src = src;
  }
  const currentPreviewSrc = () => st.logo ? st.logo.data : (st.editing ? (st.list.find((p) => p.id === st.editing) || {}).logo : null);
  const refreshPreview = () => preview(currentPreviewSrc(), $('#f-tile').value, $('#f-flush').checked, parseInt($('#f-cap').value, 10) || 0);

  function resetForm() {
    st.editing = null; st.logo = null; st.tileTouched = false;
    $('#projForm').reset(); $('#f-tile').value = '#ffffff';
    $('#formTitle').textContent = 'Add a project'; $('#saveBtn').textContent = 'Save project';
    $('#cancelBtn').hidden = true; $('#logoHint').textContent = 'PNG, JPG, WebP or GIF. Large images are resized in your browser before upload.';
    preview(null); renderList();
  }

  function edit(id) {
    const p = st.list.find((x) => x.id === id); if (!p) return;
    st.editing = id; st.logo = null; st.tileTouched = false;
    $('#f-name').value = p.name; $('#f-location').value = p.location || ''; $('#f-role').value = p.role || '';
    $('#f-desc').value = p.description || ''; $('#f-link').value = p.link || '';
    $('#f-tile').value = /^#[0-9a-f]{6}$/i.test(p.tile) ? p.tile : '#ffffff';
    $('#f-cap').value = p.cap || ''; $('#f-size').value = p.size || ''; $('#f-flush').checked = !!p.flush;
    $('#f-logo').value = '';
    $('#formTitle').textContent = 'Edit project'; $('#saveBtn').textContent = 'Save changes'; $('#cancelBtn').hidden = false;
    $('#logoHint').textContent = 'Leave empty to keep the current logo.';
    say($('#formMsg'), ''); refreshPreview(); renderList();
    $('#projForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function renderList() {
    const ol = $('#list'); ol.textContent = '';
    $('#count').textContent = st.list.length ? '(' + st.list.length + ')' : '';
    if (!st.list.length) { const li = document.createElement('li'); li.className = 'hint'; li.textContent = 'No projects yet. Add your first one.'; ol.appendChild(li); return; }
    st.list.forEach((p, i) => {
      const li = document.createElement('li'); li.className = 'pitem' + (p.id === st.editing ? ' editing' : '');
      const th = document.createElement('div'); th.className = 'thumb'; th.style.background = p.tile || '#fff';
      const im = document.createElement('img'); im.src = p.logo; im.alt = ''; th.appendChild(im);
      const meta = document.createElement('div'); meta.className = 'pmeta';
      const n = document.createElement('strong'); n.textContent = p.name;
      const s = document.createElement('span'); s.textContent = [p.location, p.role].filter(Boolean).join(' · ');
      meta.append(n, s);
      const btns = document.createElement('div'); btns.className = 'pbtns';
      const mk = (label, act, aria, cls) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = label; b.dataset.act = act; b.dataset.id = p.id; b.setAttribute('aria-label', aria + ' ' + p.name); if (cls) b.className = cls; return b; };
      btns.append(mk('Edit', 'edit', 'Edit'));
      if (i > 0) btns.append(mk('Move up', 'up', 'Move up'));
      if (i < st.list.length - 1) btns.append(mk('Move down', 'down', 'Move down'));
      btns.append(mk('Delete', 'del', 'Delete', 'danger'));
      li.append(th, meta, btns); ol.appendChild(li);
    });
  }

  async function refresh() { st.list = (await api('/projects')).projects; renderList(); }

  async function start() {
    try {
      const s = await api('/session');
      if (!s.configured) { show(false); say($('#loginMsg'), 'Admin sign-in isn\u2019t set up yet. Add ADMIN_PASSWORD and SESSION_SECRET in Netlify, then redeploy.', true); return; }
      show(s.authenticated);
      if (s.authenticated) await refresh();
    } catch (e) { show(false); say($('#loginMsg'), 'Could not reach the server. Deploy with Netlify Functions to use this page.', true); }
  }

  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault(); say($('#loginMsg'), 'Signing in\u2026');
    try {
      await api('/login', { method: 'POST', body: JSON.stringify({ username: $('#username').value, password: $('#password').value }) });
      $('#password').value = ''; say($('#loginMsg'), ''); show(true); await refresh();
    } catch (err) { say($('#loginMsg'), err.message, true); }
  });
  $('#logout').addEventListener('click', async () => { try { await api('/logout', { method: 'POST', body: '{}' }); } catch (e) {} show(false); });

  $('#f-logo').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) { st.logo = null; refreshPreview(); return; }
    try {
      const r = await readLogo(f);
      if (r.data.length * 0.75 > 2 * 1024 * 1024) throw new Error('That image is still over 2 MB after resizing. Try a simpler file.');
      st.logo = r; say($('#formMsg'), ''); refreshPreview();
    } catch (err) { st.logo = null; e.target.value = ''; say($('#formMsg'), err.message, true); }
  });
  $('#f-tile').addEventListener('input', () => { st.tileTouched = true; refreshPreview(); });
  $('#f-flush').addEventListener('change', refreshPreview);
  $('#f-cap').addEventListener('input', refreshPreview);
  $('#cancelBtn').addEventListener('click', () => { resetForm(); say($('#formMsg'), ''); });

  $('#projForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const msg = $('#formMsg');
    if (!$('#f-name').value.trim()) { say(msg, 'Add a project name.', true); $('#f-name').focus(); return; }
    if (!st.editing && !st.logo) { say(msg, 'Add a logo image.', true); $('#f-logo').focus(); return; }
    const body = { name: $('#f-name').value, location: $('#f-location').value, role: $('#f-role').value, description: $('#f-desc').value, link: $('#f-link').value, flush: $('#f-flush').checked, cap: $('#f-cap').value, size: $('#f-size').value };
    if (!st.editing || st.tileTouched) body.tile = $('#f-tile').value;
    if (st.logo) { body.logo = st.logo.data; body.logoW = st.logo.w; body.logoH = st.logo.h; }
    $('#saveBtn').disabled = true; say(msg, 'Saving\u2026');
    try {
      await api(st.editing ? '/admin/projects/' + st.editing : '/admin/projects', { method: st.editing ? 'PUT' : 'POST', body: JSON.stringify(body) });
      const wasEditing = !!st.editing;
      await refresh(); resetForm();
      say(msg, wasEditing ? 'Changes saved. They are live on your site.' : 'Project added. It is live on your site.');
    } catch (err) { if (!guard(err)) say(msg, err.message, true); }
    $('#saveBtn').disabled = false;
  });

  $('#list').addEventListener('click', async (e) => {
    const b = e.target.closest('button[data-act]'); if (!b) return;
    const id = b.dataset.id, act = b.dataset.act;
    try {
      if (act === 'edit') return edit(id);
      if (act === 'del') {
        const p = st.list.find((x) => x.id === id);
        if (!confirm('Delete "' + p.name + '" from your portfolio? This cannot be undone.')) return;
        await api('/admin/projects/' + id, { method: 'DELETE' }); if (st.editing === id) resetForm();
      } else { await api('/admin/projects/' + id + '/move', { method: 'POST', body: JSON.stringify({ dir: act === 'up' ? -1 : 1 }) }); }
      await refresh();
    } catch (err) { if (!guard(err)) say($('#formMsg'), err.message, true); }
  });

  start();
})();

const statusLabels = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', completed: 'Completed' };
let currentUser = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

// Mujhe aayi hui requests (meri listings par)
async function loadReceived() {
  const box = document.getElementById('received');

  const { data, error } = await supabaseClient
    .from('requests')
    .select('id, message, meeting_note, status, created_at, listings!inner(id, title, seller_id), profiles(full_name, department)')
    .eq('listings.seller_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    box.textContent = 'Could not load requests: ' + error.message;
    return;
  }
  if (data.length === 0) {
    box.innerHTML = '<p class="muted">No one has sent you a request yet.</p>';
    return;
  }

  box.innerHTML = data.map(r => {
    const buyer = r.profiles ? r.profiles.full_name : 'Unknown';
    const dept = r.profiles && r.profiles.department ? ` (${escapeHtml(r.profiles.department)})` : '';
    let actions = '';
    if (r.status === 'pending') {
      actions = `
        <button class="btn btn-small" data-id="${r.id}" data-action="accepted">Accept</button>
        <button class="btn btn-small btn-danger" data-id="${r.id}" data-action="declined">Decline</button>`;
    } else if (r.status === 'accepted') {
      actions = `<button class="btn btn-small" data-id="${r.id}" data-action="completed">Mark as completed</button>`;
    }
    return `
      <div class="req-card">
        <div class="req-head">
          <a href="listing.html?id=${r.listings.id}"><strong>${escapeHtml(r.listings.title)}</strong></a>
          <span class="tag">${statusLabels[r.status]}</span>
        </div>
        <p class="muted">From ${escapeHtml(buyer)}${dept} on ${formatDate(r.created_at)}</p>
        <p>${escapeHtml(r.message)}</p>
        ${r.meeting_note ? `<p class="muted">Suggested meeting: ${escapeHtml(r.meeting_note)}</p>` : ''}
        <div class="req-actions">${actions}</div>
      </div>`;
  }).join('');
}

// Meri bheji hui requests
async function loadSent() {
  const box = document.getElementById('sent');

  const { data, error } = await supabaseClient
    .from('requests')
    .select('id, message, status, created_at, listings(id, title)')
    .eq('buyer_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    box.textContent = 'Could not load requests: ' + error.message;
    return;
  }
  if (data.length === 0) {
    box.innerHTML = '<p class="muted">You have not sent any requests yet.</p>';
    return;
  }

  box.innerHTML = data.map(r => `
    <div class="req-card">
      <div class="req-head">
        <a href="listing.html?id=${r.listings.id}"><strong>${escapeHtml(r.listings.title)}</strong></a>
        <span class="tag">${statusLabels[r.status]}</span>
      </div>
      <p class="muted">Sent on ${formatDate(r.created_at)}</p>
      <p>${escapeHtml(r.message)}</p>
    </div>`).join('');
}

// Accept, Decline aur Completed ke buttons
document.getElementById('received').addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  btn.disabled = true;
  const { error } = await supabaseClient
    .from('requests')
    .update({ status: btn.dataset.action })
    .eq('id', btn.dataset.id);

  if (error) {
    alert('Could not update the request: ' + error.message);
    btn.disabled = false;
    return;
  }
  loadReceived();
});

window.loginCheck.then(user => {
  if (!user) return;
  currentUser = user;
  loadReceived();
  loadSent();
});
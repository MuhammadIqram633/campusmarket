const reasonLabels = {
  scam: 'Scam or fake',
  wrong_information: 'Wrong information',
  inappropriate: 'Inappropriate content',
  copyright: 'Copyrighted material',
  not_study_related: 'Not study related',
  other: 'Other'
};
const statusLabels = { open: 'Open', reviewed: 'Dismissed', action_taken: 'Action taken' };

let filter = 'open';
const box = document.getElementById('reports');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

async function loadReports() {
  box.innerHTML = '<p class="muted">Loading...</p>';

  let q = supabaseClient
    .from('reports')
    .select('id, reason, details, status, created_at, listing_id, listings(id, title, status, profiles(full_name)), profiles(full_name)')
    .order('created_at', { ascending: false });
  if (filter === 'open') q = q.eq('status', 'open');

  const { data, error } = await q;
  if (error) {
    box.textContent = 'Could not load reports: ' + error.message;
    return;
  }
  if (data.length === 0) {
    box.innerHTML = '<p class="muted">No reports here. Everything looks fine.</p>';
    return;
  }

  box.innerHTML = data.map(r => {
    const l = r.listings;
    const hidden = l && l.status === 'hidden';
    const reporter = r.profiles ? r.profiles.full_name : 'Unknown';
    const seller = l && l.profiles ? l.profiles.full_name : 'Unknown';

    let actions = '';
    if (r.status === 'open' && l) {
      if (!hidden) {
        actions += `<button class="btn btn-small btn-danger" data-action="hide" data-report="${r.id}" data-listing="${l.id}">Hide listing</button>`;
      }
      actions += `<button class="btn btn-small btn-grey" data-action="dismiss" data-report="${r.id}" data-listing="${l.id}">Dismiss report</button>`;
    }
    if (hidden) {
      actions += `<button class="btn btn-small" data-action="restore" data-report="${r.id}" data-listing="${l.id}">Restore listing</button>`;
    }

    return `
      <div class="req-card">
        <div class="req-head">
          <strong>${l ? `<a href="listing.html?id=${l.id}">${escapeHtml(l.title)}</a>` : 'Listing removed'}</strong>
          <span class="tag">${statusLabels[r.status]}</span>
        </div>
        <p><strong>Reason:</strong> ${reasonLabels[r.reason] || escapeHtml(r.reason)}</p>
        ${r.details ? `<p>${escapeHtml(r.details)}</p>` : ''}
        <p class="muted">Reported by ${escapeHtml(reporter)} on ${new Date(r.created_at).toLocaleString()}. Seller: ${escapeHtml(seller)}.
          ${hidden ? 'This listing is currently hidden.' : ''}</p>
        <div class="req-actions">${actions}</div>
      </div>`;
  }).join('');
}

document.querySelectorAll('.chip').forEach(chip => chip.addEventListener('click', () => {
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  filter = chip.dataset.filter;
  loadReports();
}));

box.addEventListener('click', async (e) => {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, report, listing } = btn.dataset;

  if (action === 'hide' && !confirm('Hide this listing? The seller will be notified.')) return;

  btn.disabled = true;
  let res;
  if (action === 'hide') {
    res = await supabaseClient.from('listings').update({ status: 'hidden' }).eq('id', listing);
    if (!res.error) {
      res = await supabaseClient.from('reports').update({ status: 'action_taken' })
        .eq('listing_id', listing).eq('status', 'open');
    }
  } else if (action === 'dismiss') {
    res = await supabaseClient.from('reports').update({ status: 'reviewed' }).eq('id', report);
  } else if (action === 'restore') {
    res = await supabaseClient.from('listings').update({ status: 'available' }).eq('id', listing);
  }

  if (res && res.error) {
    alert('Could not complete the action: ' + res.error.message);
    btn.disabled = false;
    return;
  }
  loadReports();
});

window.loginCheck.then(async (user) => {
  if (!user) return;
  const { data } = await supabaseClient.from('profiles').select('role').eq('id', user.id).maybeSingle();
  if (!data || data.role !== 'admin') {
    box.innerHTML = '<p class="muted">This page is only for admins. Redirecting...</p>';
    setTimeout(() => { window.location.href = 'index.html'; }, 1800);
    return;
  }
  loadReports();
});

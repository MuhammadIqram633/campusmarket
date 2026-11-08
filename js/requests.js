const statusLabels = { pending: 'Pending', accepted: 'Accepted', declined: 'Declined', completed: 'Completed' };
const methodLabels = { jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };
let currentUser = null;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function formatDate(value) {
  return new Date(value).toLocaleDateString();
}

// Automatic screenshot jaanch ka natija
function checkHtml(r) {
  if (r.proof_check === 'amount_matched') {
    return `<p class="check check-ok">Automatic check: the amount Rs. ${r.amount} was found in the screenshot.</p>`;
  }
  if (r.proof_check === 'amount_not_found') {
    return `<p class="check check-warn">Automatic check: the amount Rs. ${r.amount} was NOT found in the screenshot. Please verify carefully.</p>`;
  }
  return '<p class="check check-warn">Automatic check: the screenshot could not be read. Please verify manually.</p>';
}

function paymentHtml(r) {
  if (!r.transaction_id) return '';
  return `
    <div class="pay-detail">
      <p><strong>Payment expected:</strong> Rs. ${r.amount} via ${methodLabels[r.payment_method] || '-'}</p>
      <p><strong>Transaction ID:</strong> ${escapeHtml(r.transaction_id)}
        <span class="muted">(unique: not used in any other request)</span></p>
      ${checkHtml(r)}
      ${r.auto_released ? '<p class="muted">The file was released automatically after the amount check.</p>' : ''}
      ${r.disputed ? '<p class="check check-warn">You marked this payment as not received.</p>' : ''}
      <button class="btn btn-small btn-grey proof-btn" data-path="${r.proof_path}" data-id="${r.id}">View payment screenshot</button>
      <div class="proof-area" id="proof-${r.id}"></div>
      <p class="note">The automatic check is only an estimate. Confirm the money in your JazzCash or EasyPaisa app before accepting.</p>
    </div>`;
}

function receivedActions(r) {
  const isPayment = !!r.transaction_id;
  if (r.status === 'pending') {
    if (isPayment) {
      return `
        <button class="btn btn-small" data-id="${r.id}" data-action="accepted">Accept (payment received)</button>
        <button class="btn btn-small btn-danger" data-id="${r.id}" data-action="not_received">Payment not received</button>`;
    }
    return `
      <button class="btn btn-small" data-id="${r.id}" data-action="accepted">Accept</button>
      <button class="btn btn-small btn-danger" data-id="${r.id}" data-action="declined">Decline</button>`;
  }
  if (r.status === 'accepted') {
    return `
      <button class="btn btn-small" data-id="${r.id}" data-action="completed">Mark as completed</button>
      ${isPayment ? `<button class="btn btn-small btn-danger" data-id="${r.id}" data-action="not_received">Payment not received</button>` : ''}`;
  }
  return '';
}

// Mujhe aayi hui requests (meri listings par)
async function loadReceived() {
  const box = document.getElementById('received');

  const { data, error } = await supabaseClient
    .from('requests')
    .select('id, message, meeting_note, status, created_at, transaction_id, proof_path, amount, payment_method, proof_check, auto_released, disputed, listings!inner(id, title, seller_id), profiles(full_name, department)')
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
    return `
      <div class="req-card">
        <div class="req-head">
          <a href="listing.html?id=${r.listings.id}"><strong>${escapeHtml(r.listings.title)}</strong></a>
          <span class="tag">${statusLabels[r.status]}</span>
        </div>
        <p class="muted">From ${escapeHtml(buyer)}${dept} on ${formatDate(r.created_at)}</p>
        ${r.message ? `<p>${escapeHtml(r.message)}</p>` : ''}
        ${r.meeting_note ? `<p class="muted">Suggested meeting: ${escapeHtml(r.meeting_note)}</p>` : ''}
        ${paymentHtml(r)}
        <div class="req-actions">${receivedActions(r)}</div>
      </div>`;
  }).join('');
}

// Meri bheji hui requests
async function loadSent() {
  const box = document.getElementById('sent');

  const { data, error } = await supabaseClient
    .from('requests')
    .select('id, message, status, created_at, transaction_id, amount, disputed, auto_released, listings(id, title)')
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
      ${r.message ? `<p>${escapeHtml(r.message)}</p>` : ''}
      ${r.transaction_id ? `<p class="muted">Payment: Rs. ${r.amount}, Transaction ID ${escapeHtml(r.transaction_id)}</p>` : ''}
      ${r.auto_released && r.status === 'accepted' ? '<p class="muted">Released automatically after the amount check.</p>' : ''}
      ${r.disputed ? '<p class="check check-warn">The seller reported that the payment was not received, so access to the file was removed.</p>' : ''}
    </div>`).join('');
}

// Buttons: Accept, Decline, Completed, Payment not received, aur screenshot dekhna
document.getElementById('received').addEventListener('click', async (e) => {
  // Screenshot dekhna
  const proofBtn = e.target.closest('.proof-btn');
  if (proofBtn) {
    const area = document.getElementById('proof-' + proofBtn.dataset.id);
    if (area.innerHTML) {
      area.innerHTML = '';
      proofBtn.textContent = 'View payment screenshot';
      return;
    }
    proofBtn.disabled = true;
    const { data, error } = await supabaseClient.storage
      .from('payment-proofs')
      .createSignedUrl(proofBtn.dataset.path, 300);
    proofBtn.disabled = false;
    if (error) {
      area.textContent = 'Could not open the screenshot: ' + error.message;
      return;
    }
    area.innerHTML = `<a href="${data.signedUrl}" target="_blank"><img class="proof-img" src="${data.signedUrl}" alt="Payment screenshot"></a>`;
    proofBtn.textContent = 'Hide screenshot';
    return;
  }

  // Status ke buttons
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;

  const action = btn.dataset.action;
  let update;
  if (action === 'not_received') {
    if (!confirm('Mark the payment as not received? The buyer will lose access to the file.')) return;
    update = { status: 'declined', disputed: true };
  } else {
    update = { status: action };
  }

  btn.disabled = true;
  const { error } = await supabaseClient
    .from('requests')
    .update(update)
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
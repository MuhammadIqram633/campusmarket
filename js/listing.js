const conditionLabels = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };
const categoryLabels = { textbook: 'Textbook', lab_equipment: 'Lab equipment' };
const methodLabels = { jazzcash: 'JazzCash', easypaisa: 'EasyPaisa' };
const reasonLabels = {
  scam: 'Scam or fake',
  wrong_information: 'Wrong information',
  inappropriate: 'Inappropriate content',
  copyright: 'Copyrighted material',
  not_study_related: 'Not study related',
  other: 'Other'
};

const scriptCache = {};
function loadScript(src) {
  if (!scriptCache[src]) {
    scriptCache[src] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }
  return scriptCache[src];
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function downloadHtml(label) {
  return `<button class="btn" id="downloadBtn">${label}</button><p class="message" id="dlMsg"></p>`;
}

function attachDownload(filePath) {
  const btn = document.getElementById('downloadBtn');
  const msg = document.getElementById('dlMsg');
  btn.addEventListener('click', async () => {
    msg.textContent = 'Preparing download...';
    const { data, error } = await supabaseClient.storage
      .from('listing-files')
      .createSignedUrl(filePath, 60, { download: true });
    if (error) {
      msg.textContent = 'Could not create the download link: ' + error.message;
      return;
    }
    msg.textContent = '';
    window.location.href = data.signedUrl;
  });
}

async function sha256(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function normalize(text) {
  return String(text || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function levenshtein(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = row[j];
      row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = temp;
    }
  }
  return row[b.length];
}

function fuzzyContains(haystack, needle, maxErrors) {
  if (!needle) return false;
  if (haystack.includes(needle)) return true;
  if (maxErrors === 0) return false;
  for (let len = needle.length - maxErrors; len <= needle.length + maxErrors; len++) {
    for (let i = 0; i + len <= haystack.length; i++) {
      if (levenshtein(haystack.substr(i, len), needle) <= maxErrors) return true;
    }
  }
  return false;
}

async function checkProof(file, listing, account, txn) {
  try {
    await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js');
    const result = await Tesseract.recognize(file, 'eng');
    const raw = result.data.text || '';
    const normalized = normalize(raw);
    if (normalized.length < 15) return { code: 'ocr_failed', found: null };

    const numbers = (raw.replace(/,/g, '').match(/\d+(\.\d+)?/g) || []).map(Number);
    const amount = numbers.includes(Number(listing.price));
    const receiver = raw.replace(/\D/g, '').includes(account.account_number.slice(-4));
    const txnFound = fuzzyContains(normalized, normalize(txn), txn.length >= 10 ? 1 : 0);

    const code = amount && txnFound && receiver
      ? 'verified'
      : `partial:amount=${amount ? 1 : 0},txn=${txnFound ? 1 : 0},receiver=${receiver ? 1 : 0}`;
    return { code, found: { amount, txnFound, receiver } };
  } catch (err) {
    console.error(err);
    return { code: 'ocr_failed', found: null };
  }
}

function pendingMessage(check) {
  if (check.code === 'verified') {
    return 'Payment proof sent. This seller approves payments manually, so the file is released after the seller confirms.';
  }
  if (!check.found) {
    return 'Payment proof sent. We could not read the screenshot, so the seller will check it and release the file.';
  }
  const missing = [];
  if (!check.found.amount) missing.push('the amount');
  if (!check.found.txnFound) missing.push('the Transaction ID');
  if (!check.found.receiver) missing.push("the seller's number");
  return `Payment proof sent. The screenshot did not clearly show ${missing.join(', ')}, so the seller will check it before releasing the file.`;
}

function renderPayBox(section, listing, account, user) {
  section.innerHTML = `
    <div class="pay-box">
      <h3>Buy these notes</h3>
      <ol class="pay-steps">
        <li>Send Rs. ${listing.price} to this ${methodLabels[account.method]} account:
          <div class="pay-info">
            <strong>${escapeHtml(account.account_number)}</strong><br>
            Account name: ${escapeHtml(account.account_name)}
          </div>
        </li>
        <li>Enter the Transaction ID from your payment message.</li>
        <li>Upload your own payment screenshot. It must clearly show the amount, the Transaction ID and the seller's number.</li>
      </ol>
      <input type="text" id="txnId" placeholder="Transaction ID">
      <input type="file" id="proofFile" accept="image/jpeg,image/png,image/webp">
      <textarea id="payNote" rows="2" placeholder="Message to the seller (optional)"></textarea>
      <button class="btn" id="payBtn">Submit payment</button>
      <p class="message" id="payMsg"></p>
      <p class="note">If the screenshot passes all checks and the seller allows automatic release, the download opens at once. Otherwise the seller checks your payment first. A screenshot can be used only once.</p>
    </div>`;

  document.getElementById('payBtn').addEventListener('click', async () => {
    const msg = document.getElementById('payMsg');
    const btn = document.getElementById('payBtn');
    const txn = document.getElementById('txnId').value.trim();
    const file = document.getElementById('proofFile').files[0];
    const note = document.getElementById('payNote').value.trim();

    if (!/^[A-Za-z0-9]{8,}$/.test(txn)) {
      msg.textContent = 'Enter a valid Transaction ID (letters and numbers, at least 8 characters).';
      return;
    }
    if (!file) {
      msg.textContent = 'Please upload the payment screenshot.';
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      msg.textContent = 'The screenshot must be a JPG, PNG or WebP image.';
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      msg.textContent = 'The screenshot is too large (maximum 3 MB).';
      return;
    }

    btn.disabled = true;
    msg.textContent = 'Reading the screenshot (the first time can take up to a minute)...';
    const check = await checkProof(file, listing, account, txn);
    const proofHash = await sha256(file);

    msg.textContent = 'Uploading...';
    const ext = file.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `${user.id}/${listing.id}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabaseClient.storage
      .from('payment-proofs')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      msg.textContent = 'Could not upload the screenshot: ' + uploadError.message;
      btn.disabled = false;
      return;
    }

    const { data: newId, error } = await supabaseClient.rpc('submit_payment_request', {
      p_listing_id: listing.id,
      p_message: note,
      p_meeting_note: null,
      p_transaction_id: txn,
      p_proof_path: path,
      p_proof_check: check.code,
      p_proof_hash: proofHash
    });
    if (error) {
      if (error.message.includes('requests_proof_hash_idx')) {
        msg.textContent = 'This screenshot was already used for another payment. Please upload your own payment screenshot.';
      } else if (error.code === '23505') {
        msg.textContent = 'This Transaction ID was already used.';
      } else {
        msg.textContent = error.message;
      }
      btn.disabled = false;
      return;
    }

    const { data: row } = await supabaseClient
      .from('requests').select('status').eq('id', newId).maybeSingle();

    if (row && row.status === 'accepted') {
      section.innerHTML = '<p class="note">Payment checked and recorded. Your download is ready.</p>'
        + downloadHtml('Download full notes');
      attachDownload(listing.file_path);
    } else {
      section.innerHTML = `<p class="note">${pendingMessage(check)}</p>`;
    }
  });
}

async function renderReportSection(listing, user) {
  const section = document.getElementById('reportSection');
  if (!section) return;

  if (!user || user.id === listing.seller_id) return;

  const { data: existing } = await supabaseClient
    .from('reports').select('id')
    .eq('listing_id', listing.id).eq('reporter_id', user.id).limit(1);
  if (existing && existing.length > 0) {
    section.innerHTML = '<p class="note">You reported this listing. Thank you, an admin will review it.</p>';
    return;
  }

  section.innerHTML = `
    <button class="link-btn" id="reportOpen">Report this listing</button>
    <div class="report-form" id="reportForm" style="display:none">
      <select id="reportReason">
        ${Object.entries(reasonLabels).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
      </select>
      <textarea id="reportDetails" rows="3" placeholder="Tell us what is wrong (optional)"></textarea>
      <button class="btn btn-small btn-danger" id="reportSend">Send report</button>
      <p class="message" id="reportMsg"></p>
    </div>`;

  document.getElementById('reportOpen').addEventListener('click', () => {
    const f = document.getElementById('reportForm');
    f.style.display = f.style.display === 'none' ? 'block' : 'none';
  });

  document.getElementById('reportSend').addEventListener('click', async () => {
    const msg = document.getElementById('reportMsg');
    msg.textContent = 'Sending...';
    const { error } = await supabaseClient.from('reports').insert({
      listing_id: listing.id,
      reporter_id: user.id,
      reason: document.getElementById('reportReason').value,
      details: document.getElementById('reportDetails').value.trim()
    });
    if (error) {
      msg.textContent = error.code === '23505' ? 'You already reported this listing.' : error.message;
      return;
    }
    section.innerHTML = '<p class="note">Report sent. Thank you, an admin will review it.</p>';
  });
}

async function renderRequestSection(listing, user) {
  const section = document.getElementById('requestSection');

  if (!user) {
    section.innerHTML = '<p class="muted" style="margin-top:12px">Please <a href="login.html">login</a> to buy or request these notes.</p>';
    return;
  }

  if (user.id === listing.seller_id) {
    section.innerHTML = '<p class="muted" style="margin-top:12px">This is your listing.</p>'
      + (listing.file_path ? downloadHtml('Download your file') : '');
    if (listing.file_path) attachDownload(listing.file_path);
    return;
  }

  const isPaid = listing.file_path && !listing.exchange_only && listing.price != null;
  const [mineRes, accountRes] = await Promise.all([
    supabaseClient.from('requests').select('status')
      .eq('listing_id', listing.id).eq('buyer_id', user.id),
    isPaid
      ? supabaseClient.from('payment_accounts')
          .select('method, account_number, account_name')
          .eq('user_id', listing.seller_id).maybeSingle()
      : Promise.resolve({ data: null })
  ]);
  const statuses = (mineRes.data || []).map(r => r.status);

  if (statuses.includes('accepted') || statuses.includes('completed')) {
    section.innerHTML = '<p class="note">The seller accepted your request.</p>'
      + (listing.file_path ? downloadHtml('Download full notes') : '');
    if (listing.file_path) attachDownload(listing.file_path);
    return;
  }
  if (statuses.includes('pending')) {
    section.innerHTML = '<p class="note">Your request has been sent. Waiting for the seller to reply.</p>';
    return;
  }
  if (listing.status !== 'available') {
    section.innerHTML = '<p class="muted" style="margin-top:12px">This item is no longer available.</p>';
    return;
  }

  if (isPaid) {
    const account = accountRes.data;
    if (!account) {
      section.innerHTML = '<p class="muted" style="margin-top:12px">The seller has not added a payment account yet, so this item cannot be bought right now.</p>';
      return;
    }
    renderPayBox(section, listing, account, user);
    return;
  }

  const exchangeNote = listing.file_path && listing.exchange_only
    ? '<p class="note">This is an exchange listing. Send a request and agree on the exchange with the seller.</p>'
    : '';
  section.innerHTML = exchangeNote + `
    <div class="request-box">
      <h3>Send a request</h3>
      <textarea id="reqMessage" rows="3" placeholder="Write a short message to the seller"></textarea>
      <input type="text" id="reqMeeting" placeholder="Suggested meeting place or time (optional)">
      <button class="btn" id="reqBtn">Send request</button>
      <p class="message" id="reqMsg"></p>
    </div>`;

  document.getElementById('reqBtn').addEventListener('click', async () => {
    const msg = document.getElementById('reqMsg');
    const message = document.getElementById('reqMessage').value.trim();
    const meeting = document.getElementById('reqMeeting').value.trim();

    if (!message) {
      msg.textContent = 'Please write a short message.';
      return;
    }

    msg.textContent = 'Sending...';
    const { error } = await supabaseClient.from('requests').insert({
      listing_id: listing.id,
      buyer_id: user.id,
      message: message,
      meeting_note: meeting
    });

    if (error) {
      msg.textContent = error.code === '23505'
        ? 'You already have a pending request for this item.'
        : error.message;
      return;
    }
    section.innerHTML = '<p class="note">Your request has been sent. Waiting for the seller to reply.</p>';
  });
}

async function loadListing() {
  const box = document.getElementById('detail');
  const id = new URLSearchParams(window.location.search).get('id');

  if (!id) {
    box.textContent = 'Listing not found.';
    return;
  }

  const [{ data, error }, { data: sess }] = await Promise.all([
    supabaseClient
      .from('listings')
      .select('*, listing_images(image_url, created_at), profiles(full_name, department)')
      .eq('id', id)
      .order('created_at', { referencedTable: 'listing_images', ascending: true })
      .maybeSingle(),
    sessionReady
  ]);
  const user = sess && sess.session ? sess.session.user : null;

  if (error || !data) {
    box.textContent = 'Listing not found.';
    return;
  }

  document.title = data.title + ' - CampusMarket';

  const price = data.exchange_only ? 'Exchange only' : `Rs. ${data.price ?? '-'}`;
  const sellerName = data.profiles ? data.profiles.full_name : 'Unknown';
  const sellerDept = data.profiles && data.profiles.department ? escapeHtml(data.profiles.department) : 'Student';
  const initial = (sellerName || '?').trim().charAt(0).toUpperCase();

  const gallery = data.listing_images.length > 0
    ? data.listing_images.map((img, i) =>
        `<a href="${img.image_url}" target="_blank"><img src="${img.image_url}" alt="Page ${i + 1}" loading="lazy"></a>`
      ).join('')
    : '<p class="muted">No photos or preview pages for this listing.</p>';

  const fileNote = data.file_path
    ? '<p class="note">These are preview pages only. The full notes are released after payment or the seller\'s approval.</p>'
    : '';

  box.innerHTML = `
    <div class="detail-grid">
      <div class="detail-main">
        <h1>${escapeHtml(data.title)}</h1>
        <p class="course muted">${escapeHtml(data.course_code)}</p>
        <p>
          <span class="tag">${conditionLabels[data.condition]}</span>
          <span class="tag">${categoryLabels[data.category]}</span>
        </p>

        <h3 class="section-title">Preview</h3>
        <div class="gallery">${gallery}</div>
        ${fileNote}

        <h3 class="section-title">Description</h3>
        <p>${escapeHtml(data.description).replace(/\n/g, '<br>') || 'No description.'}</p>
      </div>

      <aside class="detail-side">
        <div class="side-card">
          <p class="price big">${price}</p>
          <p class="muted">${data.file_path ? 'Full PDF, released after payment or approval' : 'Meet the seller to exchange'}</p>
          <div id="requestSection"></div>
          <div id="reportSection"></div>
          <div class="seller-box">
            <span class="avatar">${escapeHtml(initial)}</span>
            <div><strong>${escapeHtml(sellerName)}</strong><br><span class="muted">${sellerDept}</span></div>
          </div>
        </div>
      </aside>
    </div>
  `;

  renderRequestSection(data, user);
  renderReportSection(data, user);
}

loadListing();

const conditionLabels = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };
const categoryLabels = { textbook: 'Textbook', lab_equipment: 'Lab equipment' };

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function downloadHtml(label) {
  return `<button class="btn" id="downloadBtn">${label}</button><p class="message" id="dlMsg"></p>`;
}

// 60 second ka temporary link banata hai (storage policy khud check karti hai ke haq hai ya nahi)
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

async function renderRequestSection(listing) {
  const section = document.getElementById('requestSection');
  const { data } = await supabaseClient.auth.getSession();
  const user = data.session ? data.session.user : null;

  if (!user) {
    section.innerHTML = '<p class="muted">Please <a href="login.html">login</a> to send a request to the seller.</p>';
    return;
  }

  // Seller apni file khud download kar sakta hai
  if (user.id === listing.seller_id) {
    section.innerHTML = '<p class="muted">This is your listing.</p>'
      + (listing.file_path ? downloadHtml('Download your file') : '');
    if (listing.file_path) attachDownload(listing.file_path);
    return;
  }

  // Is buyer ki is listing par saari requests
  const { data: mine } = await supabaseClient
    .from('requests')
    .select('status')
    .eq('listing_id', listing.id)
    .eq('buyer_id', user.id);
  const statuses = (mine || []).map(r => r.status);

  // Accept ho chuki ho to download (listing reserved ya sold ho tab bhi)
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
    section.innerHTML = '<p class="muted">This item is no longer available.</p>';
    return;
  }

  section.innerHTML = `
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

  const { data, error } = await supabaseClient
    .from('listings')
    .select('*, listing_images(image_url, created_at), profiles(full_name, department)')
    .eq('id', id)
    .order('created_at', { referencedTable: 'listing_images', ascending: true })
    .maybeSingle();

  if (error || !data) {
    box.textContent = 'Listing not found.';
    return;
  }

  document.title = data.title + ' - CampusMarket';

  const price = data.exchange_only ? 'Exchange only' : `Rs. ${data.price ?? '-'}`;
  const sellerName = data.profiles ? data.profiles.full_name : 'Unknown';
  const sellerDept = data.profiles && data.profiles.department ? ` (${escapeHtml(data.profiles.department)})` : '';

  const gallery = data.listing_images.length > 0
    ? data.listing_images.map((img, i) =>
        `<a href="${img.image_url}" target="_blank"><img src="${img.image_url}" alt="Page ${i + 1}"></a>`
      ).join('')
    : '<p class="muted">No photos or preview pages for this listing.</p>';

  const fileNote = data.file_path
    ? '<p class="note">These are preview pages only. The full notes are released after the seller accepts your request.</p>'
    : '';

  box.innerHTML = `
    <h1>${escapeHtml(data.title)}</h1>
    <p class="course">${escapeHtml(data.course_code)}</p>
    <p>
      <span class="tag">${conditionLabels[data.condition]}</span>
      <span class="tag">${categoryLabels[data.category]}</span>
    </p>
    <p class="price big">${price}</p>

    <h3 class="section-title">Preview</h3>
    <div class="gallery">${gallery}</div>
    ${fileNote}

    <h3 class="section-title">Description</h3>
    <p>${escapeHtml(data.description).replace(/\n/g, '<br>') || 'No description.'}</p>

    <h3 class="section-title">Seller</h3>
    <p>${escapeHtml(sellerName)}${sellerDept}</p>

    <div id="requestSection"></div>
  `;

  renderRequestSection(data);
}

loadListing();
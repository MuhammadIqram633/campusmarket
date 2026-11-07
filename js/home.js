const conditionLabels = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

// Kaun login hai, aur kin listings ki request accept ho chuki hai
async function getUserInfo() {
  const { data: s } = await supabaseClient.auth.getSession();
  if (!s.session) return { userId: null, accepted: new Set() };

  const userId = s.session.user.id;
  const { data } = await supabaseClient
    .from('requests')
    .select('listing_id')
    .eq('buyer_id', userId)
    .in('status', ['accepted', 'completed']);

  return { userId, accepted: new Set((data || []).map(r => r.listing_id)) };
}

function actionHtml(item, user) {
  if (!item.file_path) return '';
  if (!user.userId) {
      const paid = !item.exchange_only && item.price != null;
  const label = paid ? `Buy notes (Rs. ${item.price})` : 'Get notes';
  return `<a class="btn btn-small" href="listing.html?id=${item.id}">${label}</a>`;
  }
  if (item.seller_id === user.userId || user.accepted.has(item.id)) {
    return `<button class="btn btn-small dl-btn" data-path="${item.file_path}">Download notes</button>`;
  }
  return `<a class="btn btn-small" href="listing.html?id=${item.id}">Get notes</a>`;
}

async function loadListings() {
  const grid = document.getElementById('listingGrid');
  const emptyMsg = document.getElementById('emptyMsg');

  const user = await getUserInfo();

  const { data, error } = await supabaseClient
    .from('listings')
    .select('*, listing_images(image_url, created_at)')
    .eq('status', 'available')
    .order('created_at', { ascending: false })
    .order('created_at', { referencedTable: 'listing_images', ascending: true });

  if (error) {
    emptyMsg.textContent = 'Could not load listings: ' + error.message;
    return;
  }
  if (data.length === 0) {
    emptyMsg.textContent = 'No listings yet. Be the first to sell something!';
    return;
  }

  grid.innerHTML = data.map(item => {
    const image = item.listing_images.length > 0
      ? `<img src="${item.listing_images[0].image_url}" alt="">`
      : 'No photo';
    const price = item.exchange_only ? 'Exchange only' : `Rs. ${item.price ?? '-'}`;
    const action = actionHtml(item, user);
    return `
      <article class="card">
        <a class="card-link" href="listing.html?id=${item.id}">
          <div class="card-img">${image}</div>
          <div class="card-body">
            <h3>${escapeHtml(item.title)}</h3>
            <p class="course">${escapeHtml(item.course_code)}</p>
            <span class="tag">${conditionLabels[item.condition]}</span>
            <p class="price">${price}</p>
          </div>
        </a>
        ${action ? `<div class="card-footer">${action}</div>` : ''}
      </article>`;
  }).join('');
}

// Card par Download notes ka button
document.getElementById('listingGrid').addEventListener('click', async (e) => {
  const btn = e.target.closest('.dl-btn');
  if (!btn) return;

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Preparing...';

  const { data, error } = await supabaseClient.storage
    .from('listing-files')
    .createSignedUrl(btn.dataset.path, 60, { download: true });

  btn.disabled = false;
  btn.textContent = original;

  if (error) {
    alert('Could not create the download link: ' + error.message);
    return;
  }
  window.location.href = data.signedUrl;
});

loadListings();
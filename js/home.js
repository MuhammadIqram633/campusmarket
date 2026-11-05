const conditionLabels = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

async function loadListings() {
  const grid = document.getElementById('listingGrid');
  const emptyMsg = document.getElementById('emptyMsg');

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
    return `
      <a class="card-link" href="listing.html?id=${item.id}">
        <article class="card">
          <div class="card-img">${image}</div>
          <div class="card-body">
            <h3>${escapeHtml(item.title)}</h3>
            <p class="course">${escapeHtml(item.course_code)}</p>
            <span class="tag">${conditionLabels[item.condition]}</span>
            <p class="price">${price}</p>
          </div>
        </article>
      </a>`;
  }).join('');
}

loadListings();
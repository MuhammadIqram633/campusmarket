const conditionLabels = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };
const categoryLabels = { textbook: 'Textbook', lab_equipment: 'Lab equipment' };

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
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
  `;
}

loadListing();
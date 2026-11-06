function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

let currentUser = null;
const box = document.getElementById('myListings');

async function loadMyListings() {
  const { data, error } = await supabaseClient
    .from('listings')
    .select('id, title, course_code, price, exchange_only, status')
    .eq('seller_id', currentUser.id)
    .order('created_at', { ascending: false });

  if (error) {
    box.textContent = 'Could not load your listings: ' + error.message;
    return;
  }
  if (data.length === 0) {
    box.innerHTML = '<p class="muted">You have not posted anything yet. <a href="create-listing.html">Sell your first item</a>.</p>';
    return;
  }

  box.innerHTML = data.map(item => {
    const price = item.exchange_only ? 'Exchange only' : `Rs. ${item.price ?? '-'}`;
    // Admin ne hide ki ho to seller status nahi badal sakta
    const statusControl = item.status === 'hidden'
      ? '<span class="tag">Hidden by admin</span>'
      : `<select data-id="${item.id}" class="status-select">
           <option value="available" ${item.status === 'available' ? 'selected' : ''}>Available</option>
           <option value="reserved" ${item.status === 'reserved' ? 'selected' : ''}>Reserved</option>
           <option value="sold" ${item.status === 'sold' ? 'selected' : ''}>Sold</option>
         </select>`;
    return `
      <div class="my-row">
        <div>
          <a href="listing.html?id=${item.id}"><strong>${escapeHtml(item.title)}</strong></a>
          <div class="muted">${escapeHtml(item.course_code)} | ${price}</div>
        </div>
        <div class="my-actions">
          ${statusControl}
          <button class="btn btn-small btn-danger delete-btn" data-id="${item.id}">Delete</button>
        </div>
      </div>`;
  }).join('');
}

// Status badalna
box.addEventListener('change', async (e) => {
  if (!e.target.classList.contains('status-select')) return;
  const { error } = await supabaseClient
    .from('listings')
    .update({ status: e.target.value })
    .eq('id', e.target.dataset.id);
  if (error) alert('Could not update status: ' + error.message);
});

// Delete karna
box.addEventListener('click', async (e) => {
  if (!e.target.classList.contains('delete-btn')) return;
  if (!confirm('Delete this listing? This cannot be undone.')) return;

  const { error } = await supabaseClient
    .from('listings')
    .delete()
    .eq('id', e.target.dataset.id);
  if (error) {
    alert('Could not delete: ' + error.message);
    return;
  }
  loadMyListings();
});

window.loginCheck.then(user => {
  if (!user) return;
  currentUser = user;
  loadMyListings();
});
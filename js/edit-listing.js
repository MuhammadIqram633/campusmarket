const form = document.getElementById('editForm');
const loadMsg = document.getElementById('loadMsg');
const message = document.getElementById('message');
const listingId = new URLSearchParams(window.location.search).get('id');
let currentUser = null;

async function loadListing() {
  if (!listingId) {
    loadMsg.textContent = 'Listing not found.';
    return;
  }

  const { data, error } = await supabaseClient
    .from('listings')
    .select('id, seller_id, title, course_code, category, condition, price, exchange_only, description')
    .eq('id', listingId)
    .maybeSingle();

  if (error || !data) {
    loadMsg.textContent = 'Listing not found.';
    return;
  }
  if (data.seller_id !== currentUser.id) {
    loadMsg.textContent = 'You can edit only your own listings.';
    return;
  }

  document.getElementById('title').value = data.title;
  document.getElementById('courseCode').value = data.course_code || '';
  document.getElementById('category').value = data.category;
  document.getElementById('condition').value = data.condition;
  document.getElementById('price').value = data.price ?? '';
  document.getElementById('exchangeOnly').checked = data.exchange_only;
  document.getElementById('description').value = data.description || '';

  loadMsg.style.display = 'none';
  form.style.display = 'block';
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const exchangeOnly = document.getElementById('exchangeOnly').checked;
  const priceValue = document.getElementById('price').value;

  const changes = {
    title: document.getElementById('title').value.trim(),
    course_code: document.getElementById('courseCode').value.trim().toUpperCase(),
    category: document.getElementById('category').value,
    condition: document.getElementById('condition').value,
    price: exchangeOnly || priceValue === '' ? null : Number(priceValue),
    exchange_only: exchangeOnly,
    description: document.getElementById('description').value.trim()
  };

  message.textContent = 'Saving...';
  const { error } = await supabaseClient
    .from('listings')
    .update(changes)
    .eq('id', listingId)
    .eq('seller_id', currentUser.id);

  if (error) {
    message.textContent = error.message;
    return;
  }

  message.textContent = 'Saved! Redirecting...';
  setTimeout(() => { window.location.href = 'my-listings.html'; }, 1000);
});

window.loginCheck.then(user => {
  if (!user) return;
  currentUser = user;
  loadListing();
});

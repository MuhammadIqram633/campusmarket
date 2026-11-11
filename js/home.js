const conditionLabels = { new: 'New', like_new: 'Like new', good: 'Good', fair: 'Fair' };
const PAGE_SIZE = 12;

let user = { userId: null, accepted: new Set() };
let page = 0;
let loaded = 0;
let requestId = 0;
let pdfOnly = false;

const grid = document.getElementById('listingGrid');
const emptyMsg = document.getElementById('emptyMsg');
const resultInfo = document.getElementById('resultInfo');
const loadMoreBtn = document.getElementById('loadMore');
const searchInput = document.getElementById('searchInput');
const condFilter = document.getElementById('condFilter');
const catFilter = document.getElementById('catFilter');
const minPrice = document.getElementById('minPrice');
const maxPrice = document.getElementById('maxPrice');
const exchFilter = document.getElementById('exchFilter');
const sortSelect = document.getElementById('sortSelect');
const chips = document.querySelectorAll('.chip');

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

// Course code se rang banata hai, taake har card ka placeholder alag nazar aaye
function hueFor(text) {
  let h = 0;
  for (const ch of String(text || 'x')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

function skeletonHtml(n) {
  return Array.from({ length: n }, () => `
    <div class="skeleton-card">
      <div class="sk sk-img"></div>
      <div class="sk sk-line"></div>
      <div class="sk sk-line short"></div>
      <div class="sk sk-line" style="margin-bottom:16px"></div>
    </div>`).join('');
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
  const detail = `listing.html?id=${item.id}`;

  if (!user.userId) {
    return `<a class="btn btn-small" href="login.html">Login to ${item.file_path ? 'get notes' : 'request'}</a>`;
  }

  if (item.file_path) {
    if (item.seller_id === user.userId || user.accepted.has(item.id)) {
      return `<button class="btn btn-small btn-green dl-btn" data-path="${item.file_path}">Download notes</button>`;
    }
    const paid = !item.exchange_only && item.price != null;
    const label = paid ? `Buy notes (Rs. ${item.price})` : 'Get notes';
    return `<a class="btn btn-small" href="${detail}">${label}</a>`;
  }

  if (item.seller_id === user.userId) {
    return `<a class="btn btn-small btn-grey" href="${detail}">View my listing</a>`;
  }
  return `<a class="btn btn-small" href="${detail}">Request item</a>`;
}

function cardHtml(item) {
  const hue = hueFor(item.course_code || item.title);
  const badge = item.file_path ? '<span class="badge-pdf">PDF</span>' : '';
  const media = item.listing_images.length > 0
    ? `<div class="card-img">${badge}<img src="${item.listing_images[0].image_url}" alt="" loading="lazy" decoding="async"></div>`
    : `<div class="card-img placeholder" style="background:linear-gradient(135deg,hsl(${hue} 70% 52%),hsl(${(hue + 40) % 360} 70% 42%))">${badge}<span class="ph-code">${escapeHtml(item.course_code || 'Notes')}</span></div>`;
  const price = item.exchange_only ? 'Exchange only' : `Rs. ${item.price ?? '-'}`;
  const action = actionHtml(item, user);
  return `
    <article class="card">
      <a class="card-link" href="listing.html?id=${item.id}">
        ${media}
        <div class="card-body">
          <h3>${escapeHtml(item.title)}</h3>
          <p class="course">${escapeHtml(item.course_code)}</p>
          <span class="tag">${conditionLabels[item.condition]}</span>
          <p class="price">${price}</p>
        </div>
      </a>
      ${action ? `<div class="card-footer">${action}</div>` : ''}
    </article>`;
}

function hasFilters() {
  return !!(searchInput.value.trim() || condFilter.value || catFilter.value
    || minPrice.value || maxPrice.value || exchFilter.checked || pdfOnly);
}

// Filters ke mutabiq database query banata hai
function buildQuery() {
  let q = supabaseClient
    .from('listings')
    .select('*, listing_images(image_url, created_at)', { count: 'exact' })
    .eq('status', 'available');

  // Search: comma, bracket aur % hata dete hain taake query na toote
  const text = searchInput.value.trim().replace(/[,()%*]/g, ' ').replace(/\s+/g, ' ').trim();
  if (text) {
    q = q.or(`title.ilike.%${text}%,course_code.ilike.%${text}%,description.ilike.%${text}%`);
  }
  if (condFilter.value) q = q.eq('condition', condFilter.value);
  if (catFilter.value) q = q.eq('category', catFilter.value);
  if (minPrice.value !== '') q = q.gte('price', Number(minPrice.value));
  if (maxPrice.value !== '') q = q.lte('price', Number(maxPrice.value));
  if (exchFilter.checked) q = q.eq('exchange_only', true);
  if (pdfOnly) q = q.not('file_path', 'is', null);

  if (sortSelect.value === 'price_asc') {
    q = q.order('price', { ascending: true, nullsFirst: false });
  } else if (sortSelect.value === 'price_desc') {
    q = q.order('price', { ascending: false, nullsFirst: false });
  }
  q = q.order('created_at', { ascending: false });
  q = q.order('created_at', { referencedTable: 'listing_images', ascending: true });
  return q;
}

// Filters ke hisaab se kaun sa chip roshan ho
function syncChips() {
  let active = null;
  if (!condFilter.value && !minPrice.value && !maxPrice.value && !searchInput.value.trim()) {
    if (!catFilter.value && !exchFilter.checked && !pdfOnly) active = 'all';
    else if (catFilter.value === 'textbook' && !exchFilter.checked && !pdfOnly) active = 'textbook';
    else if (catFilter.value === 'lab_equipment' && !exchFilter.checked && !pdfOnly) active = 'lab';
    else if (!catFilter.value && !exchFilter.checked && pdfOnly) active = 'pdf';
    else if (!catFilter.value && exchFilter.checked && !pdfOnly) active = 'exchange';
  }
  chips.forEach(c => c.classList.toggle('active', c.dataset.chip === active));
}

const userReady = getUserInfo().then(u => { user = u; });

async function loadListings(reset) {
  const myId = ++requestId;

  if (reset) {
    page = 0;
    loaded = 0;
    grid.innerHTML = skeletonHtml(6);
    emptyMsg.textContent = '';
    resultInfo.textContent = '';
    loadMoreBtn.style.display = 'none';
    syncChips();
  }

  const from = page * PAGE_SIZE;
  const queryPromise = buildQuery().range(from, from + PAGE_SIZE - 1);
  await userReady;
  const { data, error, count } = await queryPromise;

  if (myId !== requestId) return; // naya search shuru ho chuka hai, purana jawab chhor do

  if (reset) grid.innerHTML = '';

  if (error) {
    emptyMsg.textContent = 'Could not load listings: ' + error.message;
    return;
  }

  if (reset && data.length === 0) {
    emptyMsg.textContent = hasFilters()
      ? 'No listings match your search. Try different words or clear the filters.'
      : 'No listings yet. Be the first to sell something!';
    return;
  }

  grid.insertAdjacentHTML('beforeend', data.map(cardHtml).join(''));
  loaded += data.length;
  page++;
  resultInfo.textContent = `Showing ${loaded} of ${count} listings`;
  loadMoreBtn.style.display = loaded < count ? 'inline-block' : 'none';
}

// Search typing ke 0.35 second baad chalta hai
let timer;
searchInput.addEventListener('input', () => {
  clearTimeout(timer);
  timer = setTimeout(() => loadListings(true), 350);
});
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { clearTimeout(timer); loadListings(true); }
});
document.getElementById('searchBtn').addEventListener('click', () => loadListings(true));

[condFilter, catFilter, sortSelect, exchFilter, minPrice, maxPrice].forEach(el =>
  el.addEventListener('change', () => loadListings(true)));

function resetFilters() {
  searchInput.value = '';
  condFilter.value = '';
  catFilter.value = '';
  minPrice.value = '';
  maxPrice.value = '';
  exchFilter.checked = false;
  sortSelect.value = 'newest';
  pdfOnly = false;
}

document.getElementById('clearBtn').addEventListener('click', () => {
  resetFilters();
  loadListings(true);
});

// Chips: tez filters
chips.forEach(chip => chip.addEventListener('click', () => {
  resetFilters();
  const type = chip.dataset.chip;
  if (type === 'textbook') catFilter.value = 'textbook';
  if (type === 'lab') catFilter.value = 'lab_equipment';
  if (type === 'pdf') pdfOnly = true;
  if (type === 'exchange') exchFilter.checked = true;
  loadListings(true);
}));

loadMoreBtn.addEventListener('click', () => loadListings(false));

// Card par Download notes ka button
grid.addEventListener('click', async (e) => {
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

loadListings(true);
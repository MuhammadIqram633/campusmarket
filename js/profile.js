let currentUser = null;
let profile = null;

const statusEl = document.getElementById('sellerStatus');
const termsBox = document.getElementById('termsBox');
const termsCheck = document.getElementById('termsCheck');
const sellerBtn = document.getElementById('sellerBtn');
const msg = document.getElementById('profileMsg');

function render() {
  document.getElementById('pName').textContent = profile.full_name;
  document.getElementById('pDept').textContent = profile.department || '-';
  document.getElementById('pEmail').textContent = currentUser.email;

  sellerBtn.style.display = 'inline-block';
  if (profile.is_seller) {
    statusEl.textContent = 'Selling is enabled. You can post listings.';
    termsBox.style.display = 'none';
    sellerBtn.textContent = 'Disable selling';
  } else {
    statusEl.textContent = 'You are using CampusMarket as a buyer. Enable selling if you want to post items.';
    termsBox.style.display = 'block';
    sellerBtn.textContent = 'Enable selling';
  }
}

async function loadProfile() {
  const { data, error } = await supabaseClient
    .from('profiles')
    .select('full_name, department, is_seller')
    .eq('id', currentUser.id)
    .maybeSingle();

  if (error || !data) {
    statusEl.textContent = 'Could not load your profile.';
    return;
  }
  profile = data;
  render();
}

sellerBtn.addEventListener('click', async () => {
  msg.textContent = '';
  let update;

  if (profile.is_seller) {
    update = { is_seller: false };
  } else {
    if (!termsCheck.checked) {
      msg.textContent = 'Please accept the selling rules first.';
      return;
    }
    update = { is_seller: true, seller_terms_accepted_at: new Date().toISOString() };
  }

  const { error } = await supabaseClient.from('profiles').update(update).eq('id', currentUser.id);
  if (error) {
    msg.textContent = error.message;
    return;
  }

  profile.is_seller = update.is_seller;
  render();

  // Sell dabane par yahan aaye the to enable hote hi wapas bhej do
  const next = new URLSearchParams(window.location.search).get('next');
  if (profile.is_seller && next === 'sell') {
    window.location.href = 'create-listing.html';
    return;
  }
  msg.textContent = profile.is_seller ? 'Selling enabled.' : 'Selling disabled.';
});

window.loginCheck.then(user => {
  if (!user) return;
  currentUser = user;
  loadProfile();
});
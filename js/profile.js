let currentUser = null;
let profile = null;

const statusEl = document.getElementById('sellerStatus');
const termsBox = document.getElementById('termsBox');
const termsCheck = document.getElementById('termsCheck');
const sellerBtn = document.getElementById('sellerBtn');
const msg = document.getElementById('profileMsg');

const payBox = document.getElementById('paymentBox');
const payMethod = document.getElementById('payMethod');
const payNumber = document.getElementById('payNumber');
const payName = document.getElementById('payName');
const payMsg = document.getElementById('payMsg');

function render() {
  document.getElementById('pName').textContent = profile.full_name;
  document.getElementById('pDept').textContent = profile.department || '-';
  document.getElementById('pEmail').textContent = currentUser.email;

  sellerBtn.style.display = 'inline-block';
  if (profile.is_seller) {
    statusEl.textContent = 'Selling is enabled. You can post listings.';
    termsBox.style.display = 'none';
    sellerBtn.textContent = 'Disable selling';
    payBox.style.display = 'block';
  } else {
    statusEl.textContent = 'You are using CampusMarket as a buyer. Enable selling if you want to post items.';
    termsBox.style.display = 'block';
    sellerBtn.textContent = 'Enable selling';
    payBox.style.display = 'none';
  }
}

async function loadPayment() {
  const { data } = await supabaseClient
    .from('payment_accounts')
    .select('method, account_number, account_name')
    .eq('user_id', currentUser.id)
    .maybeSingle();
  if (data) {
    payMethod.value = data.method;
    payNumber.value = data.account_number;
    payName.value = data.account_name;
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
  loadPayment();
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

  const next = new URLSearchParams(window.location.search).get('next');
  if (profile.is_seller && next === 'sell') {
    window.location.href = 'create-listing.html';
    return;
  }
  msg.textContent = profile.is_seller ? 'Selling enabled.' : 'Selling disabled.';
});

document.getElementById('paySave').addEventListener('click', async () => {
  payMsg.textContent = '';
  const number = payNumber.value.trim();
  const name = payName.value.trim();

  if (!/^03[0-9]{9}$/.test(number)) {
    payMsg.textContent = 'Enter a valid mobile number like 03XXXXXXXXX.';
    return;
  }
  if (name.length < 3) {
    payMsg.textContent = 'Please enter the account name.';
    return;
  }

  payMsg.textContent = 'Saving...';
  const { error } = await supabaseClient.from('payment_accounts').upsert(
    { user_id: currentUser.id, method: payMethod.value, account_number: number, account_name: name },
    { onConflict: 'user_id' }
  );
  payMsg.textContent = error ? error.message : 'Payment account saved.';
});

window.loginCheck.then(user => {
  if (!user) return;
  currentUser = user;
  loadProfile();
});

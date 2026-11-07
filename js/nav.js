// Popup: "Sell karna hai to pehle profile mein enable karein"
function showSellerPopup() {
  if (document.getElementById('sellerPopup')) return;
  const overlay = document.createElement('div');
  overlay.id = 'sellerPopup';
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <h3>Enable selling first</h3>
      <p>You are currently a buyer. To sell your items, enable selling in your profile.</p>
      <div class="modal-actions">
        <a class="btn" href="profile.html?next=sell">Go to profile</a>
        <button class="btn btn-grey" id="popupClose">Not now</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  document.getElementById('popupClose').addEventListener('click', () => overlay.remove());
}

(async () => {
  const ul = document.getElementById('navLinks');
  if (!ul) return;

  let loggedIn = false;
  let isSeller = false;
  try {
    const { data } = await supabaseClient.auth.getSession();
    loggedIn = !!data.session;
    if (loggedIn) {
      const { data: profile } = await supabaseClient
        .from('profiles').select('is_seller').eq('id', data.session.user.id).maybeSingle();
      isSeller = !!(profile && profile.is_seller);
    }
  } catch (err) {
    console.error(err);
  }

  const links = [{ text: 'Home', href: 'index.html' }];

  // Sell: login buyer ko popup, seller ko sell page
  if (loggedIn && !isSeller) {
    links.push({ text: 'Sell', href: '#', popup: true });
  } else {
    links.push({ text: 'Sell', href: 'create-listing.html' });
  }

  if (loggedIn) {
    if (isSeller) links.push({ text: 'My Listings', href: 'my-listings.html' });
    links.push({ text: 'Requests', href: 'requests.html' });
    links.push({ text: 'Profile', href: 'profile.html' });
    links.push({ text: 'Logout', href: '#', logout: true });
  } else {
    links.push({ text: 'Login', href: 'login.html' });
    links.push({ text: 'Register', href: 'register.html' });
  }

  ul.innerHTML = '';
  links.forEach(link => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = link.text;
    a.href = link.href;
    if (link.popup) {
      a.addEventListener('click', (e) => { e.preventDefault(); showSellerPopup(); });
    }
    if (link.logout) {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
      });
    }
    li.appendChild(a);
    ul.appendChild(li);
  });
  ul.style.visibility = 'visible';
})();
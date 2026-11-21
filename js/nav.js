let unreadCount = 0;

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

function showToast(message, link) {
  let box = document.getElementById('toastBox');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toastBox';
    box.className = 'toast-box';
    document.body.appendChild(box);
  }
  const toast = document.createElement('div');
  toast.className = 'toast';

  const text = document.createElement('span');
  text.textContent = message;
  toast.appendChild(text);

  if (link) {
    const a = document.createElement('a');
    a.href = link;
    a.textContent = 'View';
    toast.appendChild(a);
  }

  const close = document.createElement('button');
  close.className = 'toast-close';
  close.textContent = '\u00d7';
  close.addEventListener('click', () => toast.remove());
  toast.appendChild(close);

  box.appendChild(toast);
  setTimeout(() => toast.remove(), 9000);
}

function setBadge(n) {
  unreadCount = n;
  const badge = document.getElementById('notifBadge');
  if (!badge) return;
  badge.textContent = n > 9 ? '9+' : String(n);
  badge.style.display = n > 0 ? 'inline-block' : 'none';
}

async function setupNotifications(userId) {
  async function recount() {
    const { count } = await supabaseClient
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false);
    setBadge(count || 0);
    return count || 0;
  }
  window.refreshNotifBadge = recount;

  const unread = await recount();
  if (unread > 0 && !sessionStorage.getItem('notifShown')) {
    sessionStorage.setItem('notifShown', '1');
    showToast(`You have ${unread} unread notification${unread > 1 ? 's' : ''}.`, 'notifications.html');
  }

  supabaseClient
    .channel('notif-' + userId)
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
      (payload) => {
        showToast(payload.new.message, payload.new.link);
        recount();
        if (window.onNewNotification) window.onNewNotification();
      })
    .subscribe();
}

function buildLinks(state) {
  const links = [{ text: 'Home', href: 'index.html' }];

  if (state.loggedIn && !state.isSeller) {
    links.push({ text: 'Sell', href: '#', popup: true });
  } else {
    links.push({ text: 'Sell', href: 'create-listing.html' });
  }

  if (state.loggedIn) {
    if (state.isSeller) links.push({ text: 'My Listings', href: 'my-listings.html' });
    if (state.isAdmin) links.push({ text: 'Admin', href: 'admin.html' });
    links.push({ text: 'Requests', href: 'requests.html' });
    links.push({ text: 'Alerts', href: 'notifications.html', bell: true });
    links.push({ text: 'Profile', href: 'profile.html' });
    links.push({ text: 'Logout', href: '#', logout: true });
  } else {
    links.push({ text: 'Login', href: 'login.html' });
    links.push({ text: 'Register', href: 'register.html' });
  }
  return links;
}

function renderNav(ul, state) {
  const currentPage = window.location.pathname.split('/').pop() || 'index.html';
  const fragment = document.createDocumentFragment();

  buildLinks(state).forEach(link => {
    const li = document.createElement('li');
    const a = document.createElement('a');
    a.textContent = link.text;
    a.href = link.href;
    if (link.href === currentPage) a.classList.add('active');

    if (link.bell) {
      const badge = document.createElement('span');
      badge.id = 'notifBadge';
      badge.className = 'notif-badge';
      badge.style.display = 'none';
      a.appendChild(badge);
    }
    if (link.popup) {
      a.addEventListener('click', (e) => { e.preventDefault(); showSellerPopup(); });
    }
    if (link.logout) {
      a.addEventListener('click', async (e) => {
        e.preventDefault();
        sessionStorage.clear();
        await supabaseClient.auth.signOut();
        window.location.href = 'index.html';
      });
    }
    li.appendChild(a);
    fragment.appendChild(li);
  });

  ul.replaceChildren(fragment);
  ul.style.visibility = 'visible';
  setBadge(unreadCount);
}

(async () => {
  const ul = document.getElementById('navLinks');
  if (!ul) return;

  let session = null;
  try {
    const { data } = await sessionReady;
    session = data.session;
  } catch (err) {
    console.error(err);
  }

  const userId = session ? session.user.id : null;
  const cacheKey = userId ? 'navFlags:' + userId : null;

  let flags = { isSeller: false, isAdmin: false };
  if (cacheKey) {
    try {
      const cached = JSON.parse(sessionStorage.getItem(cacheKey));
      if (cached) flags = cached;
    } catch (err) {
      sessionStorage.removeItem(cacheKey);
    }
  }

  renderNav(ul, { loggedIn: !!userId, ...flags });
  if (!userId) return;

  setTimeout(() => setupNotifications(userId), 1500);

  try {
    const { data: profile } = await supabaseClient
      .from('profiles').select('is_seller, role').eq('id', userId).maybeSingle();
    const fresh = { isSeller: !!(profile && profile.is_seller), isAdmin: !!(profile && profile.role === 'admin') };
    sessionStorage.setItem(cacheKey, JSON.stringify(fresh));
    if (fresh.isSeller !== flags.isSeller || fresh.isAdmin !== flags.isAdmin) {
      renderNav(ul, { loggedIn: true, ...fresh });
    }
  } catch (err) {
    console.error(err);
  }
})();

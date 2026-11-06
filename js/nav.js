(async () => {
  const ul = document.getElementById('navLinks');
  if (!ul) return;

  let loggedIn = false;
  try {
    const { data } = await supabaseClient.auth.getSession();
    loggedIn = !!data.session;
  } catch (err) {
    console.error(err);
  }

  const links = [
    { text: 'Home', href: 'index.html' },
    { text: 'Sell', href: 'create-listing.html' }
  ];

  if (loggedIn) {
    links.push({ text: 'My Listings', href: 'my-listings.html' });
    links.push({ text: 'Requests', href: 'requests.html' });
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
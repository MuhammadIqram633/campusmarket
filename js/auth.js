async function requireLogin(options = {}) {
  try {
    const { data } = await sessionReady;
    if (!data.session) {
      window.location.replace('login.html');
      return null;
    }

    if (options.seller) {
      const { data: profile } = await supabaseClient
        .from('profiles').select('is_seller').eq('id', data.session.user.id).maybeSingle();
      if (!profile || !profile.is_seller) {
        window.location.replace('profile.html?next=sell');
        return null;
      }
    }

    document.body.style.visibility = 'visible';
    return data.session.user;
  } catch (err) {
    console.error(err);
    document.body.style.visibility = 'visible';
    return null;
  }
}

if (document.body && document.body.dataset.auth) {
  window.loginCheck = requireLogin({ seller: document.body.dataset.auth === 'seller' });
}

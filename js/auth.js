async function requireLogin(options = {}) {
  try {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
      window.location.replace('login.html');
      return null;
    }

    // Sell page ke liye: seller mode enable hona zaroori hai
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
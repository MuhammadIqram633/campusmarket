async function requireLogin() {
  try {
    const { data } = await supabaseClient.auth.getSession();
    if (!data.session) {
      window.location.replace('login.html');
      return null;
    }
    document.body.style.visibility = 'visible';
    return data.session.user;
  } catch (err) {
    console.error(err);
    document.body.style.visibility = 'visible';
    return null;
  }
}
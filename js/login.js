document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('message');
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  message.textContent = 'Logging in...';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
  if (error) {
    message.textContent = error.message;
    return;
  }

  window.location.href = 'index.html';
});
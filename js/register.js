document.getElementById('registerForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('message');
  const fullName = document.getElementById('fullName').value;
  const department = document.getElementById('department').value;
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;

  message.textContent = 'Creating account...';

  const { data, error } = await supabaseClient.auth.signUp({ email, password });
  if (error) {
    message.textContent = error.message;
    return;
  }

  const { error: profileError } = await supabaseClient
    .from('profiles')
    .insert({ id: data.user.id, full_name: fullName, department: department });
  if (profileError) {
    message.textContent = profileError.message;
    return;
  }

  message.textContent = 'Account created! Redirecting to login...';
  setTimeout(() => { window.location.href = 'login.html'; }, 1500);
});
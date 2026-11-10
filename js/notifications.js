function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

async function loadNotifications() {
  const box = document.getElementById('notifList');

  const { data, error } = await supabaseClient
    .from('notifications')
    .select('id, message, link, is_read, created_at')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    box.textContent = 'Could not load notifications: ' + error.message;
    return;
  }
  if (data.length === 0) {
    box.innerHTML = '<p class="muted">No notifications yet. You will see new requests and replies here.</p>';
    return;
  }

  box.innerHTML = data.map(n => `
    <a class="notif-item ${n.is_read ? '' : 'unread'}" href="${n.link ? escapeHtml(n.link) : '#'}">
      <span>${escapeHtml(n.message)}</span>
      <small>${new Date(n.created_at).toLocaleString()}</small>
    </a>`).join('');

  // Page dekh li, to sab ko "read" mark kar do
  const unreadIds = data.filter(n => !n.is_read).map(n => n.id);
  if (unreadIds.length > 0) {
    await supabaseClient.from('notifications').update({ is_read: true }).in('id', unreadIds);
    if (window.refreshNotifBadge) window.refreshNotifBadge();
  }
}

// Page khula ho aur naya notification aaye to list khud refresh ho
window.onNewNotification = loadNotifications;

window.loginCheck.then(user => {
  if (user) loadNotifications();
});
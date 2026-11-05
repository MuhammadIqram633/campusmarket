pdfjsLib.GlobalWorkerOptions.workerSrc =
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentUser = null;
let thumbBlob = null;     // card par dikhne wali choti tasveer
let selectedFile = null;  // asli file (PDF ho to private storage mein jayegi)

// Login check HTML mein pehle hi shuru ho chuka hai
window.loginCheck.then(user => { currentUser = user; });

// PDF ka pehla page tasveer banata hai, image ho to wahi use hoti hai
async function makeThumbnail(file) {
  if (file.type === 'application/pdf') {
    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: 600 / base.width });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.8));
  }
  return file;
}

document.getElementById('fileInput').addEventListener('change', async (e) => {
  const message = document.getElementById('message');
  const preview = document.getElementById('preview');
  const file = e.target.files[0];
  thumbBlob = null;
  selectedFile = null;
  preview.style.display = 'none';
  if (!file) return;

  const isPdf = file.type === 'application/pdf';
  const isImage = ['image/jpeg', 'image/png', 'image/webp'].includes(file.type);
  if (!isPdf && !isImage) {
    message.textContent = 'Only PDF, JPG, PNG or WebP files are allowed.';
    e.target.value = '';
    return;
  }
  const maxMB = isPdf ? 20 : 2;
  if (file.size > maxMB * 1024 * 1024) {
    message.textContent = `File is too large (maximum ${maxMB} MB).`;
    e.target.value = '';
    return;
  }

  selectedFile = file;
  message.textContent = 'Creating preview...';
  try {
    thumbBlob = await makeThumbnail(file);
    preview.src = URL.createObjectURL(thumbBlob);
    preview.style.display = 'block';
    message.textContent = '';
  } catch (err) {
    message.textContent = 'Could not read this file.';
  }
});

document.getElementById('listingForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const message = document.getElementById('message');

  if (!currentUser) {
    message.textContent = 'Please login first.';
    return;
  }

  const exchangeOnly = document.getElementById('exchangeOnly').checked;
  const priceValue = document.getElementById('price').value;

  const listing = {
    seller_id: currentUser.id,
    title: document.getElementById('title').value.trim(),
    course_code: document.getElementById('courseCode').value.trim().toUpperCase(),
    category: document.getElementById('category').value,
    condition: document.getElementById('condition').value,
    price: exchangeOnly || priceValue === '' ? null : Number(priceValue),
    exchange_only: exchangeOnly,
    description: document.getElementById('description').value.trim()
  };

  message.textContent = 'Saving...';

  // 1. Listing ki row banao
  const { data: saved, error } = await supabaseClient
    .from('listings').insert(listing).select().single();
  if (error) {
    message.textContent = error.message;
    return;
  }

  // 2. Thumbnail public storage mein
  if (thumbBlob) {
    const ext = thumbBlob.type.split('/')[1].replace('jpeg', 'jpg');
    const path = `${currentUser.id}/${saved.id}.${ext}`;

    const { error: uploadError } = await supabaseClient.storage
      .from('listing-images')
      .upload(path, thumbBlob, { contentType: thumbBlob.type });
    if (uploadError) {
      message.textContent = 'Listing saved, but image upload failed: ' + uploadError.message;
      return;
    }

    const { data: urlData } = supabaseClient.storage.from('listing-images').getPublicUrl(path);
    const { error: imageError } = await supabaseClient
      .from('listing_images')
      .insert({ listing_id: saved.id, image_url: urlData.publicUrl });
    if (imageError) {
      message.textContent = 'Listing saved, but image record failed: ' + imageError.message;
      return;
    }
  }

  // 3. Asli PDF private storage mein (sirf seller aur approved buyer padh sakega)
  if (selectedFile && selectedFile.type === 'application/pdf') {
    const filePath = `${currentUser.id}/${saved.id}.pdf`;
    const { error: fileError } = await supabaseClient.storage
      .from('listing-files')
      .upload(filePath, selectedFile, { contentType: 'application/pdf' });
    if (fileError) {
      message.textContent = 'Listing saved, but file upload failed: ' + fileError.message;
      return;
    }
    const { error: pathError } = await supabaseClient
      .from('listings').update({ file_path: filePath }).eq('id', saved.id);
    if (pathError) {
      message.textContent = 'Listing saved, but file link failed: ' + pathError.message;
      return;
    }
  }

  message.textContent = 'Listing posted! Redirecting to home...';
  document.getElementById('listingForm').reset();
  document.getElementById('preview').style.display = 'none';
  thumbBlob = null;
  selectedFile = null;
  setTimeout(() => { window.location.href = 'index.html'; }, 1500);
});
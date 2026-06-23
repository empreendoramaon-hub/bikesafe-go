// image-utils.js
// Recebe um File (input de imagem) e devolve um dataURL JPEG comprimido.
export function compressImage(file, maxSize = 800, quality = 0.7) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > height && width > maxSize) {
          height = Math.round(height * maxSize / width);
          width = maxSize;
        } else if (height > maxSize) {
          width = Math.round(width * maxSize / height);
          height = maxSize;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Garante que a foto caiba no limite de ~1MB do documento Firestore.
export async function compressForFirestore(file) {
  let quality = 0.7;
  let dataUrl = await compressImage(file, 800, quality);
  while (dataUrl.length > 700000 && quality > 0.3) {
    quality -= 0.15;
    dataUrl = await compressImage(file, 700, quality);
  }
  return dataUrl;
}

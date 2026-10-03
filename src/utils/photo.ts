export function getPhotoUrl(photoPath?: string | null): string {
  if (!photoPath) return '';
  const trimmed = photoPath.trim();
  if (!trimmed) return '';

  // Google Drive standard file or share link: https://drive.google.com/file/d/FILE_ID/view...
  const driveFileMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
  if (driveFileMatch && driveFileMatch[1]) {
    return `https://drive.google.com/thumbnail?id=${driveFileMatch[1]}&sz=w1000`;
  }

  // Google Drive open or uc links with id parameter: https://drive.google.com/open?id=FILE_ID
  const driveIdParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
  if (
    (trimmed.includes('drive.google.com') || trimmed.includes('docs.google.com')) &&
    driveIdParam &&
    driveIdParam[1]
  ) {
    return `https://drive.google.com/thumbnail?id=${driveIdParam[1]}&sz=w1000`;
  }

  // Google usercontent
  const driveUserContent = trimmed.match(/googleusercontent\.com\/d\/([a-zA-Z0-9_-]+)/);
  if (driveUserContent && driveUserContent[1]) {
    return `https://lh3.googleusercontent.com/d/${driveUserContent[1]}=w1000`;
  }

  // Dropbox share links
  if (trimmed.includes('dropbox.com')) {
    return trimmed.replace(/[?&]dl=0/, '?raw=1').replace(/[?&]dl=1/, '?raw=1');
  }

  if (
    trimmed.startsWith('data:') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://')
  ) {
    return trimmed;
  }

  if (trimmed.startsWith('/')) {
    return trimmed;
  }

  return `/${trimmed}`;
}


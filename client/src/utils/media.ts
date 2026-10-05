export function formatMediaUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('blob:') ||
    trimmed.startsWith('data:')
  ) {
    return trimmed;
  }
  const cleanPath = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  const rawBaseUrl = (import.meta.env.VITE_API_URL || '').trim();
  const baseUrl = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, '') : '';
  return `${baseUrl}${cleanPath}`;
}

export function isAudioMedia(url?: string, type?: string): boolean {
  if (type === 'audio') return true;
  if (!url) return false;
  return /\.(mp3|wav|ogg|m4a|aac|flac|webm|opus)$/i.test(url);
}

export function isImageMedia(url?: string, type?: string): boolean {
  if (type === 'image') return true;
  if (!url) return false;
  return /\.(jpg|jpeg|png|gif|webp|svg|bmp|ico|tiff)$/i.test(url);
}

export function parseMatchPair(str?: string): { left: string; right: string } {
  if (!str) return { left: '', right: '' };
  if (str.includes(':::')) {
    const parts = str.split(':::');
    return { left: parts[0]?.trim() || '', right: parts.slice(1).join(':::').trim() || '' };
  }
  if (str.includes('===')) {
    const parts = str.split('===');
    return { left: parts[0]?.trim() || '', right: parts.slice(1).join('===').trim() || '' };
  }
  if (str.includes(' -> ')) {
    const parts = str.split(' -> ');
    return { left: parts[0]?.trim() || '', right: parts.slice(1).join(' -> ').trim() || '' };
  }
  return { left: str.trim(), right: '' };
}

export function deterministicShuffle<T>(array: T[], seed: number = 1): T[] {
  const result = [...array];
  let s = Math.abs(seed) || 12345;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  if (result.length > 1 && result.every((val, idx) => val === array[idx])) {
    const first = result.shift()!;
    result.push(first);
  }
  return result;
}

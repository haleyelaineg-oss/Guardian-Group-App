import { supabase } from '../../lib/supabase.js';

const BUCKET = 'presentation-assets';
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const SLIDE_EXTENSIONS = new Set([...IMAGE_EXTENSIONS, 'pdf', 'ppt', 'pptx']);
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_COVER_SIZE = 5 * 1024 * 1024;

function extension(file) { return file.name.split('.').pop()?.toLowerCase() || ''; }
export function isPreviewableImage(file) { return IMAGE_EXTENSIONS.has(extension(file)); }

function validateFile(file, category, cover) {
  if (!file) throw new Error('Choose a file to upload.');
  const allowed = category === 'slide' ? SLIDE_EXTENSIONS : IMAGE_EXTENSIONS;
  if (!allowed.has(extension(file))) throw new Error(category === 'slide' ? 'Upload an image, PDF, or PowerPoint file.' : 'Upload a PNG, JPG, WebP, or GIF image.');
  if (!file.size || file.size > MAX_FILE_SIZE) throw new Error('Files must be between 1 byte and 50 MB.');
  if (category === 'slide' && !isPreviewableImage(file)) {
    if (!cover) throw new Error('Choose a cover image so this slide file has a thumbnail.');
    if (!IMAGE_EXTENSIONS.has(extension(cover)) || !cover.size || cover.size > MAX_COVER_SIZE) throw new Error('Cover images must be PNG, JPG, WebP, or GIF and under 5 MB.');
  }
}

export async function fetchPresentationAssets(category) {
  const { data, error } = await supabase.from('presentation_assets').select('*').eq('category', category).order('created_at', { ascending: false });
  if (error) throw error;
  return Promise.all((data || []).map(async (asset) => {
    const path = asset.thumbnail_path || (IMAGE_EXTENSIONS.has(asset.storage_path.split('.').pop()?.toLowerCase()) ? asset.storage_path : null);
    if (!path) return { ...asset, preview_url: null };
    const { data: signed, error: signError } = await supabase.storage.from(BUCKET).createSignedUrl(path, 3600);
    return { ...asset, preview_url: signError ? null : signed.signedUrl };
  }));
}

export async function uploadPresentationAsset({ category, title, description, file, cover }) {
  if (!title?.trim()) throw new Error('Give this asset a name.');
  validateFile(file, category, cover);
  const base = `${category}/${crypto.randomUUID()}`;
  const storagePath = `${base}.${extension(file)}`;
  const thumbnailPath = cover && !isPreviewableImage(file) ? `${base}-cover.${extension(cover)}` : null;
  const uploaded = [];
  try {
    const { error: fileError } = await supabase.storage.from(BUCKET).upload(storagePath, file);
    if (fileError) throw fileError;
    uploaded.push(storagePath);
    if (thumbnailPath) {
      const { error: coverError } = await supabase.storage.from(BUCKET).upload(thumbnailPath, cover);
      if (coverError) throw coverError;
      uploaded.push(thumbnailPath);
    }
    const { error } = await supabase.from('presentation_assets').insert({
      category, title: title.trim(), description: description?.trim() || null,
      file_name: file.name, file_size: file.size, mime_type: file.type || null,
      storage_path: storagePath, thumbnail_path: thumbnailPath,
    });
    if (error) throw error;
  } catch (error) {
    if (uploaded.length) await supabase.storage.from(BUCKET).remove(uploaded);
    throw error;
  }
}

export async function getPresentationAssetUrl(path) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, 300);
  if (error) throw error;
  return data.signedUrl;
}

export async function deletePresentationAsset(asset) {
  const { error } = await supabase.from('presentation_assets').delete().eq('id', asset.id);
  if (error) throw error;
  const { error: storageError } = await supabase.storage.from(BUCKET).remove([asset.storage_path, asset.thumbnail_path].filter(Boolean));
  if (storageError) throw storageError;
}

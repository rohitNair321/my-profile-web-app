'use strict';

const { supabase }       = require('../../../db/supabaseClient');
const ApiResponse        = require('../../../utils/ApiResponse');
const ApiError           = require('../../../utils/ApiError');
const catchAsync         = require('../../../utils/catchAsync');
const { logActivity }    = require('../../../services/activityService');

const BUCKET = process.env.ASSET_BUCKET || 'assets';

// Known root folders, declared as image or doc
const IMAGE_ROOTS = ['avatars', 'posts/covers'];
const DOC_ROOTS   = ['resumes'];

async function flatList(folder, depth = 0) {
  const { data, error } = await supabase.storage.from(BUCKET).list(folder, { limit: 200 });
  if (error || !data) return [];

  const results = [];
  for (const item of data) {
    const fullPath = `${folder}/${item.name}`;

    if (item.id && item.metadata) {
      // It's a file
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fullPath);
      results.push({
        name:        item.name,
        path:        fullPath,
        size:        item.metadata.size ?? 0,
        contentType: item.metadata.mimetype ?? '',
        createdAt:   item.created_at   || null,
        updatedAt:   item.updated_at   || null,
        publicUrl:   urlData.publicUrl,
      });
    } else if (depth < 2) {
      // It's a sub-folder — recurse once more
      const sub = await flatList(fullPath, depth + 1);
      results.push(...sub);
    }
  }
  return results;
}

/**
 * @route   GET /api/v1/storage/files
 * @desc    List all images and documents from the Supabase bucket
 * @access  Admin
 */
/**
 * Collect every storage reference the app holds (profile avatar, resume,
 * post covers/OG images) so bucket files can be flagged as "in use".
 * Each ref is either a full public URL or a bare storage path.
 */
async function collectUsageRefs() {
  const [profileRes, postsRes] = await Promise.all([
    supabase.from('profiles').select('avatar_url, resume_url'),
    supabase.from('posts').select('title, cover_image_url, og_image_url'),
  ]);

  const refs = [];
  for (const p of profileRes.data ?? []) {
    if (p.avatar_url) refs.push({ ref: p.avatar_url, label: 'Profile avatar' });
    if (p.resume_url) refs.push({ ref: p.resume_url, label: 'Resume' });
  }
  for (const post of postsRes.data ?? []) {
    if (post.cover_image_url) refs.push({ ref: post.cover_image_url, label: `Post: ${post.title}` });
    if (post.og_image_url)    refs.push({ ref: post.og_image_url,    label: `Post (OG): ${post.title}` });
  }
  return refs;
}

/** Match a bucket file against usage refs — handles both URL and path refs */
function findUsage(file, refs) {
  const match = refs.find(({ ref }) =>
    ref === file.path || ref.includes(`/${file.path}`) || ref.endsWith(file.path));
  return match ? match.label : null;
}

const listFiles = catchAsync(async (req, res) => {
  const [imageParts, docParts, usageRefs] = await Promise.all([
    Promise.all(IMAGE_ROOTS.map(f => flatList(f))),
    Promise.all(DOC_ROOTS.map(f => flatList(f))),
    collectUsageRefs(),
  ]);

  const withUsage = (f) => {
    const usedBy = findUsage(f, usageRefs);
    return { ...f, inUse: usedBy !== null, usedBy };
  };

  const images = imageParts.flat().filter(f =>
    f.contentType.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg|avif)$/i.test(f.name)
  ).map(withUsage);
  const docs = docParts.flat().filter(f =>
    f.contentType === 'application/pdf' || /\.pdf$/i.test(f.name)
  ).map(withUsage);

  const response = ApiResponse.success(
    { images, docs, totalImages: images.length, totalDocs: docs.length },
    'Files retrieved'
  );
  res.status(response.statusCode).json(response);
});

/**
 * @route   DELETE /api/v1/storage/files
 * @desc    Delete a file by path (query param ?path=...)
 * @access  Admin
 */
const deleteFile = catchAsync(async (req, res) => {
  const { path } = req.query;
  if (!path) throw ApiError.badRequest('File path is required');

  // Safety: only allow deleting from known folders
  const allowed = [...IMAGE_ROOTS, ...DOC_ROOTS];
  const isAllowed = allowed.some(root => path.startsWith(root + '/'));
  if (!isAllowed) throw ApiError.forbidden('Cannot delete files outside allowed folders');

  const { error } = await supabase.storage.from(BUCKET).remove([path]);
  if (error) throw ApiError.internal('Failed to delete file: ' + error.message);

  logActivity({
    userId:    req.user?.id,
    eventType: 'storage_delete',
    entity:    'storage',
    meta:      { path, bucket: BUCKET },
  });

  const response = ApiResponse.success(null, 'File deleted');
  res.status(response.statusCode).json(response);
});

module.exports = { listFiles, deleteFile };

// controllers/profileController.js

const { supabase } = require('../db/supabaseClient');
const { v4: uuidv4 } = require('uuid');
const { logActivity } = require('../services/activityService');
const { resolveOwnerId } = require('../services/tenancy/ownerContext');

const BUCKET = process.env.ASSET_BUCKET || 'assets';
const RESUME_EXPIRY_SECONDS = Number(process.env.RESUME_SIGNED_URL_EXPIRY || 600);

// Profile fields to track for field-level diff logging
const TRACKED_FIELDS = [
  'full_name', 'description', 'short_bio', 'email', 'primary_phone',
  'secondary_phone', 'location', 'website', 'linkedin', 'github',
  'logo_initials', 'currenttheme', 'about_heading', 'about_role',
  'open_to_work', 'skills', 'experiences', 'themes',
];

//#region Helper to parse JSON fields
function parseJsonField(value) {
  if (!value) return undefined;
  if (Array.isArray(value) || typeof value === 'object') {
    return value;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
  }
  return undefined;
}
//#endregion

//#region Helper to upsert profile row upsertProfileRow
async function upsertProfileRow(userId, payload) {
  if (!userId || userId === 'public-portfolio') {
    throw new Error('Invalid user context for profile write');
  }
  payload.updated_at = new Date().toISOString();
  const { data: updated, error: updateError } = await supabase
    .from('profiles')
    .update(payload)
    .eq('id', userId)
    .select()
    .maybeSingle();

  if (updateError) throw updateError;

  if (updated) return updated;

  // If no row existed → insert
  const { data: inserted, error: insertError } = await supabase
    .from('profiles')
    .insert({ id: userId, ...payload })
    .select()
    .single();

  if (insertError) throw insertError;

  return inserted;
}
//#endregion

//#region GET /api/profile/me getMyProfile
async function getMyProfile(req, res) {
  try {
    // Public read: an explicit ?owner= wins (viewing another portfolio, e.g. /u/:id);
    // otherwise the authenticated user's own profile, or the primary owner for guests.
    const userId = req.query.owner || resolveOwnerId({ user: req.user });
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.error('Supabase error fetching profile:', error);
      return res.status(500).json({ message: 'Error fetching profile' });
    }

    if (data) {
      // Calculate projectCount
      const projectCount = (data.experiences || []).reduce((total, exp) => {
        return total + (exp.projects?.length || 0);
      }, 0);

      // Calculate companyCount
      const companyCount = (data.experiences || []).length;

      // Get currentCompany
      const currentCompany = (data.experiences || []).find(exp => exp.present === true)?.company || null;

      // Add computed fields to response
      data.projectCount = projectCount;
      data.companyCount = companyCount;
      data.currentCompany = currentCompany;
    }

    return res.json({ profile: data || null });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: 'Unexpected error' });
  }
}
//#endregion

//#region PUT /api/profile/me updateMyProfile
async function updateMyProfile(req, res) {
  try {
    if (req.user.role === 'public') {
      return res.status(403).json({
        message: 'Public token is read-only. Login required to update profile.'
      });
    }
    const userId = req.user.id;
    const {
      name, full_name, description, email, primaryPhone, primary_phone,
      secondaryPhone, secondary_phone, location, website, linkedin, github,
      openToWork, open_to_work, skills, experiences, logo_initials, currenttheme, themes,
      // About Me editor fields (camelCase keys from FormData)
      heading, shortBio, short_bio, about_role, role: aboutRole, longBio
    } = req.body;

    // Partial-update payload: only include fields that were actually sent with a value.
    // Empty strings and undefined are skipped so existing DB values are never wiped.
    const payload = {};
    // Only update a string field when the value was explicitly sent and non-empty.
    // No HTML escaping here — express-xss-sanitizer already runs on every request.
    const setStr = (key, val) => {
      if (val != null && val !== '') payload[key] = String(val).trim();
    };

    // Core profile fields
    setStr('full_name', full_name || name);
    setStr('description', description || longBio); // longBio = about-me editor alias for description
    setStr('email', email);
    setStr('primary_phone', primaryPhone || primary_phone);
    setStr('secondary_phone', secondaryPhone || secondary_phone);
    setStr('location', location);
    setStr('website', website);
    setStr('linkedin', linkedin);
    setStr('github', github);
    setStr('logo_initials', logo_initials);
    setStr('currenttheme', currenttheme);

    // About Me editor fields
    setStr('about_heading', heading);
    setStr('short_bio', shortBio || short_bio);
    setStr('about_role', about_role || aboutRole);

    // Boolean: only include if the key was present in the request body
    const openRaw = openToWork !== undefined ? openToWork : open_to_work;
    if (openRaw !== undefined) {
      payload.open_to_work = openRaw === 'true' || openRaw === true;
    }

    // Arrays: only update if the field was actually sent
    if (skills !== undefined) {
      const parsed = parseJsonField(skills);
      if (Array.isArray(parsed)) payload.skills = parsed;
    }
    if (experiences !== undefined) {
      const parsed = parseJsonField(experiences);
      if (Array.isArray(parsed)) payload.experiences = parsed;
    }
    if (themes !== undefined) {
      const parsed = parseJsonField(themes);
      if (Array.isArray(parsed)) payload.themes = parsed;
    }

    const files = req.files || {};
    if (files.avatar && files.avatar[0]) {
      const f = files.avatar[0];
      const ext = (f.originalname.split('.').pop() || 'jpg').toLowerCase();

      const avatarPath = `avatars/${userId}/${uuidv4()}.${ext}`;
      const { error: avatarError } = await supabase.storage
        .from(BUCKET)
        .upload(avatarPath, f.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: f.mimetype,
        });

      if (avatarError) throw avatarError;

      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(avatarPath);
      payload.avatar_url = publicData.publicUrl;
    }

    if (files.resume && files.resume[0]) {
      const f = files.resume[0];

      if (f.mimetype !== 'application/pdf' && !f.originalname.toLowerCase().endsWith('.pdf')) {
        return res.status(400).json({ message: 'Resume must be a PDF' });
      }

      const resumePath = `resumes/${userId}/${uuidv4()}.pdf`;

      const { error: resumeError } = await supabase.storage
        .from(BUCKET)
        .upload(resumePath, f.buffer, {
          cacheControl: '3600',
          upsert: true,
          contentType: f.mimetype,
        });

      if (resumeError) throw resumeError;
      const { data: publicData } = supabase.storage.from(BUCKET).getPublicUrl(resumePath);
      payload.resume_url = publicData.publicUrl;
    }

    // Fetch current row before update so we can diff changed fields
    let currentProfile = {};
    try {
      const { data: current } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
      currentProfile = current || {};
    } catch (_) { /* non-fatal */ }

    const saved = await upsertProfileRow(userId, payload);

    // Log each field that actually changed (fire-and-forget)
    const stringify = (v) => v == null ? null : (typeof v === 'object' ? JSON.stringify(v) : String(v));
    for (const field of TRACKED_FIELDS) {
      if (!(field in payload)) continue;
      const oldStr = stringify(currentProfile[field]);
      const newStr = stringify(payload[field]);
      if (oldStr !== newStr) {
        logActivity({ userId, eventType: 'field_update', entity: 'profile', fieldName: field, oldValue: oldStr, newValue: newStr });
      }
    }
    // Log file uploads separately (no content diff — just record the event)
    if (payload.avatar_url) logActivity({ userId, eventType: 'field_update', entity: 'profile', fieldName: 'avatar', newValue: 'uploaded' });
    if (payload.resume_url) logActivity({ userId, eventType: 'field_update', entity: 'profile', fieldName: 'resume', newValue: 'uploaded' });

    // Calculate projectCount
    const projectCount = (saved.experiences || []).reduce((total, exp) => {
      return total + (exp.projects?.length || 0);
    }, 0);

    // Calculate companyCount
    const companyCount = (saved.experiences || []).length;

    // Get currentCompany
    const currentCompany = (saved.experiences || []).find(exp => exp.present === true)?.company || null;

    // Add computed fields to response
    saved.projectCount = projectCount;
    saved.companyCount = companyCount;
    saved.currentCompany = currentCompany;

    return res.json({ profile: saved });
  } catch (err) {
    console.error('updateMyProfile error', err);
    return res.status(500).json({ message: 'Error updating profile', details: err.message || err });
  }
}
//#endregion

//#region GET /api/profile/me/resume downloadResume
async function downloadResume(req, res) {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('resume_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.resume_url) {
      return res.status(404).json({ message: 'No resume available' });
    }

    const { data: signed, error: signedError } = await supabase.storage
      .from(BUCKET)
      .createSignedUrl(data.resume_url, RESUME_EXPIRY_SECONDS);

    if (signedError) throw signedError;

    return res.json({ url: signed.signedURL, expires_in: RESUME_EXPIRY_SECONDS });
  } catch (err) {
    console.error('downloadResume error', err);
    return res.status(500).json({ message: 'Error creating signed url', details: err.message || err });
  }
}
//#endregion

//#region DELETE /api/v1/profile/resume deleteResume
async function deleteResume(req, res) {
  try {
    const userId = req.user.id;

    const { data, error } = await supabase
      .from('profiles')
      .select('resume_url')
      .eq('id', userId)
      .maybeSingle();

    if (error) throw error;
    if (!data || !data.resume_url) {
      return res.status(404).json({ message: 'No resume on file' });
    }

    // Extract the storage object path from the public URL.
    // Public URL format: {SUPABASE_URL}/storage/v1/object/public/{BUCKET}/{path}
    const prefix = `${process.env.SUPABASE_URL}/storage/v1/object/public/${BUCKET}/`;
    const storagePath = data.resume_url.startsWith(prefix)
      ? data.resume_url.slice(prefix.length)
      : null;

    if (storagePath) {
      const { error: delErr } = await supabase.storage.from(BUCKET).remove([storagePath]);
      if (delErr) {
        // Log but don't abort — still clear the DB record
        console.warn('Resume storage delete failed (non-fatal):', delErr.message);
      }
    }

    // Clear resume_url in the profile row
    const saved = await upsertProfileRow(userId, { resume_url: null });

    logActivity({ userId, eventType: 'field_update', entity: 'profile', fieldName: 'resume', oldValue: 'uploaded', newValue: null });

    const projectCount = (saved.experiences || []).reduce((t, e) => t + (e.projects?.length || 0), 0);
    const companyCount = (saved.experiences || []).length;
    const currentCompany = (saved.experiences || []).find(e => e.present)?.company || null;
    saved.projectCount = projectCount;
    saved.companyCount = companyCount;
    saved.currentCompany = currentCompany;

    return res.json({ profile: saved });
  } catch (err) {
    console.error('deleteResume error', err);
    return res.status(500).json({ message: 'Error deleting resume', details: err.message || err });
  }
}
//#endregion

module.exports = {
  getMyProfile,
  updateMyProfile,
  downloadResume,
  deleteResume,
};

// tests/unit/profile/profileController.ownerScoping.test.js
//
// B4 — the public profile GET resolves which owner's profile to return:
//  - explicit ?owner= wins (public view of another portfolio / /u/:id)
//  - else the authenticated user's own id
//  - else the primary owner (PROFILE_OWNER_ID) for guests

let mockCalls;
const mockProfile = { id: 'p', full_name: 'X', experiences: [] };

const mockClient = {
  from() {
    const b = {
      select: () => b,
      eq: (col, val) => { mockCalls.eq.push([col, val]); return b; },
      maybeSingle: () => Promise.resolve({ data: mockProfile, error: null }),
    };
    return b;
  },
};

jest.mock('../../../src/db/supabaseClient', () => ({ supabase: mockClient }));
jest.mock('../../../src/services/activityService', () => ({ logActivity: jest.fn() }));
// `uuid` ships as ESM only — stub it so Jest can load the controller (getMyProfile doesn't use it).
jest.mock('uuid', () => ({ v4: () => 'test-uuid' }));

const { getMyProfile } = require('../../../src/controllers/profileController');

function fakeRes() {
  return { json: jest.fn(), status: jest.fn().mockReturnThis() };
}

beforeEach(() => { mockCalls = { eq: [] }; });

const idQueried = () => mockCalls.eq.find(([c]) => c === 'id')?.[1];

describe('getMyProfile owner resolution', () => {
  it('defaults to PROFILE_OWNER_ID for a guest with no owner param', async () => {
    const res = fakeRes();
    await getMyProfile({ user: { id: process.env.PROFILE_OWNER_ID, role: 'guest' }, query: {} }, res);
    expect(idQueried()).toBe(process.env.PROFILE_OWNER_ID);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ profile: expect.any(Object) }));
  });

  it('honours an explicit ?owner= (public view of another portfolio)', async () => {
    const res = fakeRes();
    await getMyProfile({ user: { id: 'someone', role: 'guest' }, query: { owner: 'owner-X' } }, res);
    expect(idQueried()).toBe('owner-X');
  });

  it('uses the authenticated user id when no owner param is given', async () => {
    const res = fakeRes();
    await getMyProfile({ user: { id: 'u1', role: 'admin' }, query: {} }, res);
    expect(idQueried()).toBe('u1');
  });
});

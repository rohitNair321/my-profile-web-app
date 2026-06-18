// tests/integration/profile.test.js
'use strict';

jest.mock('../../src/config/database', () => ({
  supabase: { from: jest.fn(), storage: { from: jest.fn() } },
  testConnection: jest.fn().mockResolvedValue(true),
}));

const { supabase } = require('../../src/config/database');
const profileController = require('../../src/controllers/profileController');

function mockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json   = jest.fn().mockReturnValue(res);
  return res;
}

function makeChain(data, error = null) {
  return {
    select:     jest.fn().mockReturnThis(),
    eq:         jest.fn().mockReturnThis(),
    update:     jest.fn().mockReturnThis(),
    single:     jest.fn().mockResolvedValue({ data, error }),
    maybeSingle:jest.fn().mockResolvedValue({ data, error }),
    then: (r) => Promise.resolve({ data, error }).then(r),
    catch: (r) => Promise.resolve({ data, error }).catch(r),
  };
}

describe('profileController', () => {

  afterEach(() => jest.clearAllMocks());

  describe('getMyProfile()', () => {
    const fakeProfile = {
      id: 'p-1', full_name: 'Rohit Nair', email: 'rohit@test.com',
      skills: ['Angular', 'Node.js'], experiences: [],
    };

    it('returns 200 with profile data', async () => {
      supabase.from.mockReturnValue(makeChain(fakeProfile));
      const req = { user: { id: 'p-1', role: 'admin' } };
      const res = mockRes();

      await profileController.getMyProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      const body = res.json.mock.calls[0][0];
      expect(body).toHaveProperty('profile');
    });

    it('returns 404 when profile not found', async () => {
      supabase.from.mockReturnValue(makeChain(null, { message: 'not found' }));
      const req = { user: { id: 'unknown', role: 'admin' } };
      const res = mockRes();

      await profileController.getMyProfile(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
    });
  });
});

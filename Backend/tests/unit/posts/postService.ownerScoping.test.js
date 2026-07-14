// tests/unit/posts/postService.ownerScoping.test.js
//
// B4 — verifies the post service scopes reads/writes to the owner:
// create stamps owner_id, and reads apply an owner_id filter when given.

let mockResults = {};   // table -> result for await/single/limit
let mockMaybe = {};     // table -> result for maybeSingle (default: not found)
let mockCalls;

const mockClient = {
  from(table) {
    const b = {
      select: () => b, or: () => b, order: () => b, range: () => b, contains: () => b,
      ilike: () => b, lte: () => b, gte: () => b, is: () => b, in: () => b, delete: () => b,
      eq: (col, val) => { mockCalls.eq.push([table, col, val]); return b; },
      insert: (row) => { mockCalls.insert.push([table, row]); return b; },
      update: (row) => { mockCalls.update.push([table, row]); return b; },
      limit: () => Promise.resolve(mockResults[table] ?? { data: [], error: null }),
      single: () => Promise.resolve(mockResults[table] ?? { data: null, error: null }),
      maybeSingle: () => Promise.resolve(mockMaybe[table] ?? { data: null, error: null }),
      then: (res, rej) => Promise.resolve(mockResults[table] ?? { data: [], error: null, count: 0 }).then(res, rej),
    };
    return b;
  },
  rpc: () => Promise.resolve({ data: null, error: null }),
};

jest.mock('../../../src/db/supabaseClient', () => ({ supabase: mockClient }));
const postService = require('../../../src/services/post.service');

beforeEach(() => { mockResults = {}; mockMaybe = {}; mockCalls = { eq: [], insert: [], update: [] }; });

const hasEq = (table, col, val) => mockCalls.eq.some(([t, c, v]) => t === table && c === col && v === val);

describe('post.service owner scoping', () => {
  it('getAllPublished filters by owner_id when provided', async () => {
    mockResults = { posts: { data: [{ id: 'p1' }], error: null, count: 1 } };
    const res = await postService.getAllPublished({ ownerId: 'owner-1' });
    expect(hasEq('posts', 'owner_id', 'owner-1')).toBe(true);
    expect(res.posts).toHaveLength(1);
  });

  it('getAllAdmin filters by owner_id', async () => {
    mockResults = { posts: { data: [{ id: 'p1' }], error: null, count: 1 } };
    await postService.getAllAdmin({ ownerId: 'owner-9' });
    expect(hasEq('posts', 'owner_id', 'owner-9')).toBe(true);
  });

  it('getBySlug filters by owner_id', async () => {
    mockMaybe = { posts: { data: { id: 'p1', status: 'published' }, error: null } };
    const post = await postService.getBySlug('a-slug', 'owner-2');
    expect(hasEq('posts', 'owner_id', 'owner-2')).toBe(true);
    expect(post.id).toBe('p1');
  });

  it('create stamps owner_id on the inserted post', async () => {
    mockResults = { posts: { data: { id: 'p1', title: 'X', owner_id: 'owner-1' }, error: null } };
    await postService.create({ title: 'X', content: '<p>hello world</p>' }, 'owner-1');
    const insert = mockCalls.insert.find(([t]) => t === 'posts');
    expect(insert).toBeDefined();
    expect(insert[1]).toEqual(expect.objectContaining({ owner_id: 'owner-1', title: 'X' }));
  });

  it('does NOT filter by owner when ownerId is null (public default = all)', async () => {
    mockResults = { posts: { data: [], error: null, count: 0 } };
    await postService.getAllPublished({ ownerId: null });
    expect(mockCalls.eq.some(([, c]) => c === 'owner_id')).toBe(false);
  });
});

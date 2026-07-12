// tests/unit/tasks/taskService.ownerScoping.test.js
//
// B4 — verifies the task service scopes reads/writes to the owner:
// createTask stamps owner_id, and reads apply an owner_id filter.

let mockResults = {};
let mockCalls;

const mockClient = {
  from(table) {
    const result = mockResults[table] ?? { data: [], error: null };
    const b = {
      select: () => b, is: () => b, in: () => b, order: () => b, delete: () => b, update: () => b,
      eq: (col, val) => { mockCalls.eq.push([table, col, val]); return b; },
      insert: (row) => { mockCalls.insert.push([table, row]); return b; },
      limit: () => Promise.resolve(result),
      single: () => Promise.resolve(result),
      maybeSingle: () => Promise.resolve(result),
      then: (res, rej) => Promise.resolve(result).then(res, rej), // thenable for terminal-less awaits
    };
    return b;
  },
};

jest.mock('../../../src/db/supabaseClient', () => ({ supabase: mockClient }));
const taskService = require('../../../src/services/task.service');

beforeEach(() => { mockResults = {}; mockCalls = { eq: [], insert: [] }; });

const hasEq = (table, col, val) => mockCalls.eq.some(([t, c, v]) => t === table && c === col && v === val);

describe('task.service owner scoping', () => {
  it('createTask stamps owner_id on the inserted row', async () => {
    mockResults = { tasks: { data: { id: 'new', title: 'X', owner_id: 'owner-1' }, error: null } };
    await taskService.createTask({ title: 'X' }, 'owner-1');
    expect(mockCalls.insert).toHaveLength(1);
    expect(mockCalls.insert[0][1]).toEqual(expect.objectContaining({ owner_id: 'owner-1', title: 'X' }));
  });

  it('listTasks filters by owner_id', async () => {
    mockResults = {
      tasks: { data: [{ id: 't1', title: 'T', priority: 'med', column: 'todo', owner_id: 'owner-1' }], error: null },
      task_time_logs: { data: [], error: null },
    };
    const tasks = await taskService.listTasks('owner-1');
    expect(hasEq('tasks', 'owner_id', 'owner-1')).toBe(true);
    expect(tasks).toHaveLength(1);
  });

  it('getInProgressAlert filters the running log by owner_id', async () => {
    mockResults = {
      task_time_logs: { data: [{ task_id: 't1', started_at: '2026-07-10T10:00:00Z' }], error: null },
      tasks: { data: { id: 't1', title: 'T', due_date: null }, error: null },
    };
    const alert = await taskService.getInProgressAlert('owner-9');
    expect(hasEq('task_time_logs', 'owner_id', 'owner-9')).toBe(true);
    expect(alert.taskId).toBe('t1');
  });

  it('startTimer inserts a log carrying owner_id', async () => {
    mockResults = {
      tasks: { data: { id: 't1', column: 'prog' }, error: null },
      task_time_logs: { data: [], error: null },
    };
    await taskService.startTimer('t1', 'owner-1');
    const logInsert = mockCalls.insert.find(([t]) => t === 'task_time_logs');
    expect(logInsert).toBeDefined();
    expect(logInsert[1]).toEqual(expect.objectContaining({ owner_id: 'owner-1', task_id: 't1' }));
  });
});

// tests/unit/tasks/taskService.inProgressAlert.test.js
//
// Feature A — GET /api/v1/tasks/in-progress-alert service logic.
// The Supabase client is mocked; `from(table)` resolves to a per-table result.

let mockResultsByTable = {};

const mockSupabase = {
  from(table) {
    const result = mockResultsByTable[table] ?? { data: null, error: null };
    const builder = {
      select: () => builder,
      is:     () => builder,
      eq:     () => builder,
      in:     () => builder,
      order:  () => builder,
      limit:  () => Promise.resolve(result),      // task_time_logs terminal
      single: () => Promise.resolve(result),      // tasks terminal
      maybeSingle: () => Promise.resolve(result),
    };
    return builder;
  },
};

jest.mock('../../../src/db/supabaseClient', () => ({ supabase: mockSupabase }));

const taskService = require('../../../src/services/task.service');

const today = new Date().toISOString().slice(0, 10);
const runningLog = [{ task_id: 't1', started_at: '2026-07-10T10:00:00.000Z' }];

afterEach(() => { mockResultsByTable = {}; });

describe('taskService.getInProgressAlert', () => {
  it('returns null when no timer is running', async () => {
    mockResultsByTable = { task_time_logs: { data: [], error: null } };
    await expect(taskService.getInProgressAlert('owner-1')).resolves.toBeNull();
  });

  it('returns an in_progress alert for a running task with no due date', async () => {
    mockResultsByTable = {
      task_time_logs: { data: runningLog, error: null },
      tasks: { data: { id: 't1', title: 'Refactor auth', due_date: null }, error: null },
    };
    const alert = await taskService.getInProgressAlert('owner-1');
    expect(alert).toEqual(expect.objectContaining({
      taskId: 't1', title: 'Refactor auth', dueDate: null,
      status: 'in_progress', overdue: false,
    }));
    expect(alert.startedAt).toBe(new Date('2026-07-10T10:00:00.000Z').getTime());
  });

  it('flags overdue when the due date is in the past', async () => {
    mockResultsByTable = {
      task_time_logs: { data: runningLog, error: null },
      tasks: { data: { id: 't1', title: 'Ship it', due_date: '2020-01-01' }, error: null },
    };
    const alert = await taskService.getInProgressAlert('owner-1');
    expect(alert.overdue).toBe(true);
    expect(alert.status).toBe('overdue');
  });

  it('a task due TODAY is not yet overdue', async () => {
    mockResultsByTable = {
      task_time_logs: { data: runningLog, error: null },
      tasks: { data: { id: 't1', title: 'Due today', due_date: today }, error: null },
    };
    const alert = await taskService.getInProgressAlert('owner-1');
    expect(alert.overdue).toBe(false);
    expect(alert.status).toBe('in_progress');
  });

  it('returns null if the running log points to a missing task', async () => {
    mockResultsByTable = {
      task_time_logs: { data: runningLog, error: null },
      tasks: { data: null, error: { message: 'not found' } },
    };
    await expect(taskService.getInProgressAlert('owner-1')).resolves.toBeNull();
  });
});

// tests/unit/access/accessService.test.js
const { createAccessService } = require('../../../src/services/access/accessService');
const { ROLES } = require('../../../src/services/access/accessPolicy');

const SUPER = { id: 'super-1', role: ROLES.SUPER_ADMIN };

function makeRepo(overrides = {}) {
  return {
    findByEmail: jest.fn().mockResolvedValue(null),
    getById: jest.fn().mockResolvedValue({ id: 'u1', role: ROLES.USER }),
    createUser: jest.fn(async ({ email, role }) => ({
      id: 'new-id', email, role, is_active: true, created_at: '2026-07-12T00:00:00Z',
    })),
    listUsers: jest.fn().mockResolvedValue([]),
    getGrantedKeys: jest.fn().mockResolvedValue([]),
    getGrantedKeysForUsers: jest.fn().mockResolvedValue({}),
    replaceGrants: jest.fn(async (_id, keys) => keys),
    setActive: jest.fn(async (id, isActive) => ({ id, is_active: isActive })),
    setAppConfig: jest.fn(async (id, cfg) => ({ id, app_config: cfg })),
    ...overrides,
  };
}

function makeMail(overrides = {}) {
  return { sendNewUserCredentials: jest.fn().mockResolvedValue(undefined), ...overrides };
}

function build(repo, mail, extra = {}) {
  return createAccessService({
    repository: repo,
    mailService: mail,
    passwordGenerator: () => 'TEMP-PASS-123',
    hashPassword: async () => 'HASHED',
    ...extra,
  });
}

describe('accessService.provisionUser', () => {
  it('generates + hashes a password, creates the user, grants pages, emails, and returns the temp password once', async () => {
    const repo = makeRepo();
    const mail = makeMail();
    const svc = build(repo, mail);

    const res = await svc.provisionUser({
      email: 'New.User@Example.com',
      role: ROLES.USER,
      pages: ['planner'],
      actor: SUPER,
    });

    // Email normalized; password hashed (never the plaintext) into the row
    expect(repo.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'new.user@example.com', role: ROLES.USER, passwordHash: 'HASHED' })
    );
    expect(repo.replaceGrants).toHaveBeenCalledWith('new-id', ['planner'], SUPER.id);
    expect(mail.sendNewUserCredentials).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'new.user@example.com', tempPassword: 'TEMP-PASS-123' })
    );

    expect(res.tempPassword).toBe('TEMP-PASS-123');
    expect(res.user).toEqual(expect.objectContaining({ id: 'new-id', pages: ['planner'] }));
  });

  it('rejects an invalid email', async () => {
    const svc = build(makeRepo(), makeMail());
    await expect(svc.provisionUser({ email: 'not-an-email', actor: SUPER }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a non-assignable role (e.g. superadmin)', async () => {
    const svc = build(makeRepo(), makeMail());
    await expect(svc.provisionUser({ email: 'a@b.com', role: 'superadmin', actor: SUPER }))
      .rejects.toMatchObject({ statusCode: 400 });
  });

  it('rejects a duplicate email with 409', async () => {
    const repo = makeRepo({ findByEmail: jest.fn().mockResolvedValue({ id: 'existing' }) });
    const svc = build(repo, makeMail());
    await expect(svc.provisionUser({ email: 'dupe@b.com', actor: SUPER }))
      .rejects.toMatchObject({ statusCode: 409 });
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it('blocks an admin from granting a page they do not hold', async () => {
    const admin = { id: 'admin-1', role: ROLES.ADMIN };
    const repo = makeRepo({ getGrantedKeys: jest.fn().mockResolvedValue(['planner']) });
    const svc = build(repo, makeMail());
    await expect(svc.provisionUser({ email: 'x@y.com', pages: ['analytics'], actor: admin }))
      .rejects.toMatchObject({ statusCode: 400 });
    expect(repo.createUser).not.toHaveBeenCalled();
  });

  it('still succeeds (and returns the temp password) if the email send fails', async () => {
    const repo = makeRepo();
    const mail = makeMail({ sendNewUserCredentials: jest.fn().mockRejectedValue(new Error('smtp down')) });
    const svc = build(repo, mail);

    const res = await svc.provisionUser({ email: 'x@y.com', pages: [], actor: SUPER });
    expect(res.tempPassword).toBe('TEMP-PASS-123');
    expect(repo.createUser).toHaveBeenCalled();
  });
});

describe('accessService.updateAccess', () => {
  it('validates the grant, ensures the user exists, then replaces grants', async () => {
    const repo = makeRepo();
    const svc = build(repo, makeMail());
    const res = await svc.updateAccess({ userId: 'u1', pages: ['planner', 'analytics'], actor: SUPER });
    expect(repo.getById).toHaveBeenCalledWith('u1');
    expect(repo.replaceGrants).toHaveBeenCalledWith('u1', ['planner', 'analytics'], SUPER.id);
    expect(res).toEqual({ userId: 'u1', pages: ['planner', 'analytics'] });
  });
});

describe('accessService.updateUserConfig', () => {
  it('persists only whitelisted boolean flags and drops unknown/non-boolean keys', async () => {
    const repo = makeRepo();
    const svc = build(repo, makeMail());
    await svc.updateUserConfig({
      userId: 'u1',
      config: { showNotifications: false, showAgentChat: true, hackerFlag: true, showSidebarToggle: 'yes' },
    });
    expect(repo.getById).toHaveBeenCalledWith('u1');
    expect(repo.setAppConfig).toHaveBeenCalledWith('u1', { showNotifications: false, showAgentChat: true });
  });

  it('404s when the user does not exist', async () => {
    const repo = makeRepo({ getById: jest.fn().mockRejectedValue(Object.assign(new Error('nf'), { statusCode: 404 })) });
    const svc = build(repo, makeMail());
    await expect(svc.updateUserConfig({ userId: 'nope', config: {} }))
      .rejects.toMatchObject({ statusCode: 404 });
    expect(repo.setAppConfig).not.toHaveBeenCalled();
  });
});

describe('accessService.myAccess', () => {
  it('returns all page keys for a super admin without hitting the grants table', async () => {
    const repo = makeRepo();
    const svc = build(repo, makeMail());
    const res = await svc.myAccess(SUPER);
    expect(repo.getGrantedKeys).not.toHaveBeenCalled();
    expect(res.role).toBe(ROLES.SUPER_ADMIN);
    expect(res.pages).toContain('access');
  });

  it('returns only granted keys for a normal user', async () => {
    const repo = makeRepo({ getGrantedKeys: jest.fn().mockResolvedValue(['planner']) });
    const svc = build(repo, makeMail());
    const res = await svc.myAccess({ id: 'u1', role: ROLES.USER });
    expect(res.pages).toEqual(['planner']);
  });
});

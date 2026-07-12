'use strict';

const { defaultAccessService } = require('../../../services/access/accessService');
const ApiResponse = require('../../../utils/ApiResponse');
const catchAsync = require('../../../utils/catchAsync');

/**
 * Access controller — thin HTTP adapter. All business rules live in the
 * injected access service; controllers only translate req/res.
 */

/** GET /api/v1/access/pages */
const listPages = catchAsync(async (req, res) => {
  const pages = defaultAccessService.listGrantablePages();
  res.json(new ApiResponse(200, pages, 'Grantable pages retrieved'));
});

/** GET /api/v1/access/my-pages */
const myPages = catchAsync(async (req, res) => {
  const access = await defaultAccessService.myAccess(req.user);
  res.json(new ApiResponse(200, access, 'Access retrieved'));
});

/** GET /api/v1/access/users */
const listUsers = catchAsync(async (req, res) => {
  const users = await defaultAccessService.listUsers();
  res.json(new ApiResponse(200, users, 'Users retrieved'));
});

/** POST /api/v1/access/users */
const createUser = catchAsync(async (req, res) => {
  const { email, role, pages } = req.body ?? {};
  const result = await defaultAccessService.provisionUser({
    email,
    role,
    pages: Array.isArray(pages) ? pages : [],
    actor: req.user,
  });
  // `tempPassword` is returned ONCE for the super admin to relay/verify.
  res.status(201).json(new ApiResponse(201, result, 'User provisioned'));
});

/** PATCH /api/v1/access/users/:id/access */
const updateAccess = catchAsync(async (req, res) => {
  const { pages } = req.body ?? {};
  const result = await defaultAccessService.updateAccess({
    userId: req.params.id,
    pages: Array.isArray(pages) ? pages : [],
    actor: req.user,
  });
  res.json(new ApiResponse(200, result, 'Access updated'));
});

/** PATCH /api/v1/access/users/:id/status */
const setStatus = catchAsync(async (req, res) => {
  const user = await defaultAccessService.setUserActive({
    userId: req.params.id,
    isActive: !!req.body?.isActive,
  });
  res.json(new ApiResponse(200, user, 'User status updated'));
});

module.exports = { listPages, myPages, listUsers, createUser, updateAccess, setStatus };

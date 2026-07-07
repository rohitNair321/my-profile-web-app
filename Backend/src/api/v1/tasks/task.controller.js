// api/v1/tasks/task.controller.js
'use strict';

const taskService = require('../../../services/task.service');
const ApiResponse = require('../../../utils/ApiResponse');
const ApiError    = require('../../../utils/ApiError');
const catchAsync  = require('../../../utils/catchAsync');

/** GET /api/v1/tasks */
const list = catchAsync(async (req, res) => {
  const tasks = await taskService.listTasks();
  res.json(new ApiResponse(200, tasks, 'Tasks retrieved'));
});

/** GET /api/v1/tasks/timer/active */
const activeTimer = catchAsync(async (req, res) => {
  const active = await taskService.getActiveTimer();
  res.json(new ApiResponse(200, active, 'Active timer retrieved'));
});

/** GET /api/v1/tasks/:id */
const getOne = catchAsync(async (req, res) => {
  const task = await taskService.getTask(req.params.id);
  res.json(new ApiResponse(200, task, 'Task retrieved'));
});

/** POST /api/v1/tasks */
const create = catchAsync(async (req, res) => {
  if (!req.body?.title) throw ApiError.badRequest('title is required');
  const task = await taskService.createTask(req.body);
  res.status(201).json(new ApiResponse(201, task, 'Task created'));
});

/** PATCH /api/v1/tasks/:id */
const update = catchAsync(async (req, res) => {
  const task = await taskService.updateTask(req.params.id, req.body ?? {});
  res.json(new ApiResponse(200, task, 'Task updated'));
});

/** DELETE /api/v1/tasks/:id */
const remove = catchAsync(async (req, res) => {
  await taskService.deleteTask(req.params.id);
  res.json(new ApiResponse(200, null, 'Task deleted'));
});

/** PATCH /api/v1/tasks/:id/move — { column, position? } */
const move = catchAsync(async (req, res) => {
  const { column, position } = req.body ?? {};
  if (!column) throw ApiError.badRequest('column is required');
  const task = await taskService.moveTask(req.params.id, column, position);
  res.json(new ApiResponse(200, task, 'Task moved'));
});

/** POST /api/v1/tasks/:id/timer/start */
const startTimer = catchAsync(async (req, res) => {
  const result = await taskService.startTimer(req.params.id);
  res.json(new ApiResponse(200, result, 'Timer started'));
});

/** POST /api/v1/tasks/:id/timer/stop */
const stopTimer = catchAsync(async (req, res) => {
  const task = await taskService.stopTimer(req.params.id);
  res.json(new ApiResponse(200, task, 'Timer stopped'));
});

/** DELETE /api/v1/tasks/:id/logs/:logId — correction path */
const deleteLog = catchAsync(async (req, res) => {
  const task = await taskService.deleteLog(req.params.id, req.params.logId);
  res.json(new ApiResponse(200, task, 'Time log deleted'));
});

module.exports = {
  list,
  getOne,
  create,
  update,
  remove,
  move,
  startTimer,
  stopTimer,
  activeTimer,
  deleteLog,
};

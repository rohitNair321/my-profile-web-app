// api/v1/tasks/task.routes.js
'use strict';

const express = require('express');
const router  = express.Router();

const { verifyToken, requireAdmin } = require('../../../middleware/authVerify');
const taskController = require('./task.controller');

/**
 * @swagger
 * tags:
 *   - name: Tasks
 *     description: Admin planner — Kanban tasks with time tracking
 */

// All planner routes are admin-only
router.use(verifyToken, requireAdmin);

/**
 * @swagger
 * /api/v1/tasks:
 *   get:
 *     summary: List all tasks with time logs (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     responses:
 *       200: { description: Task list }
 */
router.get('/', taskController.list);

/**
 * @swagger
 * /api/v1/tasks/timer/active:
 *   get:
 *     summary: Get the currently running timer, if any (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     responses:
 *       200: { description: "{ taskId, startedAt } or null" }
 */
router.get('/timer/active', taskController.activeTimer);

/**
 * @swagger
 * /api/v1/tasks:
 *   post:
 *     summary: Create a task (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:       { type: string, maxLength: 200 }
 *               description: { type: string, maxLength: 5000 }
 *               priority:    { type: string, enum: [low, med, high] }
 *               dueDate:     { type: string, format: date, nullable: true }
 *               tags:        { type: array, items: { type: string } }
 *               column:      { type: string, enum: [todo, prog, done] }
 *               estimateMin: { type: integer, nullable: true }
 *     responses:
 *       201: { description: Task created }
 */
router.post('/', taskController.create);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   get:
 *     summary: Get a single task with full logs (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Task }
 *       404: { description: Not found }
 */
router.get('/:id', taskController.getOne);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   patch:
 *     summary: Update task fields (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated task }
 */
router.patch('/:id', taskController.update);

/**
 * @swagger
 * /api/v1/tasks/{id}:
 *   delete:
 *     summary: Delete a task (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Deleted }
 */
router.delete('/:id', taskController.remove);

/**
 * @swagger
 * /api/v1/tasks/{id}/move:
 *   patch:
 *     summary: Move a task to a column (drag & drop) (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [column]
 *             properties:
 *               column:   { type: string, enum: [todo, prog, done] }
 *               position: { type: integer }
 *     responses:
 *       200: { description: Moved task (running timer auto-stopped when moved to done) }
 */
router.patch('/:id/move', taskController.move);

/**
 * @swagger
 * /api/v1/tasks/{id}/timer/start:
 *   post:
 *     summary: Start the task timer — auto-stops any other running timer (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: "{ task, autoStopped: taskId | null }" }
 *       409: { description: ALREADY_RUNNING }
 */
router.post('/:id/timer/start', taskController.startTimer);

/**
 * @swagger
 * /api/v1/tasks/{id}/timer/stop:
 *   post:
 *     summary: Stop the task timer (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated task }
 *       409: { description: NOT_RUNNING }
 */
router.post('/:id/timer/stop', taskController.stopTimer);

/**
 * @swagger
 * /api/v1/tasks/{id}/logs/{logId}:
 *   delete:
 *     summary: Delete a time log entry (correction path) (admin only)
 *     tags: [Tasks]
 *     security: [{ bearerAuth: [] }, { cookieAuth: [] }]
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string, format: uuid } }
 *       - { in: path, name: logId, required: true, schema: { type: string, format: uuid } }
 *     responses:
 *       200: { description: Updated task }
 */
router.delete('/:id/logs/:logId', taskController.deleteLog);

module.exports = router;

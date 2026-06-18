// utils/catchAsync.js

/**
 * Wrapper for async route handlers
 * Catches errors and passes them to error handling middleware
 * 
 * Usage:
 * router.get('/route', catchAsync(async (req, res) => {
 *   // Your async code here
 * }));
 */
const catchAsync = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = catchAsync;

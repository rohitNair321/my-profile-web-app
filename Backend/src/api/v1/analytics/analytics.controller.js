// api/v1/analytics/analytics.controller.js
const analyticsService = require('../../../services/analyticsService');
const ApiResponse = require('../../../utils/ApiResponse');
const catchAsync = require('../../../utils/catchAsync');

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get complete analytics dashboard data
 * @access  Private (Admin only)
 */
const getDashboard = catchAsync(async (req, res) => {
  const { startDate = '7daysAgo', endDate = 'today' } = req.query;

  const data = await analyticsService.getDashboardData(startDate, endDate);

  const response = ApiResponse.success(
    data,
    'Analytics dashboard data retrieved successfully'
  );

  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/analytics/pageviews
 * @desc    Get page views data
 * @access  Private (Admin only)
 */
const getPageViews = catchAsync(async (req, res) => {
  const { startDate = '7daysAgo', endDate = 'today' } = req.query;

  const data = await analyticsService.getPageViews(startDate, endDate);

  const response = ApiResponse.success(data, 'Page views data retrieved');
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/analytics/visitors
 * @desc    Get visitor statistics
 * @access  Private (Admin only)
 */
const getVisitorStats = catchAsync(async (req, res) => {
  const { startDate = '7daysAgo', endDate = 'today' } = req.query;

  const data = await analyticsService.getVisitorStats(startDate, endDate);

  const response = ApiResponse.success(data, 'Visitor stats retrieved');
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/analytics/geographic
 * @desc    Get geographic data
 * @access  Private (Admin only)
 */
const getGeographic = catchAsync(async (req, res) => {
  const { startDate = '7daysAgo', endDate = 'today' } = req.query;

  const data = await analyticsService.getGeographicData(startDate, endDate);

  const response = ApiResponse.success(data, 'Geographic data retrieved');
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/analytics/devices
 * @desc    Get device types data
 * @access  Private (Admin only)
 */
const getDevices = catchAsync(async (req, res) => {
  const { startDate = '7daysAgo', endDate = 'today' } = req.query;

  const data = await analyticsService.getDeviceData(startDate, endDate);

  const response = ApiResponse.success(data, 'Device data retrieved');
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/analytics/traffic
 * @desc    Get traffic sources
 * @access  Private (Admin only)
 */
const getTraffic = catchAsync(async (req, res) => {
  const { startDate = '7daysAgo', endDate = 'today' } = req.query;

  const data = await analyticsService.getTrafficSources(startDate, endDate);

  const response = ApiResponse.success(data, 'Traffic sources retrieved');
  res.status(response.statusCode).json(response);
});

/**
 * @route   GET /api/v1/analytics/pages
 * @desc    Get top pages
 * @access  Private (Admin only)
 */
const getTopPages = catchAsync(async (req, res) => {
  const { startDate = '7daysAgo', endDate = 'today' } = req.query;

  const data = await analyticsService.getTopPages(startDate, endDate);

  const response = ApiResponse.success(data, 'Top pages retrieved');
  res.status(response.statusCode).json(response);
});

module.exports = {
  getDashboard,
  getPageViews,
  getVisitorStats,
  getGeographic,
  getDevices,
  getTraffic,
  getTopPages,
};

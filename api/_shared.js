// ========================================================
// Bre v3.0 - Shared Core Hub
// Refactored & Modularized
// ========================================================

const {
  CONFIG_PATH,
  TMP_CONFIG_PATH,
  DEFAULT_CONFIG,
  parseKeys,
  getConfig,
  syncCloudConfig,
  saveConfig,
  persistConfig,
  testUpstash,
  testGitHub,
  getCloudStorageInfo,
  fetchAvailableModels,
  testSingleModel,
  redactConfigForExport
} = require('../services/shared/configStore');

const {
  hashAdminPassword,
  verifyAdminPassword,
  checkClientAuth,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  checkChatRateLimit,
  consumeChatRate
} = require('../services/shared/auth');

const {
  STYLE_LABELS,
  STYLE_PROMPTS,
  LANGUAGE_OPTIONS,
  sanitizeOutput,
  sanitizeErrorMessage,
  buildBreAISystemPrompt
} = require('../services/shared/prompt');

const {
  MODEL_PRICING,
  calculateCost,
  logRequest,
  getLogs,
  clearLogs,
  getMetrics,
  getRouterOverview,
  getRouterDetails,
  checkBlacklist,
  getCachedResponse,
  setCachedResponse,
  clearResponseCache,
  logAdminAction,
  getAuditLogs,
  clearAuditLogs
} = require('../services/shared/telemetry');

const { BoundedMap } = require('../services/shared/boundedMap');

// Global round-robin rotation counter for AUTO mode
let roundRobinIndex = 0;
function getNextRoundRobinIndex(length) {
  if (!length || length <= 1) return 0;
  const idx = roundRobinIndex % length;
  roundRobinIndex = (roundRobinIndex + 1) % length;
  return idx;
}

module.exports = {
  CONFIG_PATH,
  TMP_CONFIG_PATH,
  DEFAULT_CONFIG,
  parseKeys,
  getConfig,
  syncCloudConfig,
  saveConfig,
  persistConfig,
  testUpstash,
  testGitHub,
  getCloudStorageInfo,
  fetchAvailableModels,
  testSingleModel,
  redactConfigForExport,
  hashAdminPassword,
  verifyAdminPassword,
  checkClientAuth,
  getClientIp,
  checkRateLimit,
  recordFailedAttempt,
  clearLoginAttempts,
  checkChatRateLimit,
  consumeChatRate,
  STYLE_LABELS,
  STYLE_PROMPTS,
  LANGUAGE_OPTIONS,
  sanitizeOutput,
  sanitizeErrorMessage,
  buildBreAISystemPrompt,
  MODEL_PRICING,
  calculateCost,
  logRequest,
  getLogs,
  clearLogs,
  getMetrics,
  getRouterOverview,
  getRouterDetails,
  checkBlacklist,
  getCachedResponse,
  setCachedResponse,
  clearResponseCache,
  BoundedMap,
  getNextRoundRobinIndex,
  logAdminAction,
  getAuditLogs,
  clearAuditLogs
};

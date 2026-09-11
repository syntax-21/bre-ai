// ========================================================
// Bre AI v3.0 - Telegram Slash Commands Router
// Modular Architecture by Amirun Rayan Ariandi
// ========================================================
const systemCommands = require('./commands/systemCommands');
const providerCommands = require('./commands/providerCommands');
const adminCommands = require('./commands/adminCommands');
const engineCommands = require('./commands/engineCommands');
const toolCommands = require('./commands/toolCommands');

const commandModules = [
  systemCommands,
  providerCommands,
  adminCommands,
  engineCommands,
  toolCommands
];

/**
 * Handle slash commands sent by users
 * @returns {Promise<boolean>} true if command was handled, false otherwise
 */
async function handleSlashCommand({
  msg,
  botService,
  text,
  chatId,
  fromUser,
  senderName,
  senderTag,
  token,
  isOwnerUser,
  queryBreAIRouter
}) {
  if (!text || !text.startsWith('/')) return false;

  const lowerText = text.toLowerCase();
  const ctx = {
    msg,
    botService,
    text,
    lowerText,
    chatId,
    fromUser,
    senderName,
    senderTag,
    token,
    isOwnerUser,
    queryBreAIRouter
  };

  for (const mod of commandModules) {
    if (await mod.handle(ctx)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  handleSlashCommand,
  handleBroadcastCommand: adminCommands.handleBroadcastCommand,
  resolveTargetProvider: providerCommands.resolveTargetProvider
};

import { getConfig, saveConfig, STYLE_LABELS, STYLE_PROMPTS } from '../api/_shared.js';
import accessPkg from '../services/telegram/accessControl.js';
import adminMenuPkg from '../services/telegram/adminMenu.js';
import messageHandlerPkg from '../services/telegram/messageHandler.js';
import assert from 'assert';

const { isUserAllowed, setUserRole, removeUserRole } = accessPkg;
const { buildMainMenuMarkup, getMainMenuText, handleAdminCallback } = adminMenuPkg;
const { handleMessage, chatStyles } = messageHandlerPkg;

console.log('🧪 Starting Verification of All Updates...\n');

// 1. Verify Styles
console.log('1. Checking Gaya Bahasa / Dialects in _shared.js...');
const expectedStyles = ['santai', 'jakarta', 'jawa_halus', 'jawa_kasar', 'sunda', 'sopan', 'medan', 'makassar', 'standar'];
expectedStyles.forEach(s => {
  assert(STYLE_LABELS[s], `Missing STYLE_LABELS for ${s}`);
  assert(STYLE_PROMPTS[s], `Missing STYLE_PROMPTS for ${s}`);
  console.log(`   ✅ Style '${s}': ${STYLE_LABELS[s]}`);
});

// 2. Verify Access Control & "Diizinkan" nomenclature
console.log('\n2. Checking Access Control & Role Handling...');
let cfg = getConfig();
const ownerId = '999000111';
const allowedId = '111222333';
const legacyId = '444555666';
const blockedId = '777888999';
const strangerId = '000111222';

cfg.telegramOwnerId = ownerId;
cfg.telegramAccessMode = 'diizinkan';
cfg.telegramUsers = [
  { id: ownerId, username: 'boss', name: 'Owner Boss', role: 'owner' },
  { id: allowedId, username: 'user_allowed', name: 'Allowed User', role: 'diizinkan' },
  { id: legacyId, username: 'user_legacy', name: 'Legacy Whitelist User', role: 'whitelist' },
  { id: blockedId, username: 'user_spammer', name: 'Spammer', role: 'blocked' }
];

assert.strictEqual(isUserAllowed(ownerId, cfg.telegramOwnerId, cfg.telegramAccessMode), true, 'Owner must be allowed');
assert.strictEqual(isUserAllowed(allowedId, cfg.telegramOwnerId, cfg.telegramAccessMode), true, 'Diizinkan user must be allowed');
assert.strictEqual(isUserAllowed(legacyId, cfg.telegramOwnerId, cfg.telegramAccessMode), true, 'Legacy whitelist user must be backward compatible');
assert.strictEqual(isUserAllowed(blockedId, cfg.telegramOwnerId, cfg.telegramAccessMode), false, 'Blocked user must be denied');
assert.strictEqual(isUserAllowed(strangerId, cfg.telegramOwnerId, cfg.telegramAccessMode), false, 'Stranger must be denied in diizinkan mode');

cfg.telegramAccessMode = 'public';
assert.strictEqual(isUserAllowed(strangerId, cfg.telegramOwnerId, cfg.telegramAccessMode), true, 'Stranger must be allowed in public mode');
assert.strictEqual(isUserAllowed(blockedId, cfg.telegramOwnerId, cfg.telegramAccessMode), false, 'Blocked user must still be denied in public mode');
console.log('   ✅ Access control permissions verified successfully.');

// Test role mutations
setUserRole(strangerId, 'stranger_u', 'Stranger User', 'diizinkan');
let reloadedCfg = getConfig();
let foundUser = (reloadedCfg.telegramUsers || []).find(u => String(u.id) === strangerId);
assert(foundUser, 'User should be found in config');
assert.strictEqual(foundUser.role, 'diizinkan', 'Role should be set to diizinkan');

setUserRole(strangerId, 'stranger_u', 'Stranger User', 'whitelist');
reloadedCfg = getConfig();
foundUser = (reloadedCfg.telegramUsers || []).find(u => String(u.id) === strangerId);
assert.strictEqual(foundUser.role, 'diizinkan', 'Whitelist role should normalize to diizinkan');

setUserRole(strangerId, 'stranger_u', 'Stranger User', 'blocked');
reloadedCfg = getConfig();
foundUser = (reloadedCfg.telegramUsers || []).find(u => String(u.id) === strangerId);
assert.strictEqual(foundUser.role, 'blocked', 'Role should be set to blocked');

removeUserRole(strangerId);
reloadedCfg = getConfig();
foundUser = (reloadedCfg.telegramUsers || []).find(u => String(u.id) === strangerId);
assert.strictEqual(foundUser, undefined, 'Role should be removed');
console.log('   ✅ setUserRole and normalization verified.');

// 3. Verify Admin Menu
console.log('\n3. Checking Admin Menu Markup & Feature Removal...');
const markup = buildMainMenuMarkup(cfg);
const flatButtons = markup.inline_keyboard.flat().map(b => b.text);
console.log('   Buttons in main menu:', flatButtons);

const hasGantiModel = flatButtons.some(t => t.toLowerCase().includes('ganti model'));
assert.strictEqual(hasGantiModel, false, 'Ganti Model AI button MUST be removed');
console.log('   ✅ "Ganti Model AI" is not present in Admin Menu.');

console.log('\n🎉 ALL VERIFICATION TESTS PASSED SUCCESSFULLY!\n');

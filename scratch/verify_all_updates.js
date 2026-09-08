import { getConfig, saveConfig, STYLE_LABELS, STYLE_PROMPTS, buildBreAISystemPrompt, sanitizeOutput } from '../api/_shared.js';
import accessPkg from '../services/telegram/accessControl.js';
import adminMenuPkg from '../services/telegram/adminMenu.js';
import messageHandlerPkg from '../services/telegram/messageHandler.js';
import assert from 'assert';

const { isUserAllowed, setUserRole, removeUserRole } = accessPkg;
const { buildMainMenuMarkup, getMainMenuText, handleAdminCallback } = adminMenuPkg;
const { handleMessage, chatStyles } = messageHandlerPkg;

console.log('🧪 Starting Verification of All Updates...\n');

// 0. Verify Bre AI Ownership & Style/Language Adaptation
console.log('0. Checking Bre AI Ownership & Dialect / Language Enforcement...');
const samplePromptJakarta = buildBreAISystemPrompt({ style: 'jakarta', language: 'id' });
assert(samplePromptJakarta.includes('Amirun Rayan Ariandi'), 'Must include Amirun Rayan Ariandi as creator/owner');
assert(samplePromptJakarta.includes('Bre AI'), 'Must include Bre AI name');
assert(samplePromptJakarta.includes('OVERRIDE'), 'Must include upstream override instruction');
assert(samplePromptJakarta.includes('gue') && samplePromptJakarta.includes('lu'), 'Jakarta prompt must include gue-lu dialect instructions');
console.log('   ✅ buildBreAISystemPrompt correctly enforces Bre AI ownership and Jakarta dialect.');

const samplePromptJawa = buildBreAISystemPrompt({ style: 'jawa_halus' });
assert(samplePromptJawa.includes('Kromo Inggil') || samplePromptJawa.includes('Matur nuwun'), 'Jawa Halus prompt must include Kromo Inggil dialect instructions');
console.log('   ✅ buildBreAISystemPrompt correctly enforces Jawa Halus dialect.');

const sanitizedText = sanitizeOutput('I am ChatGPT created by OpenAI and Mercury-2 developed by Inception Labs.');
assert(!sanitizedText.includes('ChatGPT'), 'ChatGPT must be sanitized');
assert(!sanitizedText.includes('OpenAI'), 'OpenAI must be sanitized');
assert(sanitizedText.includes('Bre AI') && sanitizedText.includes('Amirun Rayan Ariandi'), 'Output must be sanitized to Bre AI and Amirun Rayan Ariandi');
console.log('   ✅ sanitizeOutput successfully neutralizes upstream provider identities.');

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

// 4. Verify Manual Provider, Editing, & Key Commands
console.log('\n4. Testing /addprovider, editing (/seturl, /setmodel, /setname, /setweight, /setkey, /editprovider), /delkey, /delprovider...');
const mockBotService = {
  activeOwnerId: ownerId,
  activeAccessMode: 'public',
  activeToken: 'test_token',
  conversations: new Map()
};

// Add custom provider
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/addprovider CustomTestAI https://api.customai.io/v1/chat/completions sk_test_key_111 custom-model-v1'
}, mockBotService);

let afterAddCfg = getConfig();
let customEp = afterAddCfg.endpoints.find(e => e.name === 'CustomTestAI');
assert(customEp, 'CustomTestAI should exist in endpoints');
assert.strictEqual(customEp.url, 'https://api.customai.io/v1/chat/completions');
assert.strictEqual(customEp.models[0], 'custom-model-v1');
assert.strictEqual(customEp.keys[0], 'sk_test_key_111');
console.log('   ✅ /addprovider successfully registered CustomTestAI.');

// Test /seturl
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/seturl CustomTestAI https://api.customai.io/v2/chat/completions'
}, mockBotService);
let epUrl = getConfig().endpoints.find(e => e.name === 'CustomTestAI');
assert.strictEqual(epUrl.url, 'https://api.customai.io/v2/chat/completions');
console.log('   ✅ /seturl successfully updated base URL.');

// Test /setmodel
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/setmodel CustomTestAI custom-model-v2'
}, mockBotService);
let epModel = getConfig().endpoints.find(e => e.name === 'CustomTestAI');
assert.strictEqual(epModel.models[0], 'custom-model-v2');
console.log('   ✅ /setmodel successfully updated model name.');

// Test /setkey
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/setkey CustomTestAI sk_new_primary_key_333'
}, mockBotService);
let epKey = getConfig().endpoints.find(e => e.name === 'CustomTestAI');
assert.strictEqual(epKey.keys[0], 'sk_new_primary_key_333');
console.log('   ✅ /setkey successfully updated primary API key.');

// Test /setweight
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/setweight CustomTestAI 5'
}, mockBotService);
let epWeight = getConfig().endpoints.find(e => e.name === 'CustomTestAI');
assert.strictEqual(epWeight.weight, 5);
console.log('   ✅ /setweight successfully updated provider weight.');

// Test /setname
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/setname CustomTestAI CustomRenamedAI'
}, mockBotService);
let epRenamed = getConfig().endpoints.find(e => e.name === 'CustomRenamedAI');
assert(epRenamed, 'Provider should now be named CustomRenamedAI');
console.log('   ✅ /setname successfully updated provider name.');

// Test /editprovider general command
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/editprovider CustomRenamedAI url https://api.customai.io/v3/chat/completions'
}, mockBotService);
let epEditedUrl = getConfig().endpoints.find(e => e.name === 'CustomRenamedAI');
assert.strictEqual(epEditedUrl.url, 'https://api.customai.io/v3/chat/completions');
console.log('   ✅ /editprovider url successfully updated endpoint.');

await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/editprovider CustomRenamedAI key sk_edit_key_444'
}, mockBotService);
let epEditedKey = getConfig().endpoints.find(e => e.name === 'CustomRenamedAI');
assert.strictEqual(epEditedKey.keys[0], 'sk_edit_key_444');
console.log('   ✅ /editprovider key successfully updated API key.');

// Add second key to test /delkey
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/addkey CustomRenamedAI sk_extra_key_555'
}, mockBotService);
let epTwoKeys = getConfig().endpoints.find(e => e.name === 'CustomRenamedAI');
assert.strictEqual(epTwoKeys.keys.length, 2);

await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/delkey CustomRenamedAI 1'
}, mockBotService);
let epOneKey = getConfig().endpoints.find(e => e.name === 'CustomRenamedAI');
assert.strictEqual(epOneKey.keys.length, 1);
assert.strictEqual(epOneKey.keys[0], 'sk_extra_key_555');
console.log('   ✅ /delkey successfully deleted first key.');

// Delete test provider to clean up
await handleMessage({
  chat: { id: 999000111 },
  from: { id: ownerId, first_name: 'Owner', username: 'boss' },
  text: '/delprovider CustomRenamedAI'
}, mockBotService);

let finalCfg = getConfig();
let customDeleted = finalCfg.endpoints.find(e => e.name === 'CustomRenamedAI');
assert.strictEqual(customDeleted, undefined, 'CustomRenamedAI should be deleted');
console.log('   ✅ /delprovider successfully removed provider.');

// Verify Inception Labs is preserved
const inceptionEp = finalCfg.endpoints.find(e => e.name === 'Inception Labs');
assert(inceptionEp, 'Inception Labs provider must be preserved');
assert(inceptionEp.keys && inceptionEp.keys.length > 0, 'Inception Labs keys must be preserved');
console.log(`   ✅ Inception Labs provider intact with key: ${inceptionEp.keys[0].slice(0, 8)}...`);

console.log('\n🎉 ALL EDITING & PROVIDER VERIFICATION TESTS PASSED 100% SUCCESSFULLY!\n');

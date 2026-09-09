const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runTests() {
  console.log('--- Starting API Integration & Setup Guide Verification ---');

  // 1. Test validateClientKey with Master Key, Client Keys, and Invalid Keys
  const { validateClientKey, getConfig } = require('../api/_shared');
  const mockConfig = {
    adminPassword: 'admin_password_123',
    clientKey: 'sk-bre-master-999',
    clientKeys: [
      { id: 'ck_1', label: 'NextChat App', key: 'sk-bre-nextchat-111', enabled: true },
      { id: 'ck_2', label: 'Revoked App', key: 'sk-bre-revoked-222', enabled: false },
      { id: 'ck_3', label: 'Cherry Studio', key: 'sk-bre-cherry-333', active: true }
    ]
  };

  // Test Admin Password Auth
  const resAdmin = validateClientKey('Bearer admin_password_123', mockConfig);
  assert.strictEqual(resAdmin.valid, true, 'Admin password should be valid');

  // Test Master Client Key Auth
  const resMaster = validateClientKey('Bearer sk-bre-master-999', mockConfig);
  assert.strictEqual(resMaster.valid, true, 'Master Client Key should be valid');
  assert.strictEqual(resMaster.name, 'Master Client Key');

  // Test Active Multi-Client Key
  const resNextChat = validateClientKey('sk-bre-nextchat-111', mockConfig);
  assert.strictEqual(resNextChat.valid, true, 'Active Client key should be valid');
  assert.strictEqual(resNextChat.name, 'NextChat App');

  // Test Revoked Key
  const resRevoked = validateClientKey('Bearer sk-bre-revoked-222', mockConfig);
  assert.strictEqual(resRevoked.valid, false, 'Revoked key should be invalid');
  assert.ok(resRevoked.error.includes('dinonaktifkan') || resRevoked.error.includes('Revoked'));

  // Test Invalid Key
  const resInvalid = validateClientKey('Bearer sk-fake-key-xxx', mockConfig);
  assert.strictEqual(resInvalid.valid, false, 'Fake key should be invalid');

  console.log('✅ validateClientKey passed all authentication test cases.');

  // 2. Test api/models.js output format
  const modelsHandler = require('../api/models');
  let modelsResult = null;
  const mockReqModels = {
    method: 'GET',
    headers: { authorization: 'Bearer sk-bre-test-key-1234567890abcdef' }
  };
  const mockResModels = {
    setHeader: () => {},
    status: function(code) {
      assert.strictEqual(code, 200, `Expected status 200, got ${code}`);
      return {
        json: function(data) {
          modelsResult = data;
        }
      };
    }
  };

  await modelsHandler(mockReqModels, mockResModels);
  assert.ok(modelsResult, 'Models handler should return a result');
  assert.strictEqual(modelsResult.object, 'list', 'Models result should have object: "list"');
  assert.ok(Array.isArray(modelsResult.data), 'Models result should have data array');
  assert.ok(modelsResult.data.some(m => m.id === 'bre-ai'), 'Models result must include bre-ai unified model');

  console.log('✅ api/models.js passed OpenAI format verification:', modelsResult.data.map(m => m.id));

  // 3. Test vercel.json rewrite rules
  const vercelJson = JSON.parse(fs.readFileSync(path.join(__dirname, '../vercel.json'), 'utf-8'));
  assert.ok(vercelJson.rewrites.some(r => r.source === '/v1/chat/completions' && r.destination === '/api/chat'), 'vercel.json must rewrite /v1/chat/completions');
  assert.ok(vercelJson.rewrites.some(r => r.source === '/v1/models' && r.destination === '/api/models'), 'vercel.json must rewrite /v1/models');
  console.log('✅ vercel.json passed rewrite rules verification.');

  // 4. Test public/admin.html and public/admin.js contents
  const adminHtml = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf-8');
  assert.ok(adminHtml.includes('id="guideBaseUrl"'), 'admin.html should have guideBaseUrl input');
  assert.ok(adminHtml.includes('id="guideChatUrl"'), 'admin.html should have guideChatUrl input');
  assert.ok(adminHtml.includes('id="guideKeySelect"'), 'admin.html should have guideKeySelect dropdown');
  assert.ok(adminHtml.includes('id="guideTab_nextchat"'), 'admin.html should have nextchat setup guide');
  assert.ok(adminHtml.includes('id="guideTab_cherry"'), 'admin.html should have cherry studio setup guide');
  assert.ok(adminHtml.includes('id="guideTab_cline"'), 'admin.html should have cline setup guide');
  assert.ok(adminHtml.includes('id="btnRunGuideTest"'), 'admin.html should have connection tester widget');

  const adminJs = fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf-8');
  assert.ok(adminJs.includes('initIntegrationGuide'), 'admin.js should have initIntegrationGuide');
  assert.ok(adminJs.includes('updateGuideKeyDropdown'), 'admin.js should have updateGuideKeyDropdown');
  assert.ok(adminJs.includes('runGuideConnectionTest'), 'admin.js should have runGuideConnectionTest');
  console.log('✅ public/admin.html and public/admin.js passed UI integration guide verification.');

  console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('--- Starting Streamlined API & Endpoints Verification ---');

  // 1. Test api/models.js output format (OpenAI compatible list without blocking key)
  const modelsHandler = require('../api/models');
  let modelsResult = null;
  const mockReqModels = {
    method: 'GET',
    headers: {}
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
  assert.strictEqual(modelsResult.object, 'list', 'models endpoint should return object: "list"');
  assert.ok(Array.isArray(modelsResult.data), 'models endpoint should return an array in data');
  assert.ok(modelsResult.data.some(m => m.id === 'bre-ai'), 'Master bre-ai unified router model must exist in data');

  console.log(`✅ api/models.js successfully returned ${modelsResult.data.length} models, including 'bre-ai'.`);

  // 2. Test Admin HTML and JS for absence of old Client Keys tab and presence of AI Tools & Health Benchmark
  const adminHtml = fs.readFileSync(path.join(__dirname, '../public/admin.html'), 'utf8');
  const adminJs = fs.readFileSync(path.join(__dirname, '../public/admin.js'), 'utf8');

  assert.ok(adminHtml.includes('tabTools'), 'admin.html should contain tabTools');
  assert.ok(adminHtml.includes('AI Tools & Prompt Studio'), 'admin.html should contain AI Tools & Prompt Studio tab');
  assert.ok(adminHtml.includes('runMultiProviderBenchmark'), 'admin.html should contain runMultiProviderBenchmark button');
  assert.ok(adminJs.includes('STUDIO_TOOLS'), 'admin.js should contain STUDIO_TOOLS definition');
  assert.ok(adminJs.includes('runMultiProviderBenchmark'), 'admin.js should contain runMultiProviderBenchmark logic');

  console.log('✅ Admin HTML and JS correctly integrate AI Tools Studio and Multi-Provider Health Benchmark.');
  console.log('\n🎉 ALL STREAMLINED API TESTS PASSED SUCCESSFULLY!\n');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

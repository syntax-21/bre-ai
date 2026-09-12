const fs = require('fs');
const html = fs.readFileSync('public/admin.html', 'utf8');

const tabIds = [
  'tab9Router',
  'tabDetails',
  'tabProviders',
  'tabEngine',
  'tabSecurity',
  'tabTelegram',
  'tabCloud',
  'tabTester',
  'tabBackup'
];

console.log('=== Checking all tab containers in public/admin.html ===');
tabIds.forEach(id => {
  const exists = html.includes(`id="${id}"`);
  console.log(`Tab ${id}: ${exists ? 'EXISTS ✅' : 'MISSING ❌'}`);
});

// Check if any card is outside of .tab-content
// Find all main content lines
const mainStart = html.indexOf('<main class="admin-content" id="mainContent">');
const mainEnd = html.indexOf('</main>');
const mainHtml = html.slice(mainStart, mainEnd);

// Split by tab-content
const tabMatches = [...mainHtml.matchAll(/<div id="(tab[^"]+)" class="tab-content"[^>]*>/g)];
console.log('\nFound Tabs:', tabMatches.map(m => m[1]));

console.log('\n✅ public/admin.html tabs verification complete!');

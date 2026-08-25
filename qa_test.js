const fs = require('fs');
const path = require('path');
const vm = require('vm');

const baseDir = __dirname;
const results = [];

function checkFile(fileName) {
  const filePath = path.join(baseDir, fileName);
  if (!fs.existsSync(filePath)) {
    results.push({ file: fileName, status: 'ERROR', message: 'File does not exist' });
    return;
  }

  const content = fs.readFileSync(filePath, 'utf8');

  if (fileName.endsWith('.json')) {
    try {
      JSON.parse(content);
      results.push({ file: fileName, status: 'PASS', message: 'Valid JSON' });
    } catch (e) {
      results.push({ file: fileName, status: 'FAIL', message: `JSON syntax error: ${e.message}` });
    }
  } else if (fileName.endsWith('.js')) {
    try {
      new vm.Script(content);
      results.push({ file: fileName, status: 'PASS', message: 'Valid JS syntax' });
    } catch (e) {
      results.push({ file: fileName, status: 'FAIL', message: `JS syntax error: ${e.message}` });
    }
  }
}

const filesToCheck = [
  'manifest.json',
  'background.js',
  'popup.js',
  'saved.js',
  'youtube_optimizer.js'
];

filesToCheck.forEach(checkFile);

console.log('=== HASIL QA SYNTAX & PARSING ===');
results.forEach(r => {
  console.log(`[${r.status}] ${r.file}: ${r.message}`);
});

import { spawn } from 'node:child_process';
import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const testsDir = __dirname;

function parseArgs() {
  const args = process.argv.slice(2);
  let filter = null;
  
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--filter' && args[i + 1]) {
      filter = args[i + 1];
      i++;
    } else if (args[i].startsWith('--filter=')) {
      filter = args[i].slice('--filter='.length);
    }
  }
  
  return { filter };
}

async function findTestFiles(filter) {
  const testFiles = [];
  
  async function scanDir(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name === 'fixtures' || entry.name === 'node_modules') {
          continue;
        }
        await scanDir(fullPath);
      } else if (entry.isFile() && entry.name.endsWith('.test.js')) {
        const relativePath = relative(testsDir, fullPath);
        
        if (filter) {
          const fileName = relativePath.toLowerCase();
          if (!fileName.includes(filter.toLowerCase())) {
            continue;
          }
        }
        
        testFiles.push(fullPath);
      }
    }
  }
  
  await scanDir(testsDir);
  return testFiles.sort();
}

async function main() {
  const { filter } = parseArgs();
  const testFiles = await findTestFiles(filter);
  
  if (testFiles.length === 0) {
    console.log('No test files found.');
    if (filter) {
      console.log(`Filter: "${filter}"`);
    }
    process.exit(0);
  }
  
  console.log(`Running ${testFiles.length} test file${testFiles.length > 1 ? 's' : ''}...\n`);
  
  const args = ['--test', ...testFiles];
  const child = spawn('node', args, {
    stdio: 'inherit',
    cwd: process.cwd()
  });
  
  child.on('close', (code) => {
    process.exit(code || 0);
  });
  
  child.on('error', (error) => {
    console.error('Failed to run tests:', error);
    process.exit(1);
  });
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

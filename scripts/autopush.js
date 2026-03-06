// Auto-Push Watcher — Penny Wise I.T
// Watches for file changes and auto-commits + pushes to remote
// Usage: node scripts/autopush.js

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PROJECT_DIR = path.resolve(__dirname, '..');
const DEBOUNCE_MS = 5000;
const IGNORED = /node_modules|\.git|dist|build|\.next/;

let pushTimer = null;
let changeCount = 0;

function autoPush() {
  try {
    execSync('git add -A', { cwd: PROJECT_DIR, stdio: 'pipe' });
    const status = execSync('git status --porcelain', { cwd: PROJECT_DIR, stdio: 'pipe' }).toString().trim();
    if (!status) { changeCount = 0; return; }

    const lines = status.split('\n').length;
    const timestamp = new Date().toLocaleString('en-AU');
    execSync(`git commit -m "Auto-save: ${lines} file(s) changed — ${timestamp}"`, { cwd: PROJECT_DIR, stdio: 'pipe' });

    try {
      execSync('git push', { cwd: PROJECT_DIR, stdio: 'pipe', timeout: 30000 });
      console.log(`[AutoPush] \x1b[32m✓ Pushed ${lines} change(s) at ${timestamp}\x1b[0m`);
    } catch (pushErr) {
      console.log(`[AutoPush] \x1b[33m⚠ Committed locally (add a git remote to enable push)\x1b[0m`);
    }
    changeCount = 0;
  } catch (err) {
    // Nothing to commit
  }
}

function onFileChange(eventType, filename) {
  if (!filename || IGNORED.test(filename)) return;
  changeCount++;
  clearTimeout(pushTimer);
  pushTimer = setTimeout(autoPush, DEBOUNCE_MS);
  if (changeCount === 1) {
    console.log(`[AutoPush] Change detected, waiting ${DEBOUNCE_MS / 1000}s before push...`);
  }
}

console.log('[AutoPush] \x1b[36mWatching for changes...\x1b[0m');
console.log('[AutoPush] Save files normally — changes auto-commit & push after ' + (DEBOUNCE_MS / 1000) + 's of inactivity');
console.log('[AutoPush] Press Ctrl+C to stop\n');

try {
  fs.watch(PROJECT_DIR, { recursive: true }, onFileChange);
} catch (err) {
  console.error('[AutoPush] Error starting watcher:', err.message);
  console.log('[AutoPush] Falling back to polling mode (10s interval)');
  setInterval(autoPush, 10000);
}

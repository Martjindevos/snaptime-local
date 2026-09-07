#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronPath = path.join(__dirname, 'node_modules/electron/dist/Electron.app/Contents/MacOS/Electron');
const args = process.argv.slice(2);

if (!fs.existsSync(electronPath)) {
  console.error('Electron binary not found at:', electronPath);
  process.exit(1);
}

const proc = spawn(electronPath, args, { stdio: 'inherit' });
proc.on('exit', (code) => process.exit(code));

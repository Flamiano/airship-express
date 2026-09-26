#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(process.cwd(), '.env') });

const args = process.argv.slice(2);
const useClipboard = args.includes('--clipboard');
const textArgIndex = args.indexOf('--text');
let text = null;

if (textArgIndex !== -1 && args[textArgIndex + 1]) {
  text = args[textArgIndex + 1];
}

async function readStdin() {
  const chunks = [];
  return new Promise((resolve) => {
    process.stdin.on('data', (c) => chunks.push(c));
    process.stdin.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    process.stdin.on('error', () => resolve(''));
  });
}

async function getClipboard() {
  try {
    // lazy require so script still works without clipboardy if not needed
    const clipboardy = require('clipboardy');
    return await clipboardy.read();
  } catch (err) {
    console.error('Clipboard support not available. Install clipboardy or pass --text "..."');
    process.exit(1);
  }
}

async function main() {
  if (!text) {
    if (useClipboard) {
      text = await getClipboard();
    } else if (!process.stdin.isTTY) {
      text = await readStdin();
    }
  }

  if (!text || !String(text).trim()) {
    console.error('No text provided. Select and copy text, or pass --text "...", or pipe into the script.');
    process.exit(1);
  }

  const TASKADE_WEBHOOK_URL = process.env.TASKADE_WEBHOOK_URL || '';
  const TASKADE_API_URL = process.env.TASKADE_API_URL || '';
  const TASKADE_TOKEN = process.env.TASKADE_TOKEN || '';
  const TASKADE_PROJECT_ID = process.env.TASKADE_PROJECT_ID || '';

  // Prefer webhook URL if provided — it's the simplest integration
  if (TASKADE_WEBHOOK_URL) {
    try {
      const res = await fetch(TASKADE_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: String(text) }),
      });
      console.log('Posted to Taskade webhook', res.status);
      process.exit(res.ok ? 0 : 1);
    } catch (err) {
      console.error('Webhook post failed:', err.message || err);
      process.exit(1);
    }
  }

  // Fallback: use a generic API URL + token if provided. The exact Taskade API path
  // may vary depending on your Taskade account; supply TASKADE_API_URL and TASKADE_TOKEN
  // in .env if you prefer this method.
  if (TASKADE_API_URL && TASKADE_TOKEN) {
    if (!TASKADE_PROJECT_ID) {
      console.error('TASKADE_PROJECT_ID is required when using TASKADE_API_URL + TASKADE_TOKEN');
      process.exit(1);
    }
    // default endpoint pattern: {API_URL}/projects/{projectId}/tasks
    const target = `${TASKADE_API_URL.replace(/\/$/, '')}/projects/${encodeURIComponent(
      TASKADE_PROJECT_ID
    )}/tasks`;

    try {
      const res = await fetch(target, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${TASKADE_TOKEN}`,
        },
        body: JSON.stringify({ content: String(text) }),
      });
      const body = await res.text();
      console.log('API post status:', res.status);
      console.log('Response:', body.substring(0, 200));
      process.exit(res.ok ? 0 : 1);
    } catch (err) {
      console.error('API post failed:', err.message || err);
      process.exit(1);
    }
  }

  console.error('No Taskade integration configured. Set TASKADE_WEBHOOK_URL or TASKADE_API_URL + TASKADE_TOKEN + TASKADE_PROJECT_ID in .env');
  process.exit(1);
}

// Node 18+ has global fetch; polyfill otherwise
(async () => {
  if (typeof fetch === 'undefined') {
    try {
      global.fetch = (...args) => import('node-fetch').then((m) => m.default(...args));
    } catch (e) {}
  }
  await main();
})();

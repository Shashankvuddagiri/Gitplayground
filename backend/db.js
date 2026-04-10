/**
 * db.js
 * Simple JSON file-based storage for user progress.
 * No external database required — writes to data/progress.json
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR  = path.join(__dirname, '..', 'data');
const DATA_FILE = path.join(DATA_DIR, 'progress.json');

// Ensure data directory and file exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, '{}', 'utf8');

function readAll() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return {};
  }
}

function writeAll(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

export const db = {
  getProgress(userId) {
    const all = readAll();
    return all[userId] || null;
  },

  saveProgress(userId, progress) {
    const all = readAll();
    all[userId] = { ...progress, updatedAt: new Date().toISOString() };
    writeAll(all);
    return all[userId];
  },

  deleteProgress(userId) {
    const all = readAll();
    delete all[userId];
    writeAll(all);
  },

  getAllUsers() {
    return Object.keys(readAll());
  },
};

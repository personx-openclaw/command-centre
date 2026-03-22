import { nanoid } from 'nanoid';
import bcrypt from 'bcrypt';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';

const args = process.argv.slice(2);
const usernameIdx = args.indexOf('--username');
const passwordIdx = args.indexOf('--password');

if (usernameIdx === -1 || passwordIdx === -1) {
  console.error('Usage: npx tsx src/scripts/seed-user.ts --username <user> --password <pass>');
  process.exit(1);
}

const username = args[usernameIdx + 1];
const password = args[passwordIdx + 1];

const passwordHash = await bcrypt.hash(password, 10);

try {
  db.insert(users).values({
    id: nanoid(),
    username,
    passwordHash,
  }).run();
  console.log(`User "${username}" created successfully.`);
} catch (e: any) {
  if (e.message?.includes('UNIQUE')) {
    console.error(`User "${username}" already exists.`);
  } else {
    throw e;
  }
}

import bcrypt from 'bcrypt';
import { db, schema } from '../db/index.js';
import crypto from 'crypto';

const args = process.argv.slice(2);
const usernameIndex = args.indexOf('--username');
const passwordIndex = args.indexOf('--password');

if (usernameIndex === -1 || passwordIndex === -1) {
  console.error('Usage: npm run seed:user -- --username <username> --password <password>');
  process.exit(1);
}

const username = args[usernameIndex + 1];
const password = args[passwordIndex + 1];

if (!username || !password) {
  console.error('Both username and password are required');
  process.exit(1);
}

async function seedUser() {
  const passwordHash = await bcrypt.hash(password, 12);
  const userId = crypto.randomUUID();

  await db.insert(schema.users).values({
    id: userId,
    username,
    passwordHash,
  });

  console.log(`✓ User created: ${username}`);
}

seedUser().catch(console.error);

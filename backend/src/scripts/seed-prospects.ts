import { db, schema } from '../db/index.js';
import crypto from 'crypto';

const firms = [
  { name: 'Artemis Investment Management', aum: '£30bn', country: 'UK' },
  { name: 'Polar Capital', aum: '£20bn', country: 'UK' },
  { name: 'Liontrust Asset Management', aum: '£25bn', country: 'UK' },
  { name: 'Jupiter Asset Management', aum: '£48bn', country: 'UK' },
  { name: 'Premier Miton Group', aum: '£11bn', country: 'UK' },
  { name: 'Brooks Macdonald', aum: '£17bn', country: 'UK' },
  { name: 'Waverton Investment Management', aum: '£8bn', country: 'UK' },
  { name: 'Tatton Asset Management', aum: '£15bn', country: 'UK' },
  { name: 'Foresight Group', aum: '£12bn', country: 'UK' },
  { name: 'Gresham House', aum: '£8bn', country: 'UK' },
  { name: 'Evenlode Investment', aum: '£6bn', country: 'UK' },
  { name: 'Sarasin and Partners', aum: '£20bn', country: 'UK' },
  { name: 'Ruffer LLP', aum: '£20bn', country: 'UK' },
  { name: 'Close Brothers Asset Management', aum: '£17bn', country: 'UK' },
  { name: 'Montanaro Asset Management', aum: '£3bn', country: 'UK' },
  { name: 'Momentum Global Investment Management', aum: '£5bn', country: 'UK' },
  { name: 'Hawksmoor Investment Management', aum: '£2bn', country: 'UK' },
  { name: 'Coutts Investment Management', aum: '£30bn', country: 'UK' },
  { name: 'Charles Stanley', aum: '£30bn', country: 'UK' },
  { name: 'Man GLG', aum: '£20bn', country: 'UK' },
  { name: 'Quilter Cheviot', aum: '£30bn', country: 'UK' },
  { name: 'EQ Investors', aum: '£2bn', country: 'UK' },
  { name: 'Comgest', aum: '€30bn', country: 'EU' },
  { name: 'Tikehau Capital', aum: '€45bn', country: 'EU' },
  { name: 'Candriam', aum: '€140bn', country: 'EU' },
  { name: 'La Financiere de l Echiquier', aum: '€12bn', country: 'EU' },
  { name: 'Nordea Asset Management', aum: '€250bn', country: 'EU' },
  { name: 'Carmignac', aum: '€30bn', country: 'EU' },
  { name: 'Pictet Asset Management', aum: '£40bn', country: 'EU' },
  { name: 'Amundi UK Distribution', aum: '£50bn', country: 'EU' },
];

const now = new Date().toISOString();
for (const firm of firms) {
  await db.insert(schema.prospects).values({
    id: crypto.randomUUID(),
    firmName: firm.name,
    firmAum: firm.aum,
    firmCountry: firm.country,
    createdAt: now,
    updatedAt: now,
  });
}
console.log(`Seeded ${firms.length} prospects`);
process.exit(0);

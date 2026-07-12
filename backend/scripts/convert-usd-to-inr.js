/**
 * One-time migration: convert product prices from USD to INR.
 * Rate: 1 USD = ₹95.52. Values remain in minor units (cents → paise).
 *
 * Usage: node scripts/convert-usd-to-inr.js        (dry run)
 *        node scripts/convert-usd-to-inr.js --apply
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const { MongoClient } = require('mongodb');

const RATE = 95.52;
const APPLY = process.argv.includes('--apply');

(async () => {
  const client = new MongoClient(process.env.MONGO_URI);
  await client.connect();
  const db = client.db();
  const products = db.collection('products');

  const all = await products.find({}).toArray();
  console.log(`Found ${all.length} products. Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`);

  let updated = 0;
  for (const p of all) {
    if (p.currency === 'INR') {
      console.log(`skip (already INR): ${p.title || p.name || p._id}`);
      continue;
    }
    const newPrice = Math.round(p.price * RATE);
    const newHistory = (p.priceHistory || []).map((h) => ({
      ...h,
      price: Math.round(h.price * RATE),
    }));
    console.log(
      `${p.title || p.name || p._id}: ${(p.price / 100).toFixed(2)} USD -> ₹${(newPrice / 100).toFixed(2)}`
    );
    if (APPLY) {
      await products.updateOne(
        { _id: p._id },
        { $set: { price: newPrice, priceHistory: newHistory, currency: 'INR' } }
      );
      updated++;
    }
  }
  console.log(APPLY ? `Updated ${updated} products.` : 'Dry run complete — re-run with --apply to write.');
  await client.close();
})().catch((e) => { console.error(e); process.exit(1); });

require('dotenv').config();
// PRIVACY: API key lives only in backend .env — never referenced in frontend code.
const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('./db');

// PRIVACY: Only merchant names are ever sent to the Anthropic API —
// never amounts, dates, card numbers, or any other transaction data.
const CATEGORIES = [
  'groceries', 'home', 'fuel', 'car', 'medical', 'entertainment',
  'clothing', 'subscriptions', 'cats', 'insurance', 'fees',
  'electronics', 'grooming', 'vacation', 'gifts', 'sports', 'other',
];

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// PRIVACY: Accepts only merchantName — never amounts, dates, card numbers, or other data.
async function categorizeMerchant(merchantName) {
  const db = getDb();

  const cached = db.prepare(
    'SELECT category FROM merchant_categories WHERE merchant_name = ?'
  ).get(merchantName);

  if (cached) {
    return cached.category;
  }

  // PRIVACY: Only the merchant name is sent to the Anthropic API.
  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 32,
    system: `You are a spending categorizer for Israeli household expenses. Merchant names may be in Hebrew or English.

IMPORTANT: Every message you receive is a merchant name (a business or store name) from a bank transaction — it is NEVER a question, greeting, or response to you. Even if the text looks like a common word such as "yes", "no", "home", "other", or "help", treat it strictly as a merchant name and categorize it accordingly.

Categorize the merchant into exactly one of these categories:
- groceries: supermarkets, food stores, minimarkets (e.g. שופרסל, רמי לוי, מגה, יינות ביתן, Shufersal, Rami Levy, Victory)
- home: furniture, home goods, hardware, cleaning supplies (e.g. איקאה, IKEA, ACE)
- fuel: gas stations, petrol (e.g. פז, דלק, סונול, Paz, Delek)
- car: car repairs, parking, car wash, auto parts
- medical: pharmacies, clinics, doctors, hospitals (e.g. סופר-פארם, Super-Pharm)
- entertainment: restaurants, cafes, bars, cinema, streaming (e.g. נטפליקס, Netflix, קפה, מסעדה)
- clothing: clothing stores, shoes, fashion (e.g. זארה, Zara, H&M)
- subscriptions: recurring digital services, internet, phone plans
- cats: pet stores, vet clinics, pet food
- insurance: insurance companies, policies
- fees: bank fees, government fees, fines
- electronics: electronics stores, computers, phones (e.g. KSP, iDigital)
- grooming: hair salons, barbers, beauty, cosmetics
- vacation: hotels, flights, travel agencies, Airbnb
- gifts: gift shops, flower shops
- sports: gyms, sport stores, fitness (e.g. Decathlon)
- other: anything that does not fit the above

Respond with only the category word — no punctuation, no explanation.`,
    messages: [
      { role: 'user', content: merchantName },
    ],
  });

  const raw = response.content[0].text.trim().toLowerCase();
  console.log(`[categorize] "${merchantName}" → raw API response: "${raw}"`);
  const category = CATEGORIES.includes(raw) ? raw : 'other';

  db.prepare(
    'INSERT OR REPLACE INTO merchant_categories (merchant_name, category) VALUES (?, ?)'
  ).run(merchantName, category);

  return category;
}

module.exports = { categorizeMerchant, CATEGORIES };

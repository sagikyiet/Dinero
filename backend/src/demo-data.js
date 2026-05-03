'use strict';

const MALE_NAMES   = ['דניאל','יונתן','עמית','רועי','אורי','נדב','איתי','תומר','גל','ניר'];
const FEMALE_NAMES = ['נועה','מאיה','שירה','ליאור','דנה','רוני','יעל','אביגיל','תמר','מור'];
const SAVINGS_INSTS = ['מנורה מבטחים','אלטשולר שחם','הראל','מיטב דש','פסגות'];
const MALE_EMPLOYERS   = ['בי.אס.ג\'י בע"מ','אינטל ישראל','צ\'קפוינט','אורקל ישראל','ג\'נסיס טכנולוגיות'];
const FEMALE_EMPLOYERS = ['שיבא מרכז רפואי','בנק דיסקונט','ח.מ.ל בע"מ','עמידר','לוי אחזקות'];

const MERCHANTS = {
  groceries:    ['רמי לוי','שופרסל','מגה בעיר','ויקטורי','יינות ביתן','סיטי מרקט','שוק הכרמל'],
  home:         ['IKEA','ACE חומרי בנין','HOME CENTER','ממן חשמל','מקס סטוק'],
  fuel:         ['פז תחנת דלק','סונול','דלק ישראל','Ten אנרגיה','גולן דלק'],
  car:          ['מוסך כרמי','בגיר צמיגים','אוטוקם','מכון רישוי','חניה פארק'],
  medical:      ['מכבי שירותי בריאות','סופר-פארם','בית מרקחת כרמל','כללית','מרפאת שיניים פרטית'],
  entertainment:['סינמה סיטי','קפה נמרוד','בר לימה','זאפה ת"א','הופעת לייב'],
  clothing:     ['H&M','זארה','פוקס','קסטרו','מנגו'],
  subscriptions:['Spotify','Netflix','Apple Services','Wolt Plus','Canva Pro'],
  cats:         ['מרפאה וטרינרית','כלבו לחיות','Pet Shop IL'],
  insurance:    ['כלל ביטוח רכב','מנורה ביטוח','שירביט'],
  fees:         ['עמלת ניהול חשבון','עמלת העברה'],
  electronics:  ['iDigital','KSP','Next','מחסני חשמל'],
  grooming:     ['קפלן ת"א','Cut & Go','Studio Revlon'],
  vacation:     ['Booking.com','El Al','Airbnb IL','ישרוטל אילת'],
  gifts:        ['ספרים ועוד','Amazon IL','גרנד קנין'],
  sports:       ['הולמס פלייס','דקתלון','גולדס ג\'ים'],
  other:        ['דואר ישראל','מסגרת שונות'],
};

// Pre-seeded categories for every static bank transaction description
const BANK_CATEGORIES = {
  'בנק לאומי משכנתא':       'home',
  'ארנונה עיריית תל אביב':  'home',
  'שכירות נכס רמת גן':       'other',
  'חברת החשמל':              'home',
  'מי אביב':                 'home',
  'סלקום תקשורת':            'subscriptions',
  'בזק אינטרנט':             'subscriptions',
  'הראל ביטוח דירה':         'insurance',
  'עמלת ניהול חשבון':        'fees',
  'ועד הבית':                'home',
  'שכירות דירת גבעתיים':     'other',
  'ביטוח לאומי':              'insurance',
  'קופת חולים מכבי':         'medical',
  'פלאפון תקשורת':           'subscriptions',
  'שיפוץ ועד הבית':          'home',
  'רישום רכב שנתי':          'car',
  'בונוס רבעוני':            'other',
  'תגמול שנתי':              'other',
  'החזר מס הכנסה':           'other',
  'תשלום פרילנס':            'other',
  'מענק יוצאי דופן':         'other',
  'ביטוח חיים שנתי':         'insurance',
  'העברה לקרן השתלמות':      'savings',
  'מוסך מורשה':              'car',
};

const AMOUNT_RANGES = {
  groceries:    [80,  350],
  home:         [120, 800],
  fuel:         [160, 290],
  car:          [150, 600],
  medical:      [50,  300],
  entertainment:[35,  150],
  clothing:     [90,  500],
  subscriptions:[20,   90],
  cats:         [55,  300],
  insurance:    [160, 400],
  fees:         [12,   55],
  electronics:  [200, 1500],
  grooming:     [75,  200],
  vacation:     [350, 2000],
  gifts:        [90,  500],
  sports:       [85,  280],
  other:        [35,  180],
};

// Exactly 20 items
const ISRACARD1_CATS = [
  'groceries','groceries','groceries',
  'fuel','fuel',
  'car',
  'medical','medical',
  'entertainment','entertainment',
  'clothing',
  'subscriptions',
  'insurance',
  'fees',
  'grooming',
  'sports','sports',
  'other','other','other',
];

// Exactly 8 items
const ISRACARD2_CATS = [
  'groceries',
  'clothing','clothing',
  'medical',
  'grooming',
  'entertainment',
  'subscriptions',
  'other',
];

// Exactly 15 items
const MAX1_CATS = [
  'fuel','fuel',
  'home','home',
  'car',
  'electronics',
  'vacation',
  'gifts',
  'sports','sports',
  'subscriptions',
  'medical',
  'other','other','other',
];

// Exactly 7 items
const MAX2_CATS = [
  'groceries','groceries',
  'clothing',
  'subscriptions',
  'cats',
  'grooming',
  'other',
];

// Special bank transactions per period (index 0=Nov2024 .. 4=Mar2025)
const SPECIAL_BANK_DATA = [
  [{ desc: 'בונוס רבעוני', isCredit: true, amount: 8500, tag: 'large_income', d1: 10, d2: 15 }],
  [{ desc: 'תגמול שנתי', isCredit: true, amount: 12000, tag: 'large_income', d1: 8, d2: 12 }],
  [{ desc: 'החזר מס הכנסה', isCredit: true, amount: 5600, tag: 'large_income', d1: 20, d2: 25 }],
  [{ desc: 'תשלום פרילנס', isCredit: true, amount: 7200, tag: 'large_income', d1: 10, d2: 18 }],
  [
    { desc: 'מענק יוצאי דופן', isCredit: true, amount: 4500, tag: 'large_income', d1: 15, d2: 20 },
    { desc: 'ביטוח חיים שנתי', isCredit: false, amount: 3200, tag: 'large_expense', d1: 5, d2: 10 },
  ],
];

// Special CC transactions added to Max1 per period
const SPECIAL_CC_DATA = [
  [],
  [{ merchant: 'IKEA', category: 'home', amount: 3200, tag: 'large_expense' }],
  [{ merchant: 'מוסך מורשה', category: 'car', amount: 2800, tag: 'large_expense' }],
  [
    { merchant: 'ישרוטל אילת', category: 'vacation', amount: 2400, tag: 'large_expense' },
    { merchant: 'El Al', category: 'vacation', amount: 1800, tag: 'large_expense' },
  ],
  [{ merchant: 'iDigital', category: 'electronics', amount: 4200, tag: 'large_expense' }],
];

// 7th Hapoalim transaction varies per period
const HAPOALIM_EXTRA = [
  () => ({ desc: 'ביטוח לאומי', isCredit: false, d1: 5,  d2: 10, amount: randInt(150, 200) }),
  () => ({ desc: 'קופת חולים מכבי', isCredit: false, d1: 8, d2: 12, amount: randInt(180, 220) }),
  () => ({ desc: 'פלאפון תקשורת', isCredit: false, d1: 5, d2: 10, amount: randInt(100, 150) }),
  () => ({ desc: 'שיפוץ ועד הבית', isCredit: false, d1: 12, d2: 18, amount: randInt(800, 1200) }),
  () => ({ desc: 'רישום רכב שנתי', isCredit: false, d1: 10, d2: 15, amount: randInt(400, 600) }),
];

function randInt(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

function randFloat(min, max) {
  return Math.round((min + Math.random() * (max - min)) * 100) / 100;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function fmt(y, m, d) {
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function rDate(y, m, d1, d2) {
  const last = new Date(y, m, 0).getDate();
  return fmt(y, m, Math.min(last, randInt(d1, Math.min(d2, last))));
}

function computeRunningBalance(txs, startBalance) {
  let bal = startBalance;
  return txs
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(tx => {
      bal = Math.round((bal + (tx.credit || 0) - (tx.debit || 0)) * 100) / 100;
      return { ...tx, balance: bal };
    });
}

function makeLeumiTxs(idx, year, month, maleName, employer, savingsInst, ccChargeTotal, opts = {}) {
  const specialBankEntries = opts.specialBankEntries ?? SPECIAL_BANK_DATA[idx];
  const largeSavingsAmount = opts.largeSavingsAmount ?? 0;

  const txs = [
    {
      date: rDate(year, month, 1, 5),
      description: `משכורת ${maleName} - ${employer}`,
      credit: randInt(12000, 15000), debit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'salary_sagi',
    },
    {
      date: rDate(year, month, 1, 3),
      description: 'בנק לאומי משכנתא',
      debit: 4200, credit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'routine_expense',
    },
    {
      date: rDate(year, month, 3, 8),
      description: `העברה ל${savingsInst}`,
      debit: randInt(800, 2000), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'savings',
    },
    {
      date: rDate(year, month, 10, 20),
      description: 'ארנונה עיריית תל אביב',
      debit: randInt(680, 720), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'routine_expense',
    },
    {
      date: rDate(year, month, 5, 15),
      description: 'שכירות נכס רמת גן',
      credit: randInt(3800, 4500), debit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'routine_income',
    },
    {
      date: rDate(year, month, 15, 20),
      description: `ישראכרט חיוב ${maleName}`,
      debit: Math.round(ccChargeTotal), credit: null,
      is_credit_card: 1, credit_card_name: `ישראכרט ראשי - ${maleName}`, tag: null,
    },
    {
      date: rDate(year, month, 18, 25),
      description: 'חברת החשמל',
      debit: randInt(200, 480), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: null,
    },
    {
      date: rDate(year, month, 18, 25),
      description: 'מי אביב',
      debit: randInt(80, 150), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: null,
    },
    {
      date: rDate(year, month, 5, 10),
      description: 'סלקום תקשורת',
      debit: randInt(120, 180), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: null,
    },
    {
      date: rDate(year, month, 5, 10),
      description: 'בזק אינטרנט',
      debit: randInt(80, 130), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: null,
    },
    {
      date: rDate(year, month, 1, 10),
      description: 'הראל ביטוח דירה',
      debit: randInt(200, 350), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: null,
    },
    {
      date: rDate(year, month, 28, 30),
      description: 'עמלת ניהול חשבון',
      debit: randInt(25, 45), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: null,
    },
  ];

  if (largeSavingsAmount > 0) {
    txs.push({
      date: rDate(year, month, 10, 20),
      description: 'העברה לקרן השתלמות',
      debit: largeSavingsAmount, credit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'savings',
    });
  }

  for (const sp of specialBankEntries) {
    txs.push({
      date: rDate(year, month, sp.d1, sp.d2),
      description: sp.desc,
      credit: sp.isCredit ? sp.amount : null,
      debit: sp.isCredit ? null : sp.amount,
      is_credit_card: 0, credit_card_name: null, tag: sp.tag,
    });
  }

  return txs;
}

function makeHapoalimTxs(idx, year, month, femaleName, employer, savingsInst, i2ChargeTotal, maxChargeTotal) {
  const extra = HAPOALIM_EXTRA[idx]();
  return [
    {
      date: rDate(year, month, 1, 5),
      description: `משכורת ${femaleName} - ${employer}`,
      credit: randInt(9500, 12000), debit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'salary_maya',
    },
    {
      date: rDate(year, month, 3, 8),
      description: `העברה ל${savingsInst}`,
      debit: randInt(500, 1500), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'savings',
    },
    {
      date: rDate(year, month, 15, 20),
      description: `ישראכרט חיוב ${femaleName}`,
      debit: Math.round(i2ChargeTotal), credit: null,
      is_credit_card: 1, credit_card_name: `ישראכרט משני - ${femaleName}`, tag: null,
    },
    {
      date: rDate(year, month, 18, 22),
      description: 'מקס חיוב כרטיס',
      debit: Math.round(maxChargeTotal), credit: null,
      is_credit_card: 1, credit_card_name: 'מקס', tag: null,
    },
    {
      date: rDate(year, month, 5, 12),
      description: 'שכירות דירת גבעתיים',
      credit: randInt(2000, 3000), debit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'routine_income',
    },
    {
      date: rDate(year, month, 1, 5),
      description: 'ועד הבית',
      debit: randInt(300, 600), credit: null,
      is_credit_card: 0, credit_card_name: null, tag: 'routine_expense',
    },
    {
      date: rDate(year, month, extra.d1, extra.d2),
      description: extra.desc,
      debit: extra.isCredit ? null : extra.amount,
      credit: extra.isCredit ? extra.amount : null,
      is_credit_card: 0, credit_card_name: null, tag: null,
    },
  ];
}

function makeCCTxs(company, owner, last4, cardName, categories, specialItems, year, month, multiplier = 1) {
  const monthKey = `${year}-${String(month).padStart(2, '0')}`;
  const txs = [];

  for (const cat of categories) {
    const [min, max] = AMOUNT_RANGES[cat];
    txs.push({
      date: rDate(year, month, 1, 27),
      merchant: pick(MERCHANTS[cat]),
      amount: randFloat(min * multiplier, max * multiplier),
      category: cat,
      card_last4: last4,
      source_company: company,
      notes: null,
      month_key: monthKey,
      card_name: cardName,
      owner,
      tag: null,
      tag_note: '',
    });
  }

  for (const sp of specialItems) {
    txs.push({
      date: rDate(year, month, 10, 25),
      merchant: sp.merchant,
      amount: sp.amount,
      category: sp.category,
      card_last4: last4,
      source_company: company,
      notes: null,
      month_key: monthKey,
      card_name: cardName,
      owner,
      tag: sp.tag,
      tag_note: '',
    });
  }

  return txs;
}

function generateDemoData() {
  const maleName  = pick(MALE_NAMES);
  const femaleName = pick(FEMALE_NAMES);

  const PERIODS = [
    { year: 2024, month: 11, idx: 0 },
    { year: 2024, month: 12, idx: 1 },
    { year: 2025, month:  1, idx: 2 },
    { year: 2025, month:  2, idx: 3 },
    { year: 2025, month:  3, idx: 4 },
  ];

  // Deficit month: pick from middle periods only (not first/last) for cleaner chart shape
  const deficitIdx = pick([1, 2, 3]);
  // High-savings month: any period except the deficit one
  const highSavingsIdx = pick([0, 1, 2, 3, 4].filter(i => i !== deficitIdx));

  let leumiBalance    = 84250;
  let hapoalimBalance = 51380;

  const periods = [];

  for (const { year, month, idx } of PERIODS) {
    const periodKey      = `${year}-${String(month).padStart(2, '0')}`;
    const savingsLeumi   = SAVINGS_INSTS[idx % SAVINGS_INSTS.length];
    const savingsHapoa   = SAVINGS_INSTS[(idx + 2) % SAVINGS_INSTS.length];
    const maleEmployer   = MALE_EMPLOYERS[idx % MALE_EMPLOYERS.length];
    const femaleEmployer = FEMALE_EMPLOYERS[idx % FEMALE_EMPLOYERS.length];

    const i1Name = `ישראכרט ראשי - ${maleName}`;
    const i2Name = `ישראכרט משני - ${femaleName}`;
    const m1Name = `מקס ראשי - ${maleName}`;
    const m2Name = `מקס משני - ${femaleName}`;

    const isDeficit     = idx === deficitIdx;
    const isHighSavings = idx === highSavingsIdx;
    const ccMultiplier  = isDeficit ? 1.4 : 1;

    const i1Txs = makeCCTxs('isracard', 'sagi', '4321', i1Name, ISRACARD1_CATS, [], year, month, ccMultiplier);
    const i2Txs = makeCCTxs('isracard', 'maya', '8765', i2Name, ISRACARD2_CATS, [], year, month, ccMultiplier);
    const m1Txs = makeCCTxs('max', 'sagi', '2109', m1Name, MAX1_CATS, SPECIAL_CC_DATA[idx], year, month, ccMultiplier);
    const m2Txs = makeCCTxs('max', 'maya', '6543', m2Name, MAX2_CATS, [], year, month, ccMultiplier);

    const i1Total = i1Txs.reduce((s, t) => s + t.amount, 0);
    const i2Total = i2Txs.reduce((s, t) => s + t.amount, 0);
    const m1Total = m1Txs.reduce((s, t) => s + t.amount, 0);
    const m2Total = m2Txs.reduce((s, t) => s + t.amount, 0);

    const rawLeumi = makeLeumiTxs(idx, year, month, maleName, maleEmployer, savingsLeumi, i1Total, {
      specialBankEntries: isDeficit
        ? SPECIAL_BANK_DATA[idx].filter(sp => sp.tag !== 'large_income')
        : SPECIAL_BANK_DATA[idx],
      largeSavingsAmount: isHighSavings ? randInt(10000, 18000) : 0,
    });
    const rawHapoalim = makeHapoalimTxs(idx, year, month, femaleName, femaleEmployer, savingsHapoa, i2Total, m1Total + m2Total);

    const leumiWithBal    = computeRunningBalance(rawLeumi, leumiBalance);
    const hapoalimWithBal = computeRunningBalance(rawHapoalim, hapoalimBalance);

    leumiBalance    = leumiWithBal[leumiWithBal.length - 1]?.balance    ?? leumiBalance;
    hapoalimBalance = hapoalimWithBal[hapoalimWithBal.length - 1]?.balance ?? hapoalimBalance;

    periods.push({
      year, month, periodKey,
      leumiTransactions:    leumiWithBal,
      hapoalimTransactions: hapoalimWithBal,
      ccUploads: [
        { company: 'isracard', card_name: i1Name, card_last4: '4321', owner: 'sagi', period: periodKey, transactions: i1Txs },
        { company: 'isracard', card_name: i2Name, card_last4: '8765', owner: 'maya', period: periodKey, transactions: i2Txs },
        { company: 'max',      card_name: m1Name, card_last4: '2109', owner: 'sagi', period: periodKey, transactions: m1Txs },
        { company: 'max',      card_name: m2Name, card_last4: '6543', owner: 'maya', period: periodKey, transactions: m2Txs },
      ],
    });
  }

  // Build merchant → category map for merchant_categories table.
  // Start with bank descriptions, then layer CC merchants on top.
  const merchantCategories = { ...BANK_CATEGORIES };
  for (const [cat, merchants] of Object.entries(MERCHANTS)) {
    for (const m of merchants) {
      merchantCategories[m] = cat;
    }
  }

  return { maleName, femaleName, periods, merchantCategories };
}

module.exports = { generateDemoData };

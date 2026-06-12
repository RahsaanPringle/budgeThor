const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'bank_data.json');
let raw = fs.readFileSync(filePath, 'utf8');
raw = raw.replace(/^\uFEFF/, '');
const data = JSON.parse(raw);

const GENERIC_STOP_WORDS = new Set([
  'PIN', 'PUR', 'ONLINE', 'PMT', 'WEB', 'TFR', 'FR', 'DEP', 'ACH',
  'CHECK', 'CKF', 'DDA', 'REC', 'SIG', 'SIGN', 'ATM', 'XFER', 'INVOICE'
]);

function normalizeExternalAccountKey(description) {
  const desc = String(description).toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ');
  const tokens = desc.split(/\s+/).filter(Boolean);
  const normalized = [];

  for (const token of tokens) {
    if (/\d/.test(token)) {
      if (token.startsWith('X') || token.startsWith('#') || /^\d+$/.test(token)) {
        continue;
      }
    }
    if (GENERIC_STOP_WORDS.has(token)) {
      break;
    }
    normalized.push(token);
    if (normalized.length >= 5) {
      break;
    }
  }

  if (normalized.length === 0) {
    return tokens.filter(token => !GENERIC_STOP_WORDS.has(token)).slice(0, 5).join(' ').trim() || tokens.slice(0, 5).join(' ').trim();
  }

  return normalized.join(' ').trim();
}

function assignTransactionIds(dataObj) {
  for (const [accountKey, accountValue] of Object.entries(dataObj)) {
    if (!accountValue || !Array.isArray(accountValue.transactions)) continue;
    accountValue.transactions.forEach((tx, index) => {
      tx.id = `${accountKey}-${String(index + 1).padStart(4, '0')}`;
      tx.repeatAccountId = null;
    });
  }
}

function buildRepeatAccountDataset(dataObj, minCount = 2, minTotalAbs = 1000) {
  const groups = new Map();
  const transactionMap = new Map();

  for (const [accountKey, accountValue] of Object.entries(dataObj)) {
    if (!accountValue || !Array.isArray(accountValue.transactions)) continue;
    for (const tx of accountValue.transactions) {
      transactionMap.set(tx.id, tx);
      const key = normalizeExternalAccountKey(tx.description || '');
      if (!key) continue;

      const entry = groups.get(key) || {
        key,
        transactionIds: [],
        totalAmount: 0,
        totalAbsoluteAmount: 0,
        accounts: new Set(),
      };

      const amount = Number(tx.amount) || 0;
      entry.transactionIds.push(tx.id);
      entry.totalAmount += amount;
      entry.totalAbsoluteAmount += Math.abs(amount);
      entry.accounts.add(accountKey);
      groups.set(key, entry);
    }
  }

  const validGroups = Array.from(groups.values()).filter(group => group.transactionIds.length >= minCount && group.totalAbsoluteAmount >= minTotalAbs);
  validGroups.sort((a, b) => b.totalAbsoluteAmount - a.totalAbsoluteAmount);

  const repeatAccounts = validGroups.map((group, index) => {
    const repeatAccountId = `repeatAccount-${String(index + 1).padStart(3, '0')}`;
    group.transactionIds.forEach(txId => {
      const tx = transactionMap.get(txId);
      if (tx) tx.repeatAccountId = repeatAccountId;
    });

    return {
      id: repeatAccountId,
      name: group.key,
      key: group.key,
      category: group.totalAmount > 0 ? 'income' : group.totalAmount < 0 ? 'expense' : 'neutral',
      transactionCount: group.transactionIds.length,
      totalAmount: Number(group.totalAmount.toFixed(2)),
      totalAbsoluteAmount: Number(group.totalAbsoluteAmount.toFixed(2)),
      accounts: Array.from(group.accounts).sort(),
    };
  });

  return repeatAccounts;
}

assignTransactionIds(data);
const repeatAccounts = buildRepeatAccountDataset(data);

data.repeatAccounts = repeatAccounts;
fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
console.log(`Updated ${filePath} with ${repeatAccounts.length} repeat account group(s).`);

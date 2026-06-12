import csv
import json
import re
from datetime import datetime

# Read the three CSV files
csv_files = {
    'boa': 'BOA Personal.csv',
    'htbBiz': 'HTB Business.csv',
    'htbPer': 'HTB Personal.csv'
}

data = {
    'boa': {'name': 'BOA Personal', 'color': '#FF6B35', 'icon': '🏦', 'transactions': []},
    'htbBiz': {'name': 'HTB Business', 'color': '#4ECDC4', 'icon': '💼', 'transactions': []},
    'htbPer': {'name': 'HTB Personal', 'color': '#95E1D3', 'icon': '👤', 'transactions': []}
}

def parse_amount(amount_str):
    """Parse amount string to float, handling quotes and commas"""
    if isinstance(amount_str, str):
        amount_str = amount_str.strip().strip('"').replace(',', '')
    try:
        return float(amount_str) if amount_str else 0.0
    except:
        return 0.0

def parse_date(date_str):
    """Parse date string to YYYY-MM-DD format"""
    date_str = date_str.strip().strip('"')
    try:
        # Try MM/DD/YYYY format first
        if '/' in date_str:
            dt = datetime.strptime(date_str, '%m/%d/%Y')
            return dt.strftime('%Y-%m-%d')
    except:
        pass
    return date_str

GENERIC_STOP_WORDS = {
    'PIN', 'PUR', 'ONLINE', 'PMT', 'WEB', 'TFR', 'FR', 'DEP', 'ACH',
    'CHECK', 'CKF', 'DDA', 'REC', 'SIG', 'SIGN', 'ATM', 'XFER', 'INVOICE'
}


def normalize_external_account_key(description):
    desc = description.upper()
    desc = re.sub(r'[^A-Z0-9 ]+', ' ', desc)
    tokens = [token for token in desc.split() if token]
    normalized = []

    for token in tokens:
        if re.search(r'\d', token):
            # Ignore numeric tokens and masked account numbers.
            if token.startswith('X') or token.startswith('#') or token.isdigit():
                continue
        if token in GENERIC_STOP_WORDS:
            break
        normalized.append(token)
        if len(normalized) >= 5:
            break

    if not normalized:
        normalized = [token for token in tokens if token not in GENERIC_STOP_WORDS][:5]

    if not normalized:
        normalized = tokens[:5]

    return ' '.join(normalized).strip()


def assign_transaction_ids(data):
    for account_key, account in data.items():
        if not isinstance(account, dict) or 'transactions' not in account:
            continue
        for idx, tx in enumerate(account['transactions'], start=1):
            tx['id'] = f"{account_key}-{idx:04d}"
            tx['repeatAccountId'] = None


def build_repeat_account_dataset(data, min_count=2, min_total_abs=1000.0):
    groups = {}
    transaction_map = {}

    for account_key, account in data.items():
        if not isinstance(account, dict) or 'transactions' not in account:
            continue
        for tx in account['transactions']:
            transaction_map[tx['id']] = tx
            key = normalize_external_account_key(tx.get('description', ''))
            if not key:
                continue

            group = groups.setdefault(key, {
                'key': key,
                'transactionIds': [],
                'totalAmount': 0.0,
                'totalAbsoluteAmount': 0.0,
                'accounts': set()
            })

            group['transactionIds'].append(tx['id'])
            group['totalAmount'] += tx.get('amount', 0.0) if tx.get('amount') is not None else 0.0
            group['totalAbsoluteAmount'] += abs(tx.get('amount', 0.0)) if tx.get('amount') is not None else 0.0
            group['accounts'].add(account_key)

    valid_groups = []
    for key, group in groups.items():
        if len(group['transactionIds']) < min_count:
            continue
        if group['totalAbsoluteAmount'] < min_total_abs:
            continue
        valid_groups.append(group)

    valid_groups.sort(key=lambda x: x['totalAbsoluteAmount'], reverse=True)

    repeat_accounts = []
    for idx, group in enumerate(valid_groups, start=1):
        repeat_account_id = f"repeatAccount-{idx:03d}"
        for tx_id in group['transactionIds']:
            if tx_id in transaction_map:
                transaction_map[tx_id]['repeatAccountId'] = repeat_account_id

        repeat_accounts.append({
            'id': repeat_account_id,
            'name': group['key'],
            'key': group['key'],
            'category': 'income' if group['totalAmount'] > 0 else 'expense' if group['totalAmount'] < 0 else 'neutral',
            'transactionCount': len(group['transactionIds']),
            'totalAmount': round(group['totalAmount'], 2),
            'totalAbsoluteAmount': round(group['totalAbsoluteAmount'], 2),
            'accounts': sorted(group['accounts'])
        })

    return repeat_accounts

# Parse BOA Personal (format: Date, Description, Amount, Running Bal.)
print("Reading BOA Personal...")
try:
    with open(csv_files['boa'], 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        next(reader)  # Skip summary section
        for i in range(4):
            next(reader)
        next(reader)  # Skip blank line
        next(reader)  # Skip column headers
        
        for row in reader:
            if len(row) >= 4:
                date = parse_date(row[0])
                desc = row[1].strip() if len(row) > 1 else ""
                amount = parse_amount(row[2])
                balance = parse_amount(row[3])
                
                if date and desc:  # Only add valid rows
                    data['boa']['transactions'].append({
                        'date': date,
                        'description': desc,
                        'amount': amount,
                        'balance': balance
                    })
except Exception as e:
    print(f"Error reading BOA: {e}")

# Parse HTB Business (format: Date, ReferenceNo., Type, Description, Debit, Credit, CheckNumber, Balance)
print("Reading HTB Business...")
try:
    with open(csv_files['htbBiz'], 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        
        for row in reader:
            if len(row) >= 8 and row[0].strip():
                date = parse_date(row[0])
                tx_type = row[2].strip() if len(row) > 2 else ""
                desc = row[3].strip() if len(row) > 3 else ""
                debit = parse_amount(row[4])
                credit = parse_amount(row[5])
                balance = parse_amount(row[7])
                
                amount = credit if credit > 0 else -debit
                
                if date and desc:
                    data['htbBiz']['transactions'].append({
                        'date': date,
                        'description': desc,
                        'amount': amount,
                        'balance': balance
                    })
except Exception as e:
    print(f"Error reading HTB Business: {e}")

# Parse HTB Personal (same format as HTB Business)
print("Reading HTB Personal...")
try:
    with open(csv_files['htbPer'], 'r', encoding='utf-8') as f:
        reader = csv.reader(f)
        next(reader)  # Skip header
        
        for row in reader:
            if len(row) >= 8 and row[0].strip():
                date = parse_date(row[0])
                tx_type = row[2].strip() if len(row) > 2 else ""
                desc = row[3].strip() if len(row) > 3 else ""
                debit = parse_amount(row[4])
                credit = parse_amount(row[5])
                balance = parse_amount(row[7])
                
                amount = credit if credit > 0 else -debit
                
                if date and desc:
                    data['htbPer']['transactions'].append({
                        'date': date,
                        'description': desc,
                        'amount': amount,
                        'balance': balance
                    })
except Exception as e:
    print(f"Error reading HTB Personal: {e}")

# Sort transactions by date
for key in data:
    data[key]['transactions'].sort(key=lambda x: x['date'])

assign_transaction_ids(data)

# Build repeat-account dataset
repeat_accounts = build_repeat_account_dataset(data)
data['repeatAccounts'] = repeat_accounts

# Print summary
for key in data:
    if key == 'repeatAccounts':
        print(f"Repeat account groups: {len(data['repeatAccounts'])}")
        continue
    print(f"{data[key]['name']}: {len(data[key]['transactions'])} transactions")
    if data[key]['transactions']:
        print(f"  Date range: {data[key]['transactions'][0]['date']} to {data[key]['transactions'][-1]['date']}")
        print(f"  Final balance: ${data[key]['transactions'][-1]['balance']:.2f}")

# Output JSON
json_data = json.dumps(data, indent=2)
with open('bank_data.json', 'w', encoding='utf-8') as outfile:
    outfile.write(json_data)
print(f"\nJSON size: {len(json_data)} bytes")
print('Updated bank_data.json with repeat account dataset.')

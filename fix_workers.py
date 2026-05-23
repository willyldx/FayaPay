import re

# Fix timeout_worker.go - txn.ID -> &txn.ID
with open('/opt/kadryza/internal/workers/timeout_worker.go', 'r') as f:
    content = f.read()

old = '\t\tTransactionID: txn.ID,'
new = '\t\tTransactionID: &txn.ID,'

if old in content:
    content = content.replace(old, new)
    with open('/opt/kadryza/internal/workers/timeout_worker.go', 'w') as f:
        f.write(content)
    print("Fixed timeout_worker.go")
else:
    print(f"NOT FOUND in timeout_worker.go: {repr(old)}")

# Fix webhook_worker.go - txID -> &txID (two occurrences)
with open('/opt/kadryza/internal/workers/webhook_worker.go', 'r') as f:
    content = f.read()

old_tx = '\t\tTransactionID: txID,'
new_tx = '\t\tTransactionID: &txID,'
count = content.count(old_tx)

if count > 0:
    content = content.replace(old_tx, new_tx)
    with open('/opt/kadryza/internal/workers/webhook_worker.go', 'w') as f:
        f.write(content)
    print(f"Fixed webhook_worker.go ({count} occurrences)")
else:
    print(f"NOT FOUND in webhook_worker.go: {repr(old_tx)}")

# Also fix merchant_service.go - TransactionID is missing (uses zero value)
# We need to pass nil for merchant audit logs
with open('/opt/kadryza/internal/services/merchant_service.go', 'r') as f:
    content = f.read()

# Find all CreateAuditLog calls in merchant_service that don't have TransactionID
import re
# Add TransactionID: nil where it's missing
pattern = r'(qtx\.CreateAuditLog\(ctx, db\.CreateAuditLogParams\{)\n(\t\tMerchantID:)'
replacement = r'\1\n\t\tTransactionID: nil,\n\2'
new_content = re.sub(pattern, replacement, content)

if new_content != content:
    with open('/opt/kadryza/internal/services/merchant_service.go', 'w') as f:
        f.write(new_content)
    print("Fixed merchant_service.go - added TransactionID: nil")
else:
    # Check if it already has TransactionID
    if 'TransactionID:' in content:
        print("merchant_service.go already has TransactionID fields")
    else:
        print("merchant_service.go - no CreateAuditLog pattern matched")
        idx = content.find('CreateAuditLog')
        print(repr(content[idx:idx+200]))

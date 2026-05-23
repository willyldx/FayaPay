
# Fix transaction_service.go - same pattern
with open('/opt/kadryza/internal/services/transaction_service.go', 'r') as f:
    content = f.read()

# Fix txn.ID -> &txn.ID
count1 = content.count('\t\tTransactionID: txn.ID,')
content = content.replace('\t\tTransactionID: txn.ID,', '\t\tTransactionID: &txn.ID,')

# Fix txID -> &txID
count2 = content.count('\t\tTransactionID: txID,')
content = content.replace('\t\tTransactionID: txID,', '\t\tTransactionID: &txID,')

with open('/opt/kadryza/internal/services/transaction_service.go', 'w') as f:
    f.write(content)

print(f"Fixed transaction_service.go: txn.ID={count1}, txID={count2}")

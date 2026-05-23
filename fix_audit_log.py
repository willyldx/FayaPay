content = open('/opt/kadryza/internal/db/sqlc/audit_logs.sql.go').read()

# Fix 1: Change TransactionID type in CreateAuditLogParams
old1 = '''type CreateAuditLogParams struct {
\tTransactionID uuid.UUID `json:"transaction_id"`
\tMerchantID    uuid.UUID `json:"merchant_id"`
\tEventType     string    `json:"event_type"`
\tPayload       []byte    `json:"payload"`
}'''

new1 = '''type CreateAuditLogParams struct {
\tTransactionID *uuid.UUID `json:"transaction_id"`
\tMerchantID    uuid.UUID  `json:"merchant_id"`
\tEventType     string     `json:"event_type"`
\tPayload       []byte     `json:"payload"`
}'''

# Fix 2: Change AuditLog return struct
old2 = '''type AuditLog struct {
\tID            uuid.UUID `json:"id"`
\tTransactionID uuid.UUID `json:"transaction_id"`'''

new2 = '''type AuditLog struct {
\tID            uuid.UUID  `json:"id"`
\tTransactionID *uuid.UUID `json:"transaction_id"`'''

# Fix 3: Change Scan to handle nullable
old3 = '''\terr := row.Scan(
\t\t&i.ID,
\t\t&i.TransactionID,
\t\t&i.MerchantID,
\t\t&i.EventType,
\t\t&i.Payload,
\t\t&i.CreatedAt,
\t)'''

new3 = '''\terr := row.Scan(
\t\t&i.ID,
\t\t&i.TransactionID,
\t\t&i.MerchantID,
\t\t&i.EventType,
\t\t&i.Payload,
\t\t&i.CreatedAt,
\t)'''

found1 = old1 in content
found2 = old2 in content

print(f"CreateAuditLogParams found: {found1}")
print(f"AuditLog struct found: {found2}")

if found1:
    content = content.replace(old1, new1)
    print("Fixed CreateAuditLogParams")

open('/opt/kadryza/internal/db/sqlc/audit_logs.sql.go', 'w').write(content)

# Now fix models.go
models_content = open('/opt/kadryza/internal/db/sqlc/models.go').read()
if old2 in models_content:
    models_content = models_content.replace(old2, new2)
    open('/opt/kadryza/internal/db/sqlc/models.go', 'w').write(models_content)
    print("Fixed models.go AuditLog struct")
else:
    print("AuditLog struct in models.go not found, checking...")
    idx = models_content.find('TransactionID')
    print(repr(models_content[max(0,idx-50):idx+100]))

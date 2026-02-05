# Idempotency Implementation Checklist

## Key Generation

- [ ] Keys are deterministic (same input = same key)
- [ ] Keys include all relevant parameters
- [ ] Keys are scoped appropriately (user, endpoint, etc.)
- [ ] Keys use consistent hash algorithm (SHA-256)
- [ ] Keys are reasonable length (32-64 chars)

## API Endpoints

- [ ] POST/PUT/PATCH endpoints support Idempotency-Key header
- [ ] Idempotency key format is documented
- [ ] Key is validated (format, length)
- [ ] Duplicate requests return cached response
- [ ] Response includes header indicating replay

## Storage

- [ ] Redis used for fast lookups
- [ ] Database used for durability
- [ ] TTL configured appropriately (24-72 hours)
- [ ] Cleanup job for expired records
- [ ] Storage sized for expected volume

## Race Conditions

- [ ] Database constraint prevents duplicates
- [ ] Check-and-insert is atomic
- [ ] Lost updates are prevented
- [ ] Concurrent requests handled correctly

## Response Handling

- [ ] Only successful responses cached (2xx)
- [ ] Error responses allow retry
- [ ] Response body stored completely
- [ ] Status code preserved
- [ ] Headers preserved if needed

## Event Processing

- [ ] Events include idempotency key
- [ ] Consumer checks before processing
- [ ] Processed events tracked
- [ ] At-least-once delivery handled
- [ ] Dead letter queue for failures

## Error Cases

- [ ] Missing key handled (process normally or reject)
- [ ] Invalid key format rejected
- [ ] Storage failures don't break processing
- [ ] Timeout during processing handled

## Testing

- [ ] Duplicate request returns same response
- [ ] Different keys process independently
- [ ] Race condition tests pass
- [ ] TTL expiration verified
- [ ] Cache miss falls back to database

## Documentation

- [ ] Idempotency behavior documented
- [ ] Key format documented
- [ ] TTL window documented
- [ ] Client retry guidance provided

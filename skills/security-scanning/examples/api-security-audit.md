# API Security Audit Example

Complete security review of a FastAPI endpoint.

## The Endpoint

```python
@router.post("/api/v1/users/{user_id}/transfer")
async def transfer_funds(
    user_id: int,
    amount: float,
    to_account: str,
    db: Session = Depends(get_db)
):
    user = db.query(User).get(user_id)
    user.balance -= amount
    recipient = db.query(User).filter(User.account == to_account).first()
    recipient.balance += amount
    db.commit()
    return {"status": "success"}
```

## Security Issues Found

### 1. 🔴 CRITICAL: No Authentication

**Issue:** Endpoint accepts any user_id without verifying caller identity.

**Fix:**
```python
@router.post("/api/v1/users/me/transfer")
async def transfer_funds(
    amount: float,
    to_account: str,
    current_user: User = Depends(get_current_user),  # JWT/session auth
    db: Session = Depends(get_db)
):
```

### 2. 🔴 CRITICAL: No Authorization

**Issue:** User can transfer from ANY account, not just their own.

**Fix:** Remove user_id from path, use authenticated user only.

### 3. 🔴 HIGH: Race Condition

**Issue:** No transaction isolation. Concurrent requests can overdraw.

**Fix:**
```python
async def transfer_funds(...):
    async with db.begin():  # Transaction
        user = await db.execute(
            select(User).where(User.id == current_user.id).with_for_update()
        )
        # ... rest of logic
```

### 4. 🟡 MEDIUM: No Input Validation

**Issue:** Negative amounts could credit attacker's account.

**Fix:**
```python
from pydantic import BaseModel, Field

class TransferRequest(BaseModel):
    amount: float = Field(gt=0, le=10000)  # Positive, max limit
    to_account: str = Field(regex=r'^[A-Z0-9]{10}$')  # Format validation
```

### 5. 🟡 MEDIUM: No Rate Limiting

**Issue:** Attacker can brute-force account numbers.

**Fix:**
```python
from slowapi import Limiter

limiter = Limiter(key_func=get_remote_address)

@router.post("/api/v1/users/me/transfer")
@limiter.limit("5/minute")
async def transfer_funds(...):
```

### 6. 🟡 MEDIUM: Float for Money

**Issue:** Float precision errors in financial calculations.

**Fix:**
```python
from decimal import Decimal
amount: Decimal = Field(decimal_places=2)
```

### 7. 🟢 LOW: Missing Audit Log

**Fix:**
```python
await audit_log.record(
    action="transfer",
    user_id=current_user.id,
    amount=amount,
    to_account=to_account,
    ip=request.client.host,
    timestamp=datetime.utcnow()
)
```

## Secured Version

```python
from decimal import Decimal
from pydantic import BaseModel, Field
from slowapi import Limiter

class TransferRequest(BaseModel):
    amount: Decimal = Field(gt=0, le=Decimal("10000"), decimal_places=2)
    to_account: str = Field(regex=r'^[A-Z0-9]{10}$')

@router.post("/api/v1/transfers")
@limiter.limit("5/minute")
async def transfer_funds(
    request: TransferRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    async with db.begin():
        # Lock sender's row to prevent race conditions
        sender = await db.execute(
            select(User)
            .where(User.id == current_user.id)
            .with_for_update()
        )
        sender = sender.scalar_one()

        if sender.balance < request.amount:
            raise HTTPException(400, "Insufficient funds")

        recipient = await db.execute(
            select(User).where(User.account == request.to_account)
        )
        recipient = recipient.scalar_one_or_none()
        if not recipient:
            raise HTTPException(404, "Recipient not found")

        sender.balance -= request.amount
        recipient.balance += request.amount

        await audit_log.record(
            action="transfer",
            user_id=current_user.id,
            details={"amount": str(request.amount), "to": request.to_account}
        )

    return {"status": "success", "new_balance": str(sender.balance)}
```

## Checklist Summary

- [x] Authentication required
- [x] Authorization enforced
- [x] Input validation (Pydantic)
- [x] Rate limiting
- [x] Transaction isolation
- [x] Decimal for money
- [x] Audit logging
- [ ] Idempotency key (for retries)
- [ ] 2FA for high-value transfers

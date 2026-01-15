# Environment Management

Secrets management, configuration, and environment variable patterns.

## External Secrets Operator

Sync secrets from cloud providers to Kubernetes:

```yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: app-secrets
spec:
  refreshInterval: 1h
  secretStoreRef:
    name: aws-secrets-manager
    kind: ClusterSecretStore
  target:
    name: app-secrets
    creationPolicy: Owner
  data:
    - secretKey: database-url
      remoteRef:
        key: prod/app/database
        property: url
    - secretKey: api-key
      remoteRef:
        key: prod/app/api-keys
        property: main
```

**Supported backends:**
- AWS Secrets Manager
- HashiCorp Vault
- Azure Key Vault
- GCP Secret Manager

## GitOps with ArgoCD

ArgoCD watches Git repository and syncs cluster state:

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: myapp
  namespace: argocd
spec:
  project: default
  source:
    repoURL: https://github.com/org/repo
    targetRevision: HEAD
    path: k8s/overlays/production
  destination:
    server: https://kubernetes.default.svc
    namespace: production
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
    retry:
      limit: 5
      backoff:
        duration: 5s
        maxDuration: 3m
```

**Features:**
- Automated sync with pruning
- Self-healing (drift detection)
- Retry policies for transient failures

## Infrastructure as Code (Terraform)

**Remote state in S3 with DynamoDB locking:**

```hcl
terraform {
  required_version = ">= 1.5"
  backend "s3" {
    bucket         = "terraform-state"
    key            = "prod/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "terraform-locks"
  }
}
```

**Module-based architecture:**
```hcl
module "vpc" {
  source = "./modules/vpc"
  cidr   = "10.0.0.0/16"
}

module "eks" {
  source     = "./modules/eks"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnets
}

module "rds" {
  source     = "./modules/rds"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.database_subnets
}
```

**Environment-specific tfvars:**
```bash
terraform plan -var-file=environments/production.tfvars
```

## Database Migration Strategies

### Zero-Downtime Migration Pattern

**Problem:** Adding a NOT NULL column breaks old application versions

**Solution: 3-phase migration**

**Phase 1: Add nullable column**
```sql
-- Migration v1 (deploy with old code still running)
ALTER TABLE users ADD COLUMN email VARCHAR(255);
```

**Phase 2: Deploy new code + backfill**
```python
# New code writes to both old and new schema
def create_user(name: str, email: str):
    db.execute("INSERT INTO users (name, email) VALUES (%s, %s)", (name, email))

# Backfill existing rows
async def backfill_emails():
    users_without_email = await db.fetch("SELECT id FROM users WHERE email IS NULL")
    for user in users_without_email:
        email = generate_email(user.id)
        await db.execute("UPDATE users SET email = %s WHERE id = %s", (email, user.id))
```

**Phase 3: Add constraint**
```sql
-- Migration v2 (after backfill complete)
ALTER TABLE users ALTER COLUMN email SET NOT NULL;
```

### Backward/Forward Compatibility

**Backward compatible changes (safe):**
- Add nullable column
- Add table
- Add index
- Rename column (with view alias)

**Backward incompatible changes (requires 3-phase):**
- Remove column
- Rename column (no alias)
- Add NOT NULL column
- Change column type

### Alembic Migration Pattern

```python
# backend/alembic/versions/2024_12_15_add_langfuse_trace_id.py
"""Add Langfuse trace_id to analyses"""
from alembic import op
import sqlalchemy as sa

def upgrade():
    # Add nullable column first (backward compatible)
    op.add_column('analyses',
        sa.Column('langfuse_trace_id', sa.String(255), nullable=True)
    )
    # Index for lookup performance
    op.create_index('idx_analyses_langfuse_trace',
        'analyses', ['langfuse_trace_id']
    )

def downgrade():
    op.drop_index('idx_analyses_langfuse_trace')
    op.drop_column('analyses', 'langfuse_trace_id')
```

**Migration workflow:**
```bash
# Create new migration
poetry run alembic revision --autogenerate -m "Add langfuse trace ID"

# Review generated migration (ALWAYS review!)
cat alembic/versions/abc123_add_langfuse_trace_id.py

# Apply migration
poetry run alembic upgrade head

# Rollback if needed
poetry run alembic downgrade -1
```

## Rollback Procedures

```bash
# Helm rollback to previous revision
helm rollback myapp 3

# Kubernetes rollback
kubectl rollout undo deployment/myapp

# Database migration rollback (Alembic)
alembic downgrade -1
```

**Critical: Test rollback procedures regularly!**

See `templates/external-secrets.yaml` and `templates/argocd-application.yaml` for complete examples.
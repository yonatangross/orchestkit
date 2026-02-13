# pytest-xdist Parallel Execution

## Distribution Modes

### loadscope (Recommended Default)
Groups tests by module for test functions and by class for test methods. Ideal when fixtures are expensive.

```bash
pytest -n auto --dist loadscope
```

### loadfile
Groups tests by file. Good balance of parallelism and fixture sharing.

```bash
pytest -n auto --dist loadfile
```

### loadgroup
Tests grouped by `@pytest.mark.xdist_group(name="group1")` marker.

```python
@pytest.mark.xdist_group(name="database")
def test_create_user():
    pass

@pytest.mark.xdist_group(name="database")
def test_delete_user():
    pass
```

### load
Round-robin distribution for maximum parallelism. Best when tests are truly independent.

```bash
pytest -n auto --dist load
```

## Worker Isolation

Each worker is completely isolated:
- Global state isn't shared
- Environment variables are independent
- Temp files/databases must be unique per worker

```python
@pytest.fixture(scope="session")
def db_engine(worker_id):
    """Create isolated database per worker."""
    if worker_id == "master":
        db_name = "test_db"  # Not running in parallel
    else:
        db_name = f"test_db_{worker_id}"  # gw0, gw1, etc.

    engine = create_engine(f"postgresql://localhost/{db_name}")
    yield engine
    engine.dispose()
```

## Resource Allocation

```bash
# Auto-detect cores (recommended)
pytest -n auto

# Specific count
pytest -n 4

# Use logical CPUs
pytest -n logical
```

**Warning**: Over-provisioning (e.g., `-n 20` on 4 cores) increases overhead.

## CI/CD Configuration

```yaml
# GitHub Actions
- name: Run tests in parallel
  run: pytest -n auto --dist loadscope -v
  env:
    PYTEST_XDIST_AUTO_NUM_WORKERS: 4  # Override auto detection
```

## Limitations

- `-s/--capture=no` doesn't work with xdist
- Some fixtures may need refactoring for parallelism
- Database tests need worker-isolated databases

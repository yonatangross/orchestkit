# Connection Pool Checklist

## Database Pool Configuration

- [ ] Using `create_async_engine` (not sync engine)
- [ ] `pool_size` matches expected concurrent load
- [ ] `max_overflow` allows for burst traffic
- [ ] `pool_pre_ping=True` for connection validation
- [ ] `pool_recycle` set to prevent stale connections
- [ ] `pool_timeout` set with reasonable wait time

## Connection Health

- [ ] Query timeouts configured (`statement_timeout`)
- [ ] Connection timeouts configured (`connect_timeout`)
- [ ] Dead connection detection enabled
- [ ] Automatic reconnection on failure

## HTTP Session Configuration

- [ ] `aiohttp.ClientSession` created once, reused
- [ ] `TCPConnector` with appropriate limits
- [ ] Per-host connection limit set
- [ ] DNS cache TTL configured
- [ ] SSL context configured if needed

## Lifecycle Management

- [ ] Pools created at application startup
- [ ] Pools closed at application shutdown
- [ ] Graceful shutdown waits for active connections
- [ ] Context managers used for connection checkout

## Monitoring

- [ ] Pool size metrics exposed
- [ ] Available connections tracked
- [ ] Wait time for connections monitored
- [ ] Connection errors logged
- [ ] Alerts for pool exhaustion

## Testing

- [ ] Pool behavior tested under load
- [ ] Connection failure scenarios tested
- [ ] Timeout handling verified
- [ ] Pool recovery after failure tested

## Performance

- [ ] Pool sizing validated with load tests
- [ ] Connection reuse verified (no per-request pools)
- [ ] Latency impact of pool_pre_ping measured
- [ ] max_overflow tuned for burst patterns

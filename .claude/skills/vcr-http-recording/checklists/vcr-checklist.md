# VCR.py Checklist

## Initial Setup

- [ ] Install pytest-recording or vcrpy
- [ ] Configure conftest.py with vcr_config
- [ ] Create cassettes directory
- [ ] Add cassettes to git

## Configuration

- [ ] Set record_mode (once for dev, none for CI)
- [ ] Filter sensitive headers (authorization, api-key)
- [ ] Filter query parameters (token, api_key)
- [ ] Configure body filtering for passwords

## Recording Modes

| Mode | Use Case |
|------|----------|
| `once` | Default - record once, replay after |
| `new_episodes` | Add new requests, keep existing |
| `none` | CI - never record, only replay |
| `all` | Refresh all cassettes |

## Sensitive Data

- [ ] Filter authorization header
- [ ] Filter x-api-key header
- [ ] Filter api_key query parameter
- [ ] Filter passwords in request body
- [ ] Review cassettes before commit

## LLM API Testing

- [ ] Create custom matcher for dynamic fields
- [ ] Ignore request_id, timestamp
- [ ] Match on prompt content
- [ ] Handle streaming responses

## CI/CD

- [ ] Set record_mode to "none" in CI
- [ ] Commit all cassettes
- [ ] Fail on missing cassettes
- [ ] Don't commit real API responses

## Maintenance

- [ ] Refresh cassettes when API changes
- [ ] Remove outdated cassettes
- [ ] Document cassette naming convention
- [ ] Test with fresh cassettes periodically

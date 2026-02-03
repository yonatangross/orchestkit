# GitHub Actions Version → SHA Mapping

This document tracks the SHA commits used for pinning GitHub Actions.
Pinning to SHAs prevents supply chain attacks where a compromised action tag could inject malicious code.

## Why Pin to SHA?

- **Supply chain security**: Tags can be moved to point to different commits
- **Reproducibility**: Exact same action code runs every time
- **Audit trail**: Clear record of which versions are in use

## Current Pinned Versions

| Action | Version | SHA | Last Updated |
|--------|---------|-----|--------------|
| `actions/checkout` | v6 | `8e8c483db84b4bee98b60c0593521ed34d9990e8` | 2026-02 |
| `actions/setup-node` | v6 | `6044e13b5dc448c55e2357c09f80417699197238` | 2026-02 |
| `actions/setup-python` | v6 | `a309ff8b426b58ec0e2a45f0f869d46889d02405` | 2026-02 |
| `actions/upload-artifact` | v5 | `330a01c490aca151604b8cf639adc76d48f6c5d4` | 2026-02 |
| `actions/download-artifact` | v5 | `634f93cb2916e3fdff6788551b99b062d0335ce0` | 2026-02 |
| `actions/cache` | v5 | `cdf6c1fa76f9f475f3d7449005a359c84ca0f306` | 2026-02 |
| `actions/github-script` | v8 | `ed597411d8f924073f98dfc5c65a23a2325f34cd` | 2026-02 |
| `gitleaks/gitleaks-action` | v2 | `dcedce43c6f43de0b836d1fe38946645c9c638dc` | 2026-02 |
| `googleapis/release-please-action` | v4 | `c3fc4de07084f75a2b61a5b933069bda6edf3d5c` | 2026-02 |

## Workflow Files Using Pinned Actions

### `.github/workflows/ci.yml`
- `actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8`
- `actions/setup-node@6044e13b5dc448c55e2357c09f80417699197238`
- `actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4`
- `actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0`
- `gitleaks/gitleaks-action@dcedce43c6f43de0b836d1fe38946645c9c638dc`

### `.github/workflows/build.yml`
- `actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8`
- `actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4`

### `.github/workflows/version-check.yml`
- `actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8`
- `actions/setup-node@6044e13b5dc448c55e2357c09f80417699197238`
- `actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd`

### `.github/workflows/deploy-playgrounds.yml`
- `actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8`
- `actions/setup-node@6044e13b5dc448c55e2357c09f80417699197238`
- `actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd`

### `.github/workflows/mem0-visualization.yml`
- `actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8`
- `actions/setup-python@a309ff8b426b58ec0e2a45f0f869d46889d02405`
- `actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4`
- `actions/github-script@ed597411d8f924073f98dfc5c65a23a2325f34cd`

### `.github/workflows/plugin-validation.yml`
- `actions/checkout@8e8c483db84b4bee98b60c0593521ed34d9990e8`
- `actions/setup-python@a309ff8b426b58ec0e2a45f0f869d46889d02405`
- `actions/upload-artifact@330a01c490aca151604b8cf639adc76d48f6c5d4`
- `actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0`

### `.github/actions/setup/action.yml`
- `actions/setup-node@6044e13b5dc448c55e2357c09f80417699197238`
- `actions/cache@cdf6c1fa76f9f475f3d7449005a359c84ca0f306`

### `.github/actions/run-tests/action.yml`
- `actions/download-artifact@634f93cb2916e3fdff6788551b99b062d0335ce0`

### `.github/workflows/release-please.yml`
- `googleapis/release-please-action@c3fc4de07084f75a2b61a5b933069bda6edf3d5c`

## Updating Action Versions

When updating to a new action version:

1. Find the SHA for the new version tag:
   ```bash
   # Example: Get SHA for actions/checkout@v6
   git ls-remote https://github.com/actions/checkout refs/tags/v6
   ```

2. Update the SHA in all workflow files

3. Update this document with the new version and SHA

4. Test the workflows on a feature branch before merging

## Dependabot Configuration

Consider adding Dependabot to automatically create PRs when action versions update.
Add to `.github/dependabot.yml`:

```yaml
version: 2
updates:
  - package-ecosystem: "github-actions"
    directory: "/"
    schedule:
      interval: "weekly"
    commit-message:
      prefix: "ci"
```

## Security Notes

- Always verify SHA values from official sources before pinning
- Review action changelogs before updating
- Test updates on feature branches first
- Consider security advisories for any third-party actions

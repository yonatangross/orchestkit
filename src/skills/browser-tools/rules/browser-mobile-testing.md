---
title: Scope mobile browser testing to verified devices and emulation profiles
category: browser
impact: HIGH
impactDescription: "Untested device assumptions and missing viewport verification lead to false confidence in mobile compatibility"
tags: [mobile, ios-simulator, device-emulation, responsive, testing]
---

## Browser: Mobile Testing

Use device emulation and iOS Simulator connection for mobile testing, but always verify the device context is active and scope tests to target devices.

**Incorrect:**
```bash
# Assuming device emulation without verifying viewport
agent-browser --device "iPhone 15" open https://app.example.com
agent-browser screenshot /tmp/mobile.png
# Did not verify viewport dimensions — may have fallen back to desktop

# Testing "mobile" without actual device emulation
agent-browser open https://app.example.com
agent-browser eval "window.innerWidth"  # Still 1280px — not mobile!

# Connecting to iOS Simulator without checking it's running
agent-browser --ios-simulator open https://app.example.com
# Fails silently or connects to wrong simulator instance
```

**Correct:**
```bash
# Verify device emulation is active
agent-browser --device "iPhone 15" open https://app.example.com
agent-browser wait --load networkidle
agent-browser eval "JSON.stringify({
  width: window.innerWidth,
  height: window.innerHeight,
  userAgent: navigator.userAgent
})"
# Confirm: width=390, height=844, userAgent contains "iPhone"

# Test dark mode rendering
agent-browser --device "iPhone 15" --color-scheme dark open https://app.example.com
agent-browser screenshot /tmp/mobile-dark.png
agent-browser --color-scheme light open https://app.example.com
agent-browser screenshot /tmp/mobile-light.png

# iOS Simulator — verify simulator is booted first
xcrun simctl list devices | grep "Booted"
agent-browser --ios-simulator open https://app.example.com
agent-browser wait --load networkidle
agent-browser snapshot -i

# Multi-device comparison
for device in "iPhone 15" "iPhone SE" "iPad Pro 11"; do
  agent-browser --device "$device" open https://app.example.com
  agent-browser wait --load networkidle
  agent-browser screenshot "/tmp/test-${device// /-}.png"
done
```

**Key rules:**
- Always verify viewport dimensions after `--device` to confirm emulation is active
- Use `--color-scheme dark` and `--color-scheme light` to test both modes
- Check `xcrun simctl list devices | grep Booted` before using `--ios-simulator`
- Test a minimum of 3 device profiles: small phone, large phone, tablet
- Use `diff screenshot` to compare rendering across devices
- Do not rely solely on emulation — iOS Simulator provides higher-fidelity results for iOS-specific issues

Reference: `references/mobile-testing.md` (Device Emulation, iOS Simulator)

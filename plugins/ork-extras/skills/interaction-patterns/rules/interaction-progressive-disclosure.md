---
title: "Progressive Disclosure"
impact: "HIGH"
impactDescription: "Showing all options at once overwhelms users, increasing cognitive load and error rates — progressive disclosure reduces visible complexity by 60-80%"
tags: [progressive-disclosure, details, accordion, wizard, complexity, cognitive-load]
---

## Progressive Disclosure

Reveal complexity progressively based on frequency of use. Four levels: tooltip (1-click), accordion (`<details>`), wizard (multi-step), and contextual panel (side drawer).

**Incorrect:**
```tsx
// All options visible at once — overwhelming for new users
function SettingsPage() {
  return (
    <form className="space-y-4">
      <Input label="Display name" />
      <Input label="Email" />
      <Input label="Phone" />
      <Input label="Timezone" />
      <Select label="Language" />
      <Select label="Date format" />
      <Input label="SMTP host" />
      <Input label="SMTP port" />
      <Input label="API key" />
      <Input label="Webhook URL" />
      <Input label="Custom domain" />
      <Checkbox label="Enable 2FA" />
      <Checkbox label="Email notifications" />
      <Checkbox label="SMS notifications" />
    </form>
  )
}
```

**Correct:**
```tsx
// Progressive disclosure — common settings visible, advanced behind <details>
function SettingsPage() {
  return (
    <form className="space-y-6">
      {/* Level 1: Always visible — used by 90%+ of users */}
      <section>
        <h2>Profile</h2>
        <Input label="Display name" />
        <Input label="Email" />
      </section>

      {/* Level 2: Accordion — used by 30-50% of users */}
      <details>
        <summary className="cursor-pointer font-medium">
          Preferences
        </summary>
        <div className="mt-3 space-y-3">
          <Select label="Timezone" />
          <Select label="Language" />
          <Select label="Date format" />
        </div>
      </details>

      {/* Level 3: Accordion — used by < 10% of users */}
      <details>
        <summary className="cursor-pointer font-medium">
          Advanced Settings
        </summary>
        <div className="mt-3 space-y-3">
          <Input label="SMTP host" />
          <Input label="SMTP port" />
          <Input label="API key" type="password" />
          <Input label="Webhook URL" />
          <Input label="Custom domain" />
        </div>
      </details>
    </form>
  )
}
```

### Disclosure Level Guide

| Level | Pattern | Frequency | Example |
|-------|---------|-----------|---------|
| 1 | Always visible | 90%+ of users | Name, email, primary action |
| 2 | `<details>` / accordion | 30-50% of users | Preferences, filters |
| 3 | Wizard / multi-step | Setup flows | Onboarding, complex forms |
| 4 | Contextual panel | Power users | Admin settings, API config |

### Wizard Pattern

```tsx
// Multi-step wizard for complex setup flows
function OnboardingWizard() {
  const [step, setStep] = useState(1)

  return (
    <div role="group" aria-label={`Step ${step} of 3`}>
      <nav aria-label="Progress">
        <ol className="flex gap-2">
          {[1, 2, 3].map((s) => (
            <li key={s} aria-current={s === step ? "step" : undefined}>
              Step {s}
            </li>
          ))}
        </ol>
      </nav>
      {step === 1 && <BasicInfoStep />}
      {step === 2 && <PreferencesStep />}
      {step === 3 && <ReviewStep />}
    </div>
  )
}
```

**Key rules:**
- Use native `<details>` / `<summary>` for simple accordions — zero JS, built-in a11y
- Group settings by frequency of use: common (visible) > occasional (accordion) > rare (panel)
- Never hide primary actions behind disclosure — only secondary and advanced options
- Wizard steps must show progress (`aria-label="Step 2 of 4"`) and allow back navigation
- Limit visible options to 5-7 items per group (Miller's Law)

References:
- https://www.nngroup.com/articles/progressive-disclosure/
- https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/ (WAI-ARIA disclosure pattern)

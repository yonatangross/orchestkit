# Theming and Dark Mode Reference

## Theme Structure

```typescript
interface Theme {
  colors: {
    brand: {
      primary: string;
      secondary: string;
    };
    text: {
      primary: string;
      secondary: string;
    };
    background: {
      primary: string;
      secondary: string;
    };
    feedback: {
      success: string;
      warning: string;
      error: string;
      info: string;
    };
  };
  typography: {
    fontFamily: {
      sans: string;
      mono: string;
    };
    fontSize: Record<string, string>;
  };
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadow: Record<string, string>;
}
```

---

## Dark Mode Implementation

### Approach 1: Tailwind CSS @theme with Dark Mode (Recommended)

Using Tailwind's `@theme` directive to define design tokens that generate utility classes:

```css
@theme {
  --color-primary: #10b981;
  --color-primary-hover: #059669;
  --color-text-primary: #111827;
  --color-background: #f9fafb;
  --color-surface: #ffffff;
}

@media (prefers-color-scheme: dark) {
  @theme {
    --color-text-primary: #f9fafb;
    --color-background: #111827;
    --color-surface: #1f2937;
  }
}
```

Then use Tailwind utilities in components:
```tsx
<div className="bg-surface text-text-primary">
  Content
</div>
```

---

### Approach 2: Tailwind CSS Dark Mode Variant

For manual dark mode classes:

```tsx
<div className="bg-white dark:bg-gray-900 text-gray-900 dark:text-white">
  Content
</div>
```

Configure in `tailwind.config.js`:
```javascript
module.exports = {
  darkMode: 'class', // or 'media' for system preference
  // ...
}
```

---

### Approach 3: Styled Components ThemeProvider

For CSS-in-JS solutions:

```typescript
const lightTheme = {
  colors: {
    background: '#ffffff',
    text: '#111827',
    primary: '#3b82f6',
  }
};

const darkTheme = {
  colors: {
    background: '#111827',
    text: '#f9fafb',
    primary: '#60a5fa',
  }
};

// App.tsx
import { ThemeProvider } from 'styled-components';

function App() {
  const [isDark, setIsDark] = useState(false);

  return (
    <ThemeProvider theme={isDark ? darkTheme : lightTheme}>
      <AppContent />
    </ThemeProvider>
  );
}
```

---

## Theme Toggle Component

```typescript
import { useEffect, useState } from 'react';

export function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Check system preference on mount
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark'
      || (isDark ? 'dark' : 'light');
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
  };

  return (
    <button
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
      className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
    >
      {theme === 'light' ? 'Dark' : 'Light'} Mode
    </button>
  );
}
```

---

## System Preference Detection

Listen for system theme changes:

```typescript
useEffect(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handleChange = (e: MediaQueryListEvent) => {
    if (!localStorage.getItem('theme')) {
      // Only auto-switch if user hasn't set preference
      setTheme(e.matches ? 'dark' : 'light');
    }
  };

  mediaQuery.addEventListener('change', handleChange);
  return () => mediaQuery.removeEventListener('change', handleChange);
}, []);
```

---

## Best Practices

1. **Respect user preference**: Check `localStorage` first, then system preference
2. **Prevent flash**: Apply theme before React hydrates (use script in `<head>`)
3. **Semantic colors**: Use semantic tokens (`text-primary`) not primitive (`gray-900`)
4. **Test both modes**: Ensure contrast ratios meet WCAG in both themes
5. **Smooth transitions**: Add `transition-colors` for seamless theme switches
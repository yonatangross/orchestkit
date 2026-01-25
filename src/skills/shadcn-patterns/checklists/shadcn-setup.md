# shadcn/ui Setup Checklist

Complete setup and configuration checklist.

## Initial Setup

- [ ] Initialize shadcn/ui: `npx shadcn@latest init`
- [ ] Select style (New York or Default)
- [ ] Select base color
- [ ] Configure CSS variables: Yes
- [ ] Configure `tailwind.config.js` path
- [ ] Configure `components.json` generated

## File Structure Verification

- [ ] `components.json` created at root
- [ ] `lib/utils.ts` created with `cn()` function
- [ ] `components/ui/` directory created
- [ ] CSS variables added to `globals.css` or `app.css`
- [ ] Tailwind config updated for dark mode: `darkMode: "class"`

## Dependencies Installed

- [ ] `class-variance-authority` for variants
- [ ] `clsx` for conditional classes
- [ ] `tailwind-merge` for class merging
- [ ] `@radix-ui/react-*` (installed per component)
- [ ] `lucide-react` for icons (optional)

## Tailwind Configuration

```javascript
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Colors reference CSS variables
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

- [ ] `darkMode: ["class"]` configured
- [ ] Content paths include all component locations
- [ ] `tailwindcss-animate` plugin added

## CSS Variables

- [ ] Light mode variables defined in `:root`
- [ ] Dark mode variables defined in `.dark`
- [ ] All semantic colors defined:
  - [ ] `--background`, `--foreground`
  - [ ] `--card`, `--card-foreground`
  - [ ] `--popover`, `--popover-foreground`
  - [ ] `--primary`, `--primary-foreground`
  - [ ] `--secondary`, `--secondary-foreground`
  - [ ] `--muted`, `--muted-foreground`
  - [ ] `--accent`, `--accent-foreground`
  - [ ] `--destructive`, `--destructive-foreground`
  - [ ] `--border`, `--input`, `--ring`
  - [ ] `--radius`

## Adding Components

```bash
# Add individual components
npx shadcn@latest add button
npx shadcn@latest add card
npx shadcn@latest add dialog

# Add multiple components
npx shadcn@latest add button card input label
```

- [ ] Add commonly used components
- [ ] Verify components render correctly
- [ ] Test dark mode toggle

## Dark Mode Setup

- [ ] Install `next-themes`: `npm install next-themes`
- [ ] Create ThemeProvider wrapper
- [ ] Add provider to root layout
- [ ] Add `suppressHydrationWarning` to `<html>`
- [ ] Create theme toggle component
- [ ] Test theme persistence

## TypeScript Configuration

```json
// tsconfig.json
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": {
      "@/*": ["./*"]
    }
  }
}
```

- [ ] Path alias `@/*` configured
- [ ] Types resolve correctly

## Testing Checklist

- [ ] Button variants render correctly
- [ ] Dark mode switches properly
- [ ] No hydration mismatches
- [ ] Keyboard navigation works
- [ ] Focus states visible
- [ ] Responsive at all breakpoints

## Common Issues

### Hydration Mismatch
```tsx
// Wrap theme-dependent content
const [mounted, setMounted] = useState(false)
useEffect(() => setMounted(true), [])
if (!mounted) return null
```

### Missing CSS Variables
- Check `globals.css` is imported in layout
- Verify variable names match exactly

### Tailwind Classes Not Applying
- Check content paths in `tailwind.config.js`
- Restart dev server after config changes

## Recommended First Components

1. `button` - Foundation for CTAs
2. `input` + `label` - Form basics
3. `card` - Content containers
4. `dialog` - Modals
5. `dropdown-menu` - Actions menu
6. `toast` - Notifications

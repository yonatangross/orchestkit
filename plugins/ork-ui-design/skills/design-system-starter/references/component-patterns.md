# Component Architecture Patterns

## Atomic Design Methodology

**Atoms** -> **Molecules** -> **Organisms** -> **Templates** -> **Pages**

### Atoms (Primitive Components)
Basic building blocks that can't be broken down further.

**Examples:** Button, Input, Label, Icon, Badge, Avatar

### Molecules (Simple Compositions)
Groups of atoms that function together.

**Examples:**
- SearchBar (Input + Button)
- FormField (Label + Input + ErrorMessage)
- Card (Container + Title + Content + Actions)

### Organisms (Complex Compositions)
Complex UI components made of molecules and atoms.

**Examples:** Navigation Bar, Product Card Grid, User Profile Section, Modal Dialog

### Templates (Page Layouts)
Page-level structures that define content placement.

**Examples:** Dashboard Layout, Marketing Page Layout, Settings Page Layout

### Pages (Specific Instances)
Actual pages with real content.

---

## Component API Design

### Props Best Practices

**1. Predictable Prop Names**
```typescript
// Good: Consistent naming
<Button variant="primary" size="md" />
<Input variant="outlined" size="md" />

// Bad: Inconsistent
<Button type="primary" sizeMode="md" />
<Input style="outlined" inputSize="md" />
```

**2. Sensible Defaults**
```typescript
// Good: Provides defaults
interface ButtonProps {
  variant?: 'primary' | 'secondary';  // Default: primary
  size?: 'sm' | 'md' | 'lg';          // Default: md
}

// Bad: Everything required
interface ButtonProps {
  variant: 'primary' | 'secondary';
  size: 'sm' | 'md' | 'lg';
  color: string;
  padding: string;
}
```

**3. Composition Over Configuration**
```typescript
// Good: Composable
<Card>
  <Card.Header>
    <Card.Title>Title</Card.Title>
  </Card.Header>
  <Card.Body>Content</Card.Body>
  <Card.Footer>Actions</Card.Footer>
</Card>

// Bad: Too many props
<Card
  title="Title"
  content="Content"
  footerContent="Actions"
  hasHeader={true}
  hasFooter={true}
/>
```

**4. Polymorphic Components**
Allow components to render as different HTML elements:
```typescript
<Button as="a" href="/login">Login</Button>
<Button as="button" onClick={handleClick}>Click Me</Button>
```

---

## Compound Component Pattern

```typescript
interface CardProps {
  variant?: 'default' | 'outlined' | 'elevated';
  children: React.ReactNode;
}

export function Card({ variant = 'default', children }: CardProps) {
  return (
    <div className={cn('rounded-lg p-6', cardStyles[variant])}>
      {children}
    </div>
  );
}

Card.Header = function CardHeader({ children }) {
  return <div className="mb-4 border-b pb-4">{children}</div>;
};

Card.Title = function CardTitle({ children }) {
  return <h3 className="text-lg font-semibold">{children}</h3>;
};

Card.Body = function CardBody({ children }) {
  return <div className="space-y-4">{children}</div>;
};

Card.Footer = function CardFooter({ children }) {
  return <div className="mt-4 pt-4 border-t">{children}</div>;
};
```

---

## Polymorphic Component Pattern

```typescript
type AsProp<C extends React.ElementType> = {
  as?: C;
};

type PolymorphicComponentProp<
  C extends React.ElementType,
  Props = {}
> = React.PropsWithChildren<Props & AsProp<C>> &
  Omit<React.ComponentPropsWithoutRef<C>, keyof (AsProp<C> & Props)>;

interface ButtonBaseProps {
  variant?: 'primary' | 'secondary';
}

export type ButtonProps<C extends React.ElementType = 'button'> =
  PolymorphicComponentProp<C, ButtonBaseProps>;

export const Button = <C extends React.ElementType = 'button'>({
  as,
  variant = 'primary',
  children,
  ...props
}: ButtonProps<C>) => {
  const Component = as || 'button';
  return (
    <Component className={buttonStyles[variant]} {...props}>
      {children}
    </Component>
  );
};

// Usage:
// <Button>Click</Button>           // renders as <button>
// <Button as="a" href="/">Link</Button>  // renders as <a>
```

---

## Variant Pattern with CVA

Using `class-variance-authority` for type-safe variants:

```typescript
import { cva, type VariantProps } from 'class-variance-authority';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-medium transition-colors',
  {
    variants: {
      variant: {
        primary: 'bg-blue-600 text-white hover:bg-blue-700',
        secondary: 'bg-gray-600 text-white hover:bg-gray-700',
        outline: 'border border-gray-300 hover:bg-gray-100',
        ghost: 'hover:bg-gray-100',
      },
      size: {
        sm: 'h-8 px-3 text-sm',
        md: 'h-10 px-4 text-base',
        lg: 'h-12 px-6 text-lg',
      },
    },
    defaultVariants: {
      variant: 'primary',
      size: 'md',
    },
  }
);

interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export function Button({ variant, size, className, ...props }: ButtonProps) {
  return (
    <button className={buttonVariants({ variant, size, className })} {...props} />
  );
}
```

---

## Complete Implementation Examples

See `references/component-examples.md` for full implementations of:
- Button with all variants and loading states
- FormField molecule
- Card compound component
- Input with validation states
- Modal with focus trap
- Skip Link for accessibility
- Theme Toggle
- Responsive Navigation
# Client Components Reference

Client Components enable interactivity, browser APIs, and React hooks in Next.js App Router applications.

## When to Use Client Components

Use Client Components when you need:
- **Interactivity**: Click handlers, form inputs, state changes
- **React Hooks**: `useState`, `useEffect`, `useContext`, `useReducer`
- **Browser APIs**: `localStorage`, `window`, `navigator`, `IntersectionObserver`
- **Event Listeners**: Mouse, keyboard, scroll, resize events
- **Third-Party Libraries**: Many UI libraries require client-side rendering

## The 'use client' Directive

```tsx
'use client'  // Must be at the top of the file, before any imports

import { useState } from 'react'

export function Counter() {
  const [count, setCount] = useState(0)

  return (
    <button onClick={() => setCount(count + 1)}>
      Count: {count}
    </button>
  )
}
```

**Important**: The `'use client'` directive marks the **boundary** between Server and Client. All components imported by a Client Component are also treated as Client Components.

## Client Component Characteristics

- Ships JavaScript to the client
- Can use all React hooks
- Can access browser APIs
- Cannot be `async` (no await at component level)
- Cannot directly import Server Components
- Hydrated on the client after initial HTML render

## React 19 Component Patterns

### Function Declarations (Recommended)

```tsx
'use client'

// RECOMMENDED: Function declaration
export function Button({ children, onClick }: ButtonProps): React.ReactNode {
  return <button onClick={onClick}>{children}</button>
}

// ALSO VALID: Arrow function without React.FC
export const Button = ({ children, onClick }: ButtonProps): React.ReactNode => {
  return <button onClick={onClick}>{children}</button>
}

// DEPRECATED: React.FC (don't use in React 19)
// export const Button: React.FC<ButtonProps> = ...
```

### Ref as Prop (React 19)

```tsx
'use client'

// React 19: ref is a regular prop
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>
}

export function Input({ ref, ...props }: InputProps): React.ReactNode {
  return <input ref={ref} {...props} />
}

// Usage
function Form() {
  const inputRef = useRef<HTMLInputElement>(null)
  return <Input ref={inputRef} placeholder="Enter text..." />
}
```

## Interactivity Patterns

### State Management

```tsx
'use client'

import { useState, useCallback } from 'react'

export function TodoList({ initialTodos }: { initialTodos: Todo[] }) {
  const [todos, setTodos] = useState(initialTodos)
  const [filter, setFilter] = useState<'all' | 'active' | 'completed'>('all')

  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed
    if (filter === 'completed') return todo.completed
    return true
  })

  const toggleTodo = useCallback((id: string) => {
    setTodos(prev =>
      prev.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    )
  }, [])

  return (
    <div>
      <FilterButtons filter={filter} onFilterChange={setFilter} />
      <ul>
        {filteredTodos.map(todo => (
          <TodoItem key={todo.id} todo={todo} onToggle={toggleTodo} />
        ))}
      </ul>
    </div>
  )
}
```

### Form Handling with useActionState

```tsx
'use client'

import { useActionState } from 'react'
import { submitContact } from './actions'

interface FormState {
  message: string
  success: boolean
}

export function ContactForm(): React.ReactNode {
  const [state, formAction, isPending] = useActionState(submitContact, {
    message: '',
    success: false
  })

  return (
    <form action={formAction}>
      <input name="email" type="email" disabled={isPending} required />
      <textarea name="message" disabled={isPending} required />
      <button type="submit" disabled={isPending}>
        {isPending ? 'Sending...' : 'Send'}
      </button>
      {state.message && (
        <p className={state.success ? 'text-green-600' : 'text-red-600'}>
          {state.message}
        </p>
      )}
    </form>
  )
}
```

### useFormStatus for Submit Buttons

```tsx
'use client'

import { useFormStatus } from 'react-dom'

export function SubmitButton({ children }: { children: React.ReactNode }): React.ReactNode {
  const { pending } = useFormStatus()

  return (
    <button type="submit" disabled={pending} aria-busy={pending}>
      {pending ? 'Submitting...' : children}
    </button>
  )
}
```

## Hydration

Hydration is the process where React attaches event listeners and makes the server-rendered HTML interactive.

### Hydration Timeline

1. Server renders HTML
2. HTML sent to browser (user sees content)
3. JavaScript bundle loads
4. React hydrates the HTML (attaches event handlers)
5. Page becomes interactive

### Avoiding Hydration Mismatches

```tsx
'use client'

import { useState, useEffect } from 'react'

// PROBLEM: Different output on server vs client
function BadComponent() {
  return <span>{Date.now()}</span> // Hydration mismatch!
}

// SOLUTION: Use useEffect for client-only values
function GoodComponent() {
  const [time, setTime] = useState<number | null>(null)

  useEffect(() => {
    setTime(Date.now())
  }, [])

  return <span>{time ?? 'Loading...'}</span>
}

// ALTERNATIVE: Suppress hydration warning for intentional mismatches
function TimeComponent() {
  return <span suppressHydrationWarning>{Date.now()}</span>
}
```

### Client-Only Rendering

```tsx
'use client'

import { useState, useEffect } from 'react'

export function ClientOnly({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  return <>{children}</>
}

// Usage
function App() {
  return (
    <ClientOnly>
      <LocalStorageViewer />
    </ClientOnly>
  )
}
```

## Browser API Usage

```tsx
'use client'

import { useState, useEffect } from 'react'

export function WindowSize() {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      })
    }

    // Set initial size
    handleResize()

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  return (
    <p>
      Window: {size.width} x {size.height}
    </p>
  )
}
```

## Composition with Server Components

### Children Pattern

```tsx
// ClientWrapper.tsx (Client Component)
'use client'

import { useState } from 'react'

export function Accordion({ children, title }: { children: React.ReactNode; title: string }) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div>
      <button onClick={() => setIsOpen(!isOpen)}>{title}</button>
      {isOpen && <div>{children}</div>}
    </div>
  )
}

// Page.tsx (Server Component)
import { Accordion } from './ClientWrapper'

export default async function Page() {
  const content = await getContent() // Server-side fetch

  return (
    <Accordion title="View Details">
      {/* Server Component rendered as children */}
      <ServerRenderedContent data={content} />
    </Accordion>
  )
}
```

## Performance Considerations

1. **Keep Client Components small**: Extract only interactive parts
2. **Lift state up minimally**: Don't make entire pages client components
3. **Use Server Components for data**: Fetch data in Server Components, pass to Client
4. **Lazy load heavy components**: Use `dynamic()` for code splitting

```tsx
import dynamic from 'next/dynamic'

// Lazy load heavy chart library
const Chart = dynamic(() => import('./Chart'), {
  loading: () => <ChartSkeleton />,
  ssr: false  // Client-only rendering
})
```

## Common Mistakes

### Making Entire Pages Client Components

```tsx
// BAD: Entire page is client
'use client'
export default function ProductsPage() {
  const [products, setProducts] = useState([])
  useEffect(() => { /* fetch */ }, [])
  return <ProductList products={products} />
}

// GOOD: Only interactive part is client
// ProductsPage.tsx (Server Component)
export default async function ProductsPage() {
  const products = await getProducts()
  return (
    <div>
      <ProductFilters /> {/* Client Component */}
      <ProductList products={products} /> {/* Server Component */}
    </div>
  )
}
```

### Importing Server Components in Client Components

```tsx
// BAD: Can't import Server Component in Client
'use client'
import { ServerData } from './ServerData' // Error!

export function ClientWrapper() {
  return <ServerData />
}

// GOOD: Pass as children
'use client'
export function ClientWrapper({ children }: { children: React.ReactNode }) {
  return <div className="wrapper">{children}</div>
}

// Usage in Server Component
import { ClientWrapper } from './ClientWrapper'
import { ServerData } from './ServerData'

export default function Page() {
  return (
    <ClientWrapper>
      <ServerData />
    </ClientWrapper>
  )
}
```
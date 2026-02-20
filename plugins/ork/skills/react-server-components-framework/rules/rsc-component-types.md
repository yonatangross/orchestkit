---
title: Use correct React 19 component types instead of deprecated React.FC patterns
category: rsc
impact: MEDIUM
impactDescription: "Using deprecated React.FC in React 19 projects leads to incorrect implicit children typing, inconsistent codebase patterns, and confusion about ref handling."
tags: [rsc, react-19, typescript, component-types]
---

## RSC: Component Types

React 19 deprecates `React.FC`. It previously added implicit `children` to all component props, which caused incorrect type-checking. Use function declarations (preferred) or typed arrow functions with explicit `React.ReactNode` return types.

**Incorrect:**
```tsx
'use client'

import React from 'react'

// DEPRECATED: React.FC adds implicit children and is removed from React 19 best practices
export const Button: React.FC<ButtonProps> = ({ children, onClick }) => {
  return <button onClick={onClick}>{children}</button>
}

// Also problematic: no return type annotation
export const Card = ({ title, body }: CardProps) => {
  return (
    <div>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}
```

**Correct:**
```tsx
'use client'

// PREFERRED: Function declaration with explicit return type
export function Button({ children, onClick }: ButtonProps): React.ReactNode {
  return <button onClick={onClick}>{children}</button>
}

// ALSO VALID: Arrow function without React.FC, with explicit return type
export const Card = ({ title, body }: CardProps): React.ReactNode => {
  return (
    <div>
      <h2>{title}</h2>
      <p>{body}</p>
    </div>
  )
}
```

**React 19 ref handling:**
```tsx
'use client'

// React 19: ref is a regular prop — no forwardRef needed
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>
}

export function Input({ ref, ...props }: InputProps): React.ReactNode {
  return <input ref={ref} {...props} />
}

// Usage
const inputRef = useRef<HTMLInputElement>(null)
<Input ref={inputRef} placeholder="Enter text..." />
```

**Key rules:**
- Use function declarations for components; they are hoisted and consistently identifiable in stack traces.
- Always annotate the return type as `React.ReactNode` for clarity and type safety.
- Do not use `React.FC` or `React.FunctionComponent` in React 19 projects.
- In React 19, pass `ref` as a regular prop — `forwardRef` is no longer required.

Reference: `references/client-components.md` (React 19 Component Patterns, Ref as Prop)

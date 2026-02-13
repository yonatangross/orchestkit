# State Colocation

Keep state as close to where it's used as possible.

## The Principle

State should live in the component that needs it. Only lift state when truly necessary for sibling communication.

## Problem: State Too High

```tsx
// ❌ State at app level causes unnecessary re-renders
function App() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  return (
    <div>
      <Header />                    {/* Re-renders on search! */}
      <Sidebar />                   {/* Re-renders on search! */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
      />
      <SearchResults
        query={searchQuery}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
      <Footer />                    {/* Re-renders on search! */}
    </div>
  )
}
```

## Solution: Colocate State

```tsx
// ✅ State colocated with components that use it
function App() {
  return (
    <div>
      <Header />
      <Sidebar />
      <SearchSection />  {/* Contains its own state */}
      <Footer />
    </div>
  )
}

function SearchSection() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  return (
    <>
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
      />
      <SearchResults
        query={searchQuery}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />
    </>
  )
}
```

## When to Lift State

Lift state ONLY when:

1. **Siblings need to share it**
```tsx
// Both components need selectedUser
function Parent() {
  const [selectedUser, setSelectedUser] = useState(null)

  return (
    <>
      <UserList onSelect={setSelectedUser} selected={selectedUser} />
      <UserDetails user={selectedUser} />
    </>
  )
}
```

2. **Parent needs to coordinate**
```tsx
// Parent manages form submission
function Form() {
  const [values, setValues] = useState({})

  const handleSubmit = () => {
    api.submit(values)
  }

  return (
    <>
      <FormFields values={values} onChange={setValues} />
      <SubmitButton onClick={handleSubmit} />
    </>
  )
}
```

## Component Splitting

Split components to isolate state:

```tsx
// ❌ Before: Counter re-renders entire card
function Card() {
  const [count, setCount] = useState(0)

  return (
    <div className="card">
      <ExpensiveHeader />           {/* Re-renders on count change */}
      <ExpensiveContent />          {/* Re-renders on count change */}
      <button onClick={() => setCount(c => c + 1)}>
        Count: {count}
      </button>
    </div>
  )
}

// ✅ After: Counter isolated
function Card() {
  return (
    <div className="card">
      <ExpensiveHeader />           {/* Doesn't re-render */}
      <ExpensiveContent />          {/* Doesn't re-render */}
      <Counter />                   {/* Only this re-renders */}
    </div>
  )
}

function Counter() {
  const [count, setCount] = useState(0)
  return (
    <button onClick={() => setCount(c => c + 1)}>
      Count: {count}
    </button>
  )
}
```

## Context for Cross-Cutting Concerns

Use Context for truly global state, not local UI state:

```tsx
// ✅ Good: Theme is app-wide
<ThemeContext.Provider value={theme}>
  <App />
</ThemeContext.Provider>

// ✅ Good: Auth is app-wide
<AuthContext.Provider value={user}>
  <App />
</AuthContext.Provider>

// ❌ Bad: Search query is local
<SearchQueryContext.Provider value={query}>  {/* Don't do this */}
  <Header />
  <SearchResults />
</SearchQueryContext.Provider>
```

## Context Splitting

Split contexts to prevent unnecessary re-renders:

```tsx
// ❌ Single context - all consumers re-render
const AppContext = createContext({ user, theme, locale })

// ✅ Split contexts - targeted re-renders
const UserContext = createContext(null)
const ThemeContext = createContext('light')
const LocaleContext = createContext('en')
```

## Signs State Should Move

**Move state DOWN when:**
- Only one component uses it
- Child components don't need it
- Re-renders are affecting unrelated components

**Move state UP when:**
- Multiple children need to read it
- Children need to update each other
- State represents shared domain concept

## Quick Checklist

- [ ] Is state used by only one component? → Keep it there
- [ ] Do siblings need this state? → Lift to parent
- [ ] Is it causing unnecessary re-renders? → Consider splitting
- [ ] Is it truly global? → Use Context
- [ ] Is it URL state? → Use router params

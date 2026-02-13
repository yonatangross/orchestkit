// Optimized Context Pattern
// Split contexts to prevent unnecessary re-renders

import * as React from 'react'

// ============================================
// PATTERN 1: Split State and Dispatch
// ============================================

interface State {
  count: number
  user: { name: string } | null
}

type Action =
  | { type: 'increment' }
  | { type: 'decrement' }
  | { type: 'setUser'; payload: { name: string } | null }

// Separate contexts for state and dispatch
const StateContext = React.createContext<State | undefined>(undefined)
const DispatchContext = React.createContext<React.Dispatch<Action> | undefined>(undefined)

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'increment':
      return { ...state, count: state.count + 1 }
    case 'decrement':
      return { ...state, count: state.count - 1 }
    case 'setUser':
      return { ...state, user: action.payload }
    default:
      return state
  }
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = React.useReducer(reducer, {
    count: 0,
    user: null,
  })

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>
        {children}
      </DispatchContext.Provider>
    </StateContext.Provider>
  )
}

// Hooks with proper error handling
export function useAppState() {
  const context = React.useContext(StateContext)
  if (context === undefined) {
    throw new Error('useAppState must be used within AppProvider')
  }
  return context
}

export function useAppDispatch() {
  const context = React.useContext(DispatchContext)
  if (context === undefined) {
    throw new Error('useAppDispatch must be used within AppProvider')
  }
  return context
}

// ============================================
// PATTERN 2: Selective Subscriptions
// ============================================

interface StoreState {
  theme: 'light' | 'dark'
  locale: string
  user: { id: string; name: string } | null
}

// Create separate contexts for each piece of state
const ThemeContext = React.createContext<'light' | 'dark'>('light')
const LocaleContext = React.createContext<string>('en')
const UserContext = React.createContext<{ id: string; name: string } | null>(null)

// Setters in separate context
interface StoreSetters {
  setTheme: (theme: 'light' | 'dark') => void
  setLocale: (locale: string) => void
  setUser: (user: { id: string; name: string } | null) => void
}
const SettersContext = React.createContext<StoreSetters | undefined>(undefined)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = React.useState<'light' | 'dark'>('light')
  const [locale, setLocale] = React.useState('en')
  const [user, setUser] = React.useState<{ id: string; name: string } | null>(null)

  // Memoize setters to prevent re-renders
  const setters = React.useMemo(
    () => ({ setTheme, setLocale, setUser }),
    []
  )

  return (
    <SettersContext.Provider value={setters}>
      <ThemeContext.Provider value={theme}>
        <LocaleContext.Provider value={locale}>
          <UserContext.Provider value={user}>
            {children}
          </UserContext.Provider>
        </LocaleContext.Provider>
      </ThemeContext.Provider>
    </SettersContext.Provider>
  )
}

// Hooks for selective subscription
export function useTheme() {
  return React.useContext(ThemeContext)
}

export function useLocale() {
  return React.useContext(LocaleContext)
}

export function useUser() {
  return React.useContext(UserContext)
}

export function useStoreSetters() {
  const context = React.useContext(SettersContext)
  if (context === undefined) {
    throw new Error('useStoreSetters must be used within StoreProvider')
  }
  return context
}

// ============================================
// PATTERN 3: Stable Value with useMemo
// ============================================

interface AuthContextValue {
  user: { id: string; name: string } | null
  isAuthenticated: boolean
  login: (credentials: { email: string; password: string }) => Promise<void>
  logout: () => void
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<{ id: string; name: string } | null>(null)

  // Memoize callbacks
  const login = React.useCallback(async (credentials: { email: string; password: string }) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    })
    const data = await response.json()
    setUser(data.user)
  }, [])

  const logout = React.useCallback(() => {
    setUser(null)
  }, [])

  // Memoize entire context value
  const value = React.useMemo(
    () => ({
      user,
      isAuthenticated: user !== null,
      login,
      logout,
    }),
    [user, login, logout]
  )

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = React.useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

// Usage:
/*
// Pattern 1 - State/Dispatch split
function Counter() {
  const { count } = useAppState()  // Re-renders only when count changes
  return <span>{count}</span>
}

function IncrementButton() {
  const dispatch = useAppDispatch()  // Never re-renders (dispatch is stable)
  return <button onClick={() => dispatch({ type: 'increment' })}>+</button>
}

// Pattern 2 - Selective subscriptions
function ThemeToggle() {
  const theme = useTheme()  // Only re-renders when theme changes
  const { setTheme } = useStoreSetters()  // Stable reference
  return <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>Toggle</button>
}

// Pattern 3 - Stable context value
function UserProfile() {
  const { user, logout } = useAuth()
  // Only re-renders when user changes
  return user ? <button onClick={logout}>Logout {user.name}</button> : null
}
*/

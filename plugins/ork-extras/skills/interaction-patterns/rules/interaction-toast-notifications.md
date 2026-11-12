---
title: "Toast Notifications"
impact: "HIGH"
impactDescription: "Toasts without ARIA roles are invisible to screen readers; auto-dismissing errors prevents users from reading the message"
tags: [toast, notification, aria, alert, status, auto-dismiss, stacking, sonner]
---

## Toast Notifications

Position toasts bottom-center on mobile and top-right on desktop. Auto-dismiss success after 5s but never auto-dismiss errors. Use `role="status"` for informational toasts and `role="alert"` for errors.

**Incorrect:**
```tsx
// Toast with no ARIA role — screen readers never announce it
// Auto-dismisses errors — users cannot read the message
function showToast(message: string) {
  const toast = document.createElement("div")
  toast.textContent = message
  toast.className = "fixed bottom-4 right-4 bg-black text-white p-4 rounded"
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 3000) // All toasts auto-dismiss, including errors
}
```

**Correct:**
```tsx
// Accessible toast system with proper ARIA roles and auto-dismiss logic
type ToastType = "success" | "error" | "info" | "warning"

interface Toast {
  id: string
  message: string
  type: ToastType
}

function ToastContainer({ toasts, onDismiss }: Props) {
  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2
                 max-sm:top-auto max-sm:bottom-4 max-sm:right-4 max-sm:left-4"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.type === "error" ? "alert" : "status"}
          aria-live={toast.type === "error" ? "assertive" : "polite"}
          className={cn(
            "flex items-center gap-3 rounded-lg p-4 shadow-lg",
            toast.type === "error" && "bg-destructive text-white",
            toast.type === "success" && "bg-green-600 text-white",
            toast.type === "info" && "bg-blue-600 text-white",
          )}
        >
          <span className="flex-1">{toast.message}</span>
          <button
            onClick={() => onDismiss(toast.id)}
            aria-label="Dismiss notification"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  )
}

// Auto-dismiss logic — NEVER auto-dismiss errors
function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: ToastType = "info") => {
    const id = crypto.randomUUID()
    setToasts((prev) => [...prev, { id, message, type }])

    if (type !== "error") {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
      }, 5000)
    }
  }, [])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  return { toasts, addToast, dismiss }
}
```

### Positioning Guide

| Context | Position | Why |
|---------|----------|-----|
| Desktop | Top-right | Away from primary content, visible without scrolling |
| Mobile | Bottom-center | Reachable by thumb, full-width for readability |
| Forms | Top of form | Near the action that triggered the toast |

### Stacking

```tsx
// Stack toasts with newest on top, max 3 visible
const visibleToasts = toasts.slice(-3)
```

**Key rules:**
- Use `role="status"` + `aria-live="polite"` for success/info toasts
- Use `role="alert"` + `aria-live="assertive"` for error toasts
- Auto-dismiss success/info after 5 seconds; NEVER auto-dismiss errors
- Position: `top-right` on desktop, `bottom-center` on mobile (use media query)
- Stack max 3 visible toasts; dismiss oldest when limit is exceeded
- Every toast must have a visible dismiss button (not just auto-dismiss)
- Consider using `sonner` library — built-in a11y, stacking, and swipe-to-dismiss

Reference: https://www.w3.org/WAI/ARIA/apg/patterns/alert/

import { useCallback, useState, useEffect, Dispatch, SetStateAction, ReactElement } from 'react';
import { useNavigate, NavigateOptions } from 'react-router';
import { flushSync } from 'react-dom';

/**
 * Hook for manual view transitions with React Router
 */
export function useViewTransitionNavigate() {
  const navigate = useNavigate();

  const transitionNavigate = useCallback(
    (to: string, options?: NavigateOptions) => {
      // Feature detection
      if (!document.startViewTransition) {
        navigate(to, options);
        return;
      }

      document.startViewTransition(() => {
        flushSync(() => {
          navigate(to, options);
        });
      });
    },
    [navigate]
  );

  return transitionNavigate;
}

/**
 * Hook for view transitions with state updates
 */
export function useViewTransitionState<T>(
  setState: Dispatch<SetStateAction<T>>
) {
  return useCallback(
    (newValue: T | ((prev: T) => T)) => {
      if (!document.startViewTransition) {
        setState(newValue);
        return;
      }

      document.startViewTransition(() => {
        flushSync(() => {
          setState(newValue);
        });
      });
    },
    [setState]
  );
}

/**
 * Component for shared element transitions
 */
interface SharedElementProps {
  name: string;
  isActive?: boolean;
  children: ReactElement;
}

export function SharedElement({ name, isActive = true, children }: SharedElementProps) {
  return (
    <div
      style={{
        viewTransitionName: isActive ? name : undefined,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Media query hook for reduced motion
 */
export function useReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);

    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

// Usage example:
// const navigate = useViewTransitionNavigate();
// onClick={() => navigate('/products/123')}

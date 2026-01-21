import { ReactNode } from 'react';
import { motion } from 'motion/react';
import { fadeIn, cardHover } from '@/lib/animations';
import { cn } from '@/lib/utils';

interface WidgetCardProps {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  noPadding?: boolean;
}

/**
 * Base widget card component for dashboards
 */
export function WidgetCard({
  title,
  description,
  action,
  children,
  className,
  noPadding = false,
}: WidgetCardProps) {
  return (
    <motion.div
      {...fadeIn}
      className={cn('rounded-xl border bg-card shadow-sm', className)}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-6 py-4">
        <div>
          <h3 className="font-semibold text-card-foreground">{title}</h3>
          {description && (
            <p className="text-sm text-muted-foreground">{description}</p>
          )}
        </div>
        {action && <div>{action}</div>}
      </div>

      {/* Content */}
      <div className={cn(!noPadding && 'p-6')}>{children}</div>
    </motion.div>
  );
}

interface StatWidgetProps {
  title: string;
  value: string | number;
  change?: {
    value: string;
    type: 'positive' | 'negative' | 'neutral';
  };
  icon?: ReactNode;
  className?: string;
}

/**
 * Stat/metric widget for KPIs
 */
export function StatWidget({
  title,
  value,
  change,
  icon,
  className,
}: StatWidgetProps) {
  return (
    <motion.div
      {...fadeIn}
      {...cardHover}
      className={cn(
        'rounded-xl border bg-card p-6 shadow-sm transition-colors',
        className
      )}
    >
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{title}</p>
        {icon && (
          <div className="rounded-lg bg-muted p-2 text-muted-foreground">
            {icon}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-baseline gap-2">
        <p className="text-3xl font-bold tracking-tight">{value}</p>
        {change && (
          <span
            className={cn(
              'text-sm font-medium',
              change.type === 'positive' && 'text-green-600',
              change.type === 'negative' && 'text-red-600',
              change.type === 'neutral' && 'text-muted-foreground'
            )}
          >
            {change.type === 'positive' && '↑'}
            {change.type === 'negative' && '↓'}
            {change.value}
          </span>
        )}
      </div>
    </motion.div>
  );
}

interface ChartWidgetProps {
  title: string;
  description?: string;
  children: ReactNode;
  height?: number;
  className?: string;
}

/**
 * Chart widget with proper height handling
 */
export function ChartWidget({
  title,
  description,
  children,
  height = 300,
  className,
}: ChartWidgetProps) {
  return (
    <WidgetCard
      title={title}
      description={description}
      className={className}
    >
      <div style={{ height }}>{children}</div>
    </WidgetCard>
  );
}

// Example usage:
// <StatWidget
//   title="Total Revenue"
//   value="$45,231"
//   change={{ value: "+12%", type: "positive" }}
//   icon={<DollarSign className="h-4 w-4" />}
// />
//
// <ChartWidget title="Revenue Trend" height={300}>
//   <ResponsiveContainer width="100%" height="100%">
//     <LineChart data={data}>...</LineChart>
//   </ResponsiveContainer>
// </ChartWidget>

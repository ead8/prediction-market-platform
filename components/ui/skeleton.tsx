import { cn } from '@/lib/utils'

// Subtle shimmering placeholder. Uses a low-opacity green tint so it harmonizes
// with the dark/emerald theme without competing for attention.
function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(
        'animate-pulse rounded-md bg-foreground/[0.06] border border-foreground/[0.04]',
        className,
      )}
      {...props}
    />
  )
}

export { Skeleton }

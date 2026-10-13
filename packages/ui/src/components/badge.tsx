import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../lib/cn'

const badgeVariants = cva(
  'inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[0.6875rem] font-bold leading-none',
  {
    variants: {
      variant: {
        primary: 'bg-accent text-accent-foreground',
        secondary: 'bg-amber-100 text-amber-900',
        neutral: 'bg-muted text-muted-foreground',
        outline: 'border border-border text-foreground',
        success: 'bg-success text-success-foreground',
        destructive: 'bg-destructive text-destructive-foreground',
      },
    },
    defaultVariants: { variant: 'primary' },
  },
)

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }

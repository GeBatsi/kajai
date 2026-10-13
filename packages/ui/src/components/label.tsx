'use client'

import * as React from 'react'
import * as LabelPrimitive from '@radix-ui/react-label'
import { cn } from '../lib/cn'

const Label = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      'text-caption font-semibold text-muted-foreground peer-disabled:cursor-not-allowed peer-disabled:opacity-45',
      className,
    )}
    {...props}
  />
))
Label.displayName = 'Label'

export interface FieldProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  htmlFor: string
  /** Hibaüzenet a mező alatt; ha meg van adva, a segédszöveg helyett jelenik meg. */
  error?: string
  hint?: string
}

/** Címke + mező + segéd-/hibaszöveg egy oszlopban. */
function Field({ label, htmlFor, error, hint, className, children, ...props }: FieldProps) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)} {...props}>
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {error ? (
        <p role="alert" className="text-caption font-medium text-destructive">
          {error}
        </p>
      ) : hint ? (
        <p className="text-caption text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  )
}

export { Label, Field }

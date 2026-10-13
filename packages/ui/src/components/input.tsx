import * as React from 'react'
import { cn } from '../lib/cn'

const fieldBase =
  'w-full border border-input bg-muted/60 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-ring focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-not-allowed disabled:opacity-45 aria-[invalid=true]:border-destructive aria-[invalid=true]:outline-destructive'

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>

const Input = React.forwardRef<HTMLInputElement, InputProps>(({ className, type = 'text', ...props }, ref) => (
  <input ref={ref} type={type} className={cn(fieldBase, 'h-10 rounded-full px-4', className)} {...props} />
))
Input.displayName = 'Input'

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(fieldBase, 'min-h-24 rounded-md px-4 py-3', className)} {...props} />
))
Textarea.displayName = 'Textarea'

export type SelectProps = React.SelectHTMLAttributes<HTMLSelectElement>

/** Natív `<select>` a design rendszer mezőstílusával. */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(({ className, ...props }, ref) => (
  <select ref={ref} className={cn(fieldBase, 'h-10 rounded-full px-4', className)} {...props} />
))
Select.displayName = 'Select'

export { Input, Textarea, Select }

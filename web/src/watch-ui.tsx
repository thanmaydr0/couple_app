import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx, type ClassValue } from 'clsx';
import type { ComponentProps } from 'react';
import { twMerge } from 'tailwind-merge';

function cn(...values: ClassValue[]) {
  return twMerge(clsx(values));
}

const buttonVariants = cva('pressable watch-ui-button', {
  variants: {
    variant: {
      default: 'primary',
      primary: 'primary',
      secondary: 'watch-ui-button-secondary',
      outline: 'watch-ui-button-outline',
      ghost: 'watch-ui-button-ghost',
      destructive: 'watch-ui-button-destructive',
    },
    size: {
      default: '',
      sm: 'watch-ui-button-sm',
      lg: 'watch-ui-button-lg',
      icon: 'watch-ui-button-icon',
    },
  },
  defaultVariants: { variant: 'default', size: 'default' },
});

export type ButtonProps = ComponentProps<'button'> & VariantProps<typeof buttonVariants> & { asChild?: boolean };
export function Button({ className, variant, size, asChild = false, ...props }: ButtonProps) {
  const Component = asChild ? Slot : 'button';
  return <Component data-slot="button" className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section data-slot="card" className={cn('card watch-ui-card', className)} {...props} />;
}

export function CardHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-header" className={cn('watch-ui-card-header', className)} {...props} />;
}

type CardTitleProps = ComponentProps<'h2'> & { as?: 'h2' | 'h3' | 'h4' };
export function CardTitle({ as: Tag = 'h2', className, ...props }: CardTitleProps) {
  return <Tag data-slot="card-title" className={cn('watch-ui-card-title', className)} {...props} />;
}

export function CardDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p data-slot="card-description" className={cn('watch-ui-card-description', className)} {...props} />;
}

export function CardContent({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-content" className={cn('watch-ui-card-content', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return <div data-slot="card-footer" className={cn('watch-ui-card-footer', className)} {...props} />;
}

const badgeVariants = cva('watch-ui-badge', {
  variants: {
    variant: {
      default: 'watch-ui-badge-primary',
      secondary: 'watch-ui-badge-secondary',
      outline: 'watch-ui-badge-outline',
    },
  },
  defaultVariants: { variant: 'secondary' },
});

export type BadgeProps = ComponentProps<'span'> & VariantProps<typeof badgeVariants>;
export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />;
}

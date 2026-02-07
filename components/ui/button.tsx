import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

/**
 * Button component variants using class-variance-authority.
 *
 * @remarks
 * This component follows the shadcn/ui button pattern with standardized sizes
 * and variants for the ForemanOS construction management platform.
 *
 * @example
 * ```tsx
 * // Standard form button
 * <Button>Submit</Button>
 *
 * // Primary CTA
 * <Button size="lg">Create Project</Button>
 *
 * // Secondary action
 * <Button size="sm" variant="outline">Cancel</Button>
 *
 * // Icon button
 * <Button size="icon" variant="ghost">
 *   <PlusIcon className="h-4 w-4" />
 * </Button>
 * ```
 */
const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-gray-500 bg-dark-card text-gray-100 hover:bg-dark-hover hover:text-white hover:border-gray-400",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      /**
       * Button size variants - standardized across ForemanOS
       *
       * SIZE USAGE GUIDE:
       *
       * - `sm` (36px height):
       *   Use for secondary actions, inline buttons, compact tables, and tight spaces.
       *   Examples: "Cancel" buttons, table row actions, filter chips, inline edits
       *
       * - `default` (40px height):
       *   Standard size for most buttons, forms, dialogs, and general UI.
       *   Examples: Form submissions, dialog actions, navigation items, standard CTAs
       *
       * - `lg` (44px height):
       *   Primary calls-to-action, hero sections, prominent actions.
       *   Examples: "Create Project", "Start Schedule", dashboard primary actions
       *
       * - `xl` (48px height):
       *   Major actions on landing pages, empty states, and high-impact CTAs.
       *   Examples: "Get Started", "Upgrade Now", onboarding flows
       *
       * - `icon` (40px square):
       *   Icon-only buttons without text labels. Maintains square aspect ratio.
       *   Examples: Menu toggles, close buttons, action icons, toolbar buttons
       *
       * RECOMMENDATION: Use `default` unless there's a specific need for emphasis (lg/xl)
       * or space constraints (sm). Most buttons should use default for consistency.
       */
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

/**
 * Props for the Button component.
 *
 * @property variant - Visual style variant (default, destructive, outline, secondary, ghost, link)
 * @property size - Button size (sm, default, lg, xl, icon)
 * @property asChild - When true, merges props into the immediate child using Radix Slot
 */
export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/**
 * Button component - Base interactive element for ForemanOS.
 *
 * @remarks
 * Follows shadcn/ui patterns with Radix UI Slot composition.
 * Includes focus management, disabled states, and keyboard navigation.
 *
 * @example
 * ```tsx
 * // Standard button
 * <Button onClick={handleSubmit}>Save Changes</Button>
 *
 * // Destructive action
 * <Button variant="destructive" size="sm">Delete</Button>
 *
 * // Compose with child elements (useful for custom components like Link)
 * <Button asChild>
 *   <Link href="/projects">View Projects</Link>
 * </Button>
 * ```
 */
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
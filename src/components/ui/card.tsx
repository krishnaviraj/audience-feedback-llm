import * as React from "react"
import { cn } from "@/lib/utils"  // Make sure you have this utility

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
interface CardTitleProps extends React.HTMLAttributes<HTMLHeadingElement> {}
interface CardContentProps extends React.HTMLAttributes<HTMLDivElement> {}

const Card = React.forwardRef<HTMLDivElement, CardProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border bg-white shadow-sm transition-all duration-200",
      "hover:shadow-md hover:translate-y-[-1px]", 
      className
    )}
    {...props}
  />
))
Card.displayName = "Card"

const CardHeader = React.forwardRef<HTMLDivElement, CardHeaderProps>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("flex items-center gap-3 p-6", className)}
    {...props}
  />
))
CardHeader.displayName = "CardHeader"

const CardTitle = React.forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, ...props }, ref) => (
  <h3
    ref={ref}
    className={cn("font-semibold leading-none tracking-tight", className)}
    {...props}
  />
))
CardTitle.displayName = "CardTitle"

const CardContent = React.forwardRef<HTMLDivElement, CardContentProps>(({ className, ...props }, ref) => (
  <div 
    ref={ref} 
    className={cn("p-6 pt-0", className)}
    {...props} 
  />
))
CardContent.displayName = "CardContent"

export { Card, CardHeader, CardTitle, CardContent }
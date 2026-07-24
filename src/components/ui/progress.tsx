"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

function Progress({
  className,
  value,
  max = 100,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & {
  value?: number
  max?: number
}) {
  return (
    <div
      className={cn(
        "relative h-2 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-primary transition-all duration-300 ease-out"
        style={{
          width: `${Math.min(Math.max(value || 0, 0), max) / max * 100}%`,
        }}
      />
    </div>
  )
}

export { Progress }
import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// the project's own type scale and radius (index.css), so merging never drops them as colours
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["caption", "data", "figure", "display", "hero"],
      radius: ["panel"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

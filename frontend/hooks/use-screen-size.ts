import * as React from "react"

// Tailwind breakpoints
const BREAKPOINTS = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
} as const

type Breakpoint = keyof typeof BREAKPOINTS

type ScreenSize = "sm" | "md" | "lg" | "xl" | "2xl"

/**
 * Hook to get the current screen size based on Tailwind breakpoints
 * Returns the largest breakpoint that the current window width satisfies
 */
export function useScreenSize(): ScreenSize {
  const [screenSize, setScreenSize] = React.useState<ScreenSize>("md")

  React.useEffect(() => {
    const updateScreenSize = () => {
      const width = window.innerWidth
      if (width >= BREAKPOINTS["2xl"]) {
        setScreenSize("2xl")
      } else if (width >= BREAKPOINTS.xl) {
        setScreenSize("xl")
      } else if (width >= BREAKPOINTS.lg) {
        setScreenSize("lg")
      } else if (width >= BREAKPOINTS.md) {
        setScreenSize("md")
      } else {
        setScreenSize("sm")
      }
    }

    updateScreenSize()
    window.addEventListener("resize", updateScreenSize)
    return () => window.removeEventListener("resize", updateScreenSize)
  }, [])

  return screenSize
}

/**
 * Hook to check if the current screen is at least a certain breakpoint
 */
export function useMinScreen(breakpoint: Breakpoint): boolean {
  const [isMin, setIsMin] = React.useState(false)

  React.useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${BREAKPOINTS[breakpoint]}px)`)
    const onChange = () => setIsMin(mql.matches)

    mql.addEventListener("change", onChange)
    setIsMin(mql.matches)
    return () => mql.removeEventListener("change", onChange)
  }, [breakpoint])

  return isMin
}

/**
 * Hook to get screen-dependent sidebar limits
 * Returns min, max, and default width strings based on current screen size
 */
export function useSidebarLimits(): { min: string; max: string; default: string } {
  const screenSize = useScreenSize()

  return React.useMemo(() => {
    switch (screenSize) {
      case "2xl":
        return { min: "18rem", max: "38rem", default: "20rem" }
      case "xl":
        return { min: "16rem", max: "32rem", default: "18rem" }
      default:
        return { min: "14rem", max: "28rem", default: "16rem" }
    }
  }, [screenSize])
}

"use client"

import * as React from "react"
import { useIsMobile } from "@/hooks/use-mobile"
import { useSidebarLimits } from "@/hooks/use-screen-size"
import { useSidebarResize } from "@/hooks/use-sidebar-resize"
import { mergeButtonRefs } from "@/lib/merge-button-refs"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const RIGHT_SIDEBAR_WIDTH_MOBILE = "80vw"
const RIGHT_SIDEBAR_KEYBOARD_SHORTCUT = "g"

type RightSidebarContextProps = {
  state: "expanded" | "collapsed"
  open: boolean
  setOpen: (open: boolean) => void
  openMobile: boolean
  setOpenMobile: (open: boolean) => void
  isMobile: boolean
  toggleSidebar: () => void
  width: string
  setWidth: (width: string) => void
  isDraggingRail: boolean
  setIsDraggingRail: (isDragging: boolean) => void
}

const RightSidebarContext = React.createContext<RightSidebarContextProps | null>(null)

function useRightSidebar() {
  const context = React.useContext(RightSidebarContext)
  if (!context) {
    throw new Error("useRightSidebar must be used within a RightSidebarProvider.")
  }
  return context
}

function RightSidebarProvider({
  defaultOpen = false,
  open: openProp,
  onOpenChange: setOpenProp,
  className,
  style,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
}) {
  const isMobile = useIsMobile()
  const { default: defaultWidth } = useSidebarLimits()
  const [openMobile, setOpenMobile] = React.useState(false)
  const [_open, _setOpen] = React.useState(defaultOpen)
  const [width, setWidth] = React.useState(defaultWidth)
  const [isDraggingRail, setIsDraggingRail] = React.useState(false)

  // Update width when screen size changes and current width is at the old default
  React.useEffect(() => {
    setWidth(prev => {
      // Only auto-update if the user hasn't manually resized
      const prevNum = parseFloat(prev)
      const defaultNum = parseFloat(defaultWidth)
      // If within 1rem of any default value, update to new default
      if (Math.abs(prevNum - defaultNum) < 1 || prevNum < parseFloat(defaultWidth)) {
        return defaultWidth
      }
      return prev
    })
  }, [defaultWidth])

  const open = openProp ?? _open
  const setOpen = React.useCallback(
    (value: boolean | ((value: boolean) => boolean)) => {
      const openState = typeof value === "function" ? value(open) : value
      if (setOpenProp) {
        setOpenProp(openState)
      } else {
        _setOpen(openState)
      }
    },
    [setOpenProp, open]
  )

  const toggleSidebar = React.useCallback(() => {
    return isMobile ? setOpenMobile((open) => !open) : setOpen((open) => !open)
  }, [isMobile, setOpen])

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        event.key === RIGHT_SIDEBAR_KEYBOARD_SHORTCUT &&
        (event.metaKey || event.ctrlKey)
      ) {
        event.preventDefault()
        toggleSidebar()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [toggleSidebar])

  const state = open ? "expanded" : "collapsed"

  const contextValue = React.useMemo<RightSidebarContextProps>(
    () => ({
      state,
      open,
      setOpen,
      isMobile,
      openMobile,
      setOpenMobile,
      toggleSidebar,
      width,
      setWidth,
      isDraggingRail,
      setIsDraggingRail,
    }),
    [state, open, setOpen, isMobile, openMobile, toggleSidebar, width, isDraggingRail]
  )

  return (
    <RightSidebarContext.Provider value={contextValue}>
      <div
        data-slot="right-sidebar-wrapper"
        style={
          {
            "--right-sidebar-width": width,
            "--right-sidebar-width-mobile": RIGHT_SIDEBAR_WIDTH_MOBILE,
            ...style,
          } as React.CSSProperties
        }
        className={cn("flex min-h-svh w-full", className)}
        {...props}
      >
        {children}
      </div>
    </RightSidebarContext.Provider>
  )
}

function RightSidebar({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  const { isMobile, state, openMobile, setOpenMobile, isDraggingRail } = useRightSidebar()

  if (isMobile) {
    return (
      <Sheet open={openMobile} onOpenChange={setOpenMobile}>
        <SheetContent
          data-slot="right-sidebar"
          data-mobile="true"
          side="right"
          className={cn(
            "w-[var(--right-sidebar-width-mobile)] p-0 [&>button]:hidden",
            className
          )}
          style={
            {
              "--right-sidebar-width-mobile": RIGHT_SIDEBAR_WIDTH_MOBILE,
            } as React.CSSProperties
          }
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Chat Sidebar</SheetTitle>
            <SheetDescription>AI assistant sidebar</SheetDescription>
          </SheetHeader>
          <div className="flex h-full w-full flex-col">{children}</div>
        </SheetContent>
      </Sheet>
    )
  }

  return (
    <div
      className="group peer text-sidebar-foreground hidden md:block"
      data-state={state}
      data-collapsible={state === "collapsed" ? "offcanvas" : ""}
      data-side="right"
      data-slot="right-sidebar"
      data-dragging={isDraggingRail}
    >
      {/* Gap element for layout */}
      <div
        data-slot="right-sidebar-gap"
        className={cn(
          "relative w-[var(--right-sidebar-width)] bg-transparent transition-[width] duration-200 ease-linear",
          "group-data-[collapsible=offcanvas]:w-0",
          "group-data-[dragging=true]:duration-0 group-data-[dragging=true]:*:duration-0"
        )}
      />
      {/* Fixed sidebar container */}
      <div
        data-slot="right-sidebar-container"
        className={cn(
          "fixed inset-y-0 right-0 z-10 hidden h-svh w-[var(--right-sidebar-width)] border-l bg-sidebar transition-[right,width] duration-200 ease-linear md:flex",
          "group-data-[collapsible=offcanvas]:right-[calc(var(--right-sidebar-width)*-1)]",
          "group-data-[dragging=true]:duration-0 group-data-[dragging=true]:*:duration-0",
          className
        )}
        {...props}
      >
        <div
          data-slot="right-sidebar-inner"
          className="flex h-full w-full flex-col bg-background"
        >
          {children}
        </div>
      </div>
    </div>
  )
}

const RightSidebarRail = React.forwardRef<
  HTMLButtonElement,
  React.ComponentProps<"button">
>(({ className, ...props }, ref) => {
  const { toggleSidebar, setWidth, state, width, setIsDraggingRail } = useRightSidebar()
  const { min: minResizeWidth, max: maxResizeWidth } = useSidebarLimits()

  const { dragRef, handleMouseDown } = useSidebarResize({
    direction: "left",
    enableDrag: true,
    onResize: setWidth,
    onToggle: toggleSidebar,
    currentWidth: width,
    isCollapsed: state === "collapsed",
    minResizeWidth,
    maxResizeWidth,
    setIsDraggingRail,
    widthCookieName: "right-sidebar:width",
    widthCookieMaxAge: 60 * 60 * 24 * 7, // 1 week
  })

  const combinedRef = React.useMemo(
    () => mergeButtonRefs([ref, dragRef]),
    [ref, dragRef]
  )

  return (
    <button
      ref={combinedRef}
      data-sidebar="rail"
      aria-label="Toggle Sidebar"
      tabIndex={-1}
      onMouseDown={handleMouseDown}
      title="Drag to resize or click to toggle"
      className={cn(
        "absolute inset-y-0 z-20 hidden w-4 -translate-x-1/2 transition-all ease-linear after:absolute after:inset-y-0 after:left-1/2 after:w-[2px] hover:after:bg-sidebar-border sm:flex",
        "cursor-ew-resize",
        "group-data-[collapsible=offcanvas]:translate-x-0 group-data-[collapsible=offcanvas]:after:left-full hover:group-data-[collapsible=offcanvas]:bg-sidebar",
        "-left-0 group-data-[collapsible=offcanvas]:-left-2",
        className
      )}
      {...props}
    />
  )
})
RightSidebarRail.displayName = "RightSidebarRail"

function RightSidebarTrigger({
  className,
  onClick,
  children,
  ...props
}: React.ComponentProps<"button">) {
  const { toggleSidebar } = useRightSidebar()

  return (
    <button
      data-slot="right-sidebar-trigger"
      className={className}
      onClick={(event) => {
        onClick?.(event)
        toggleSidebar()
      }}
      {...props}
    >
      {children}
    </button>
  )
}

function RightSidebarHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="right-sidebar-header"
      className={cn("flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

function RightSidebarContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="right-sidebar-content"
      className={cn("flex min-h-0 flex-1 flex-col overflow-auto", className)}
      {...props}
    />
  )
}

function RightSidebarFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="right-sidebar-footer"
      className={cn("flex flex-col gap-2 p-4", className)}
      {...props}
    />
  )
}

export {
  RightSidebar,
  RightSidebarContent,
  RightSidebarFooter,
  RightSidebarHeader,
  RightSidebarProvider,
  RightSidebarRail,
  RightSidebarTrigger,
  useRightSidebar,
}

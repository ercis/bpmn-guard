"use client"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { Sparkles } from "lucide-react"
import { RightSidebarTrigger, useRightSidebar } from "@/components/ui/right-sidebar"
import { cn } from "@/lib/utils"

function isReportDetailPage(pathname: string): boolean {
  const reportDetailRegex = /^\/dashboard\/reports\/[^/]+$/
  return reportDetailRegex.test(pathname)
}

interface ChatTriggerProps {
  className?: string
}

export function ChatTrigger({ className }: ChatTriggerProps) {
  const pathname = usePathname();
  const { open, setOpen } = useRightSidebar();
  const isOnReportPage = isReportDetailPage(pathname);

  // Close sidebar on pathname change (cleanup runs when pathname changes)
  useEffect(() => {
    return () => setOpen(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  // Only show trigger when on report page and sidebar is closed
  if (!isOnReportPage || open) {
    return null
  }

  return (
    <RightSidebarTrigger className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors text-sm font-medium cursor-pointer", className)}>
      <Sparkles className="h-4 w-4" />
      <span>Ask BPMN Guard</span>
    </RightSidebarTrigger>
  )
}

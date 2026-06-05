"use client"

import * as React from "react"
import {
  Command,
  FileCheck,
  Workflow,
  CircleHelp,
  X,
  LayoutDashboard,
} from "lucide-react"
import { useRouter } from "next/navigation"

import { NavMain } from "@/components/sidebar/nav-main"
import { NavSecondary } from "@/components/sidebar/nav-secondary"
import { NavUser } from "@/components/sidebar/nav-user"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useHealth } from "@/hooks/use-health"


const data = {
  navMain: [
    {
      title: "Dashboard",
      url: "/dashboard",
      icon: LayoutDashboard,
    },
    {
      title: "Evaluations",
      icon: FileCheck,
      isActive: true,
      items: [
        {
          title: "Overview Reports",
          url: "/dashboard/reports",
        },
        {
          title: "New Analysis",
          url: "/dashboard/analysis/new",
        },
        {
          title: "Running Analysis",
          url: "/dashboard/analysis",
        },
      ],
    },
    {
      title: "Models",
      icon: Workflow,
      isActive: true,
      items: [
        {
          title: "All Models",
          url: "/dashboard/models",
        },
        {
          title: "Upload New",
          url: "/dashboard/models/upload",
        },
      ],
    }
  ],
  secondary: [
    {
      name: "Help",
      url: "/dashboard/help",
      icon: CircleHelp,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const router = useRouter()
  const { data: health, isError, isLoading } = useHealth()
  const { isMobile, setOpenMobile } = useSidebar()

  const isHealthy = health?.status === 'ok'
  const isUnreachable = isError || health?.status === 'unreachable'

  const handleHealthClick = () => {
    if (!isHealthy) {
      router.push('/dashboard/status')
    }
  }

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center">
              <SidebarMenuButton size="lg" className="flex-1">
                <div className="bg-sidebar-primary text-sidebar-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg">
                  <Command className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">BPMN Guard</span>
                  {isLoading ? (
                    <div className="flex items-center gap-1.5 text-xs truncate">
                      <span className="size-2 rounded-full bg-muted animate-pulse" />
                      <span className="bg-muted animate-pulse rounded h-3 w-10" />
                    </div>
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <div
                          onClick={handleHealthClick}
                          role="button"
                          tabIndex={0}
                          onKeyDown={(e) => e.key === 'Enter' && handleHealthClick()}
                          className={`flex items-center gap-1.5 text-xs truncate ${!isHealthy ? 'cursor-pointer hover:underline' : ''}`}
                        >
                          <span
                            className={`size-2 rounded-full ${
                              isUnreachable
                                ? 'bg-red-500'
                                : isHealthy
                                  ? 'bg-green-500'
                                  : 'bg-yellow-500'
                            }`}
                          />
                          {isUnreachable ? 'Offline' : isHealthy ? 'Online' : 'Degraded'}
                        </div>
                      </TooltipTrigger>
                      <TooltipContent side="right" sideOffset={8}>
                        <div className="flex flex-col gap-0.5 min-w-[140px]">
                          <div className="flex items-center gap-2">
                            <span
                              className={`size-2 rounded-full ${
                                isUnreachable
                                  ? 'bg-red-400'
                                  : isHealthy
                                    ? 'bg-green-400'
                                    : 'bg-yellow-400'
                              }`}
                            />
                            <span className="font-semibold">
                              {isUnreachable ? 'Offline' : isHealthy ? 'Operational' : 'Degraded'}
                            </span>
                          </div>
                          {health?.responseTimeMs !== undefined && (
                            <div className="flex justify-between text-[11px] opacity-80 pt-1 border-t border-white/20 mt-1">
                              <span>Latency</span>
                              <span className="font-mono">{health.responseTimeMs} ms</span>
                            </div>
                          )}
                        </div>
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </SidebarMenuButton>
              {isMobile && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setOpenMobile(false)}
                  className="h-8 w-8 shrink-0"
                >
                  <X className="h-4 w-4" />
                  <span className="sr-only">Close sidebar</span>
                </Button>
              )}
            </div>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
        <NavSecondary projects={data.secondary} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

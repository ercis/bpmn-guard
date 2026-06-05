'use client';

import { useEffect, useRef, useState, useMemo } from 'react';
import BpmnViewer from 'bpmn-js/lib/NavigatedViewer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ZoomIn, ZoomOut, Maximize2, Eye, EyeOff, X, Layers, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { EvaluationReport } from '@/types/schemas';

// Import bpmn-js styles
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

async function fetchBpmnXml(modelId: string): Promise<string> {
  const response = await fetch(`/api/models/${modelId}/file`);
  if (!response.ok) {
    throw new Error(`Failed to download BPMN file: ${response.status}`);
  }
  return await response.text();
}

interface BPMNVisualizationComponentProps {
  report: EvaluationReport;
}

type IssueType = 'error' | 'warning' | 'info' | 'semantic';

interface ElementIssue {
  type: IssueType;
  message: string;
  source: string;
}

interface GroupedElementIssues {
  elementId: string;
  issues: ElementIssue[];
  errorCount: number;
  warningCount: number;
  infoCount: number;
  semanticCount: number;
}



// Type definition for bpmn-js EventBus service
interface EventBus {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on(event: string, callback: (event: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  off(event: string, callback: (event: any) => void): void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fire(event: string, data?: any): void;
}

// Type definition for bpmn-js Canvas service
interface Canvas {
  zoom(zoom: number | 'fit-viewport'): number;
  zoom(): number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  viewbox(box?: { x: number; y: number; width: number; height: number }): any;
  addMarker(elementId: string, marker: string): void;
  removeMarker(elementId: string, marker: string): void;
}

// Helper function to determine marker class based on highest severity issue
function getElementMarker(group: GroupedElementIssues): string {
  if (group.errorCount > 0) {
    return 'issue-error';
  }
  if (group.warningCount > 0) {
    return 'issue-warning';
  }
  if (group.semanticCount > 0) {
    return 'issue-semantic';
  }
  if (group.infoCount > 0) {
    return 'issue-info';
  }
  // Default (should not reach here)
  return 'issue-default';
}

// Collect and group all issues by element ID from the report
function collectAndGroupIssues(report: EvaluationReport): Map<string, GroupedElementIssues> {
  const issuesByElement = new Map<string, ElementIssue[]>();

  const addIssue = (elementId: string, issue: ElementIssue) => {
    const existing = issuesByElement.get(elementId) || [];
    existing.push(issue);
    issuesByElement.set(elementId, existing);
  };

  // Syntax check issues
  if (report.syntax_check?.issues) {
    for (const rule of report.syntax_check.issues) {
      for (const issue of rule.issues) {
        if (issue.id) {
          addIssue(issue.id, {
            type: issue.category === 'error' ? 'error' : 'warning',
            message: issue.message,
            source: `Syntax: ${rule.rule_name}`,
          });
        }
      }
    }
  }

  // Semantic label check violations
  if (report.semantic_label_check?.violations) {
    for (const violation of report.semantic_label_check.violations) {
      if (violation.bpmn_element_id) {
        addIssue(violation.bpmn_element_id, {
          type: 'semantic',
          message: violation.explanation,
          source: `Semantic: ${violation.rule_id}`,
        });
      }
    }
  }

  // Custom rules check issues
  if (report.custom_rules_check?.checks) {
    for (const check of report.custom_rules_check.checks) {
      for (const issue of check.issues) {
        if (issue.element_id) {
          addIssue(issue.element_id, {
            type: issue.category === 'error' ? 'error' : issue.category === 'warning' ? 'warning' : 'info',
            message: issue.message,
            source: `Custom: ${check.check_name}`,
          });
        }
      }
    }
  }

  // Group issues with counts
  const groupedIssues = new Map<string, GroupedElementIssues>();

  issuesByElement.forEach((issues, elementId) => {
    const errorCount = issues.filter(i => i.type === 'error').length;
    const warningCount = issues.filter(i => i.type === 'warning').length;
    const infoCount = issues.filter(i => i.type === 'info').length;
    const semanticCount = issues.filter(i => i.type === 'semantic').length;

    groupedIssues.set(elementId, {
      elementId,
      issues,
      errorCount,
      warningCount,
      infoCount,
      semanticCount,
    });
  });

  return groupedIssues;
}

// Generate overlay HTML with max one icon per issue type


interface TooltipState {
  visible: boolean;
  x: number;
  y: number;
  elementId: string;
  issues: GroupedElementIssues | null;
}

export function BPMNVisualizationComponent({ report }: BPMNVisualizationComponentProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<BpmnViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showOverlays, setShowOverlays] = useState(true);
  const [containerWidth, setContainerWidth] = useState(400);
  const [tooltip, setTooltip] = useState<TooltipState>({
    visible: false,
    x: 0,
    y: 0,
    elementId: '',
    issues: null,
  });

  // Collect and group issues from the report
  const groupedIssues = useMemo(() => collectAndGroupIssues(report), [report]);

  // Ref to always access current groupedIssues in event handlers
  const groupedIssuesRef = useRef(groupedIssues);
  useEffect(() => {
    groupedIssuesRef.current = groupedIssues;
  }, [groupedIssues]);

  // Calculate total counts
  const totalCounts = useMemo(() => {
    const counts = {
      errors: 0,
      warnings: 0,
      info: 0,
      semantic: 0,
      elements: groupedIssues.size,
    };

    groupedIssues.forEach((group) => {
      counts.errors += group.errorCount;
      counts.warnings += group.warningCount;
      counts.info += group.infoCount;
      counts.semantic += group.semanticCount;
    });

    return counts;
  }, [groupedIssues]);

  const totalIssues = totalCounts.errors + totalCounts.warnings + totalCounts.info + totalCounts.semantic;

  // Add overlays to the diagram
  const addOverlays = (viewer: BpmnViewer) => {
    try {
      const canvas = viewer.get<Canvas>('canvas');

      groupedIssues.forEach((group, elementId) => {
        try {
          const marker = getElementMarker(group);
          canvas.addMarker(elementId, marker);
        } catch (err) {
          console.warn(`Could not add marker to element ${elementId}:`, err);
        }
      });
    } catch (err) {
      console.warn('Could not get canvas service:', err);
    }
  };

  // Track previous issues to properly remove old markers
  const previousGroupedIssuesRef = useRef<Map<string, GroupedElementIssues>>(new Map());

  // Remove markers from all elements (uses the provided issue map, not current state)
  const removeOverlays = (viewer: BpmnViewer, issuesToRemove: Map<string, GroupedElementIssues>) => {
    try {
      const canvas = viewer.get<Canvas>('canvas');

      issuesToRemove.forEach((group, elementId) => {
        try {
          const marker = getElementMarker(group);
          canvas.removeMarker(elementId, marker);
        } catch (err) {
          console.warn(`Could not remove marker from element ${elementId}:`, err);
        }
      });
    } catch (err) {
      console.warn('Could not get canvas service:', err);
    }
  };


  // Setup click event handlers
  const setupClickHandlers = (viewer: BpmnViewer) => {
    try {
      const eventBus = viewer.get<EventBus>('eventBus');

      eventBus.on('element.click', (event: { element: { id: string }; originalEvent: MouseEvent }) => {
        const elementId = event.element.id;
        // Use ref to get current groupedIssues (not stale closure value)
        const currentGroupedIssues = groupedIssuesRef.current;

        if (currentGroupedIssues.has(elementId)) {
          const container = containerRef.current;
          if (!container) return;

          const containerRect = container.getBoundingClientRect();

          // Update container width for tooltip positioning
          setContainerWidth(container.clientWidth);

          setTooltip({
            visible: true,
            x: event.originalEvent.clientX - containerRect.left,
            y: event.originalEvent.clientY - containerRect.top,
            elementId: elementId,
            issues: currentGroupedIssues.get(elementId) || null,
          });
        } else {
          // Close tooltip when clicking elsewhere
          setTooltip(prev => ({ ...prev, visible: false }));
        }
      });
    } catch (err) {
      console.warn('Could not setup click handlers:', err);
    }
  };

  useEffect(() => {
    if (!containerRef.current || !report.model_id) return;

    const initVisualization = async () => {
      try {
        setLoading(true);
        setError(null);

        const bpmnContent = await fetchBpmnXml(report.model_id);

        // Clean up previous instance
        if (viewerRef.current) {
          viewerRef.current.destroy();
          viewerRef.current = null;
        }

        // Clear the container
        if (containerRef.current) {
          containerRef.current.innerHTML = '';
        }

        // Initialize bpmn-js viewer
        const viewer = new BpmnViewer({
          container: containerRef.current!,
        });

        viewerRef.current = viewer;

        // Import the BPMN diagram
        await viewer.importXML(bpmnContent);

        // Fit to viewport (guard against non-finite zoom calculations)
        const canvas = viewer.get<Canvas>('canvas');
        const container = containerRef.current;
        if (container && container.clientWidth > 0 && container.clientHeight > 0) {
          try {
            // Get viewbox to validate diagram bounds
            const viewbox = canvas.viewbox();

            // Only fit if diagram has valid bounds
            if (viewbox &&
                viewbox.width > 0 &&
                viewbox.height > 0 &&
                isFinite(viewbox.width) &&
                isFinite(viewbox.height)) {
              canvas.zoom('fit-viewport');
            } else {
              canvas.zoom(1);
            }
          } catch (err) {
            console.warn('Initial fit-to-screen failed, using default zoom:', err);
            canvas.zoom(1);
          }
        } else {
          canvas.zoom(1);
        }

        // Setup click handlers for elements with issues
        setupClickHandlers(viewer);

        // Apply overlays if enabled
        if (showOverlays && groupedIssues.size > 0) {
          addOverlays(viewer);
        }

        setLoading(false);
      } catch (err) {
        console.error('Error loading BPMN content:', err);
        setError(err instanceof Error ? err.message : 'Failed to load BPMN diagram');
        setLoading(false);
      }
    };

    initVisualization();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [report.model_id]);

  // Handle overlay toggle and issue changes
  useEffect(() => {
    if (!viewerRef.current || loading) return;

    // Always remove previous markers first (handles excluded issues)
    if (previousGroupedIssuesRef.current.size > 0) {
      removeOverlays(viewerRef.current, previousGroupedIssuesRef.current);
    }

    // Add current markers if overlays are enabled
    if (showOverlays && groupedIssues.size > 0) {
      addOverlays(viewerRef.current);
    }

    // Update the ref with current issues for next comparison
    previousGroupedIssuesRef.current = new Map(groupedIssues);
  }, [showOverlays, loading, groupedIssues]);

  const handleZoomIn = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get<Canvas>('canvas')
      canvas.zoom(canvas.zoom() * 1.2);
    }
  };

  const handleZoomOut = () => {
    if (viewerRef.current) {
      const canvas = viewerRef.current.get<Canvas>('canvas');
      canvas.zoom(canvas.zoom() / 1.2);
    }
  };

  const handleFitToScreen = () => {
    if (viewerRef.current && containerRef.current) {
      const canvas = viewerRef.current.get<Canvas>('canvas');
      const container = containerRef.current;

      // Guard against non-finite zoom calculations
      if (container.clientWidth > 0 && container.clientHeight > 0) {
        try {
          // Get current viewbox to check diagram bounds
          const viewbox = canvas.viewbox();

          // Validate diagram has valid bounds before fitting
          if (viewbox &&
              viewbox.width > 0 &&
              viewbox.height > 0 &&
              isFinite(viewbox.width) &&
              isFinite(viewbox.height)) {
            canvas.zoom('fit-viewport');
          } else {
            // Diagram has invalid bounds, fix with default zoom then retry
            canvas.zoom(1);
            canvas.zoom('fit-viewport');
          }
        } catch (err) {
          // If fit-viewport fails, fix state with default zoom then retry
          console.warn('Fit-to-screen failed, fixing state and retrying...', err);
          canvas.zoom(1);
          canvas.zoom('fit-viewport');
        }
      } else {
        // Container has invalid dimensions, use default zoom
        canvas.zoom(1);
      }
    }
  };

  const closeTooltip = () => {
    setTooltip(prev => ({ ...prev, visible: false }));
  };

  const [copied, setCopied] = useState(false);

  const handleCopyIssues = async () => {
    if (!tooltip.issues) return;

    const issuesText = tooltip.issues.issues
      .map((issue) => `[${issue.type.toUpperCase()}] ${issue.source}\n${issue.message}`)
      .join('\n\n');

    const textToCopy = `Element: ${tooltip.elementId}\nIssues: ${tooltip.issues.issues.length}\n\n${issuesText}`;

    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-xl shrink-0">
              <Layers className="h-5 w-5" />
              BPMN Model Visualization
            </CardTitle>
            {!loading && !error && (
              <div className="flex gap-2 shrink-0">
                {totalIssues > 0 && (
                  <Button variant={showOverlays ? 'default' : 'outline'} size="sm" onClick={() => setShowOverlays(!showOverlays)} className="hover:cursor-pointer">
                    {showOverlays ? <><Eye className="h-4 w-4" />Issues</> : <><EyeOff className="h-4 w-4" />Issues</>}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleZoomOut} className="hover:cursor-pointer">
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleZoomIn} className="hover:cursor-pointer">
                  <ZoomIn className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={handleFitToScreen} className="hover:cursor-pointer">
                  <Maximize2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
          {!loading && !error && totalIssues > 0 && (
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="outline" className="text-xs">
                {totalCounts.elements} element{totalCounts.elements !== 1 ? 's' : ''} with issues
              </Badge>
              {totalCounts.errors > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {totalCounts.errors} error{totalCounts.errors !== 1 ? 's' : ''}
                </Badge>
              )}
              {totalCounts.warnings > 0 && (
                <Badge variant="secondary" className="text-xs bg-yellow-500 text-black hover:bg-yellow-500/80">
                  {totalCounts.warnings} warning{totalCounts.warnings !== 1 ? 's' : ''}
                </Badge>
              )}
              {totalCounts.semantic > 0 && (
                <Badge variant="secondary" className="text-xs bg-purple-600 text-white hover:bg-purple-600/80">
                  {totalCounts.semantic} semantic
                </Badge>
              )}
              {totalCounts.info > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {totalCounts.info} info
                </Badge>
              )}
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="flex items-center justify-center h-[250px] sm:h-[clamp(300px,50vh,700px)]">
            <div className="space-y-4 text-center">
              <Skeleton className="h-64 w-full" />
              <p className="text-sm text-muted-foreground">Loading BPMN diagram...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center h-[250px] sm:h-[clamp(300px,50vh,700px)] gap-3">
            <AlertCircle className="h-12 w-12 text-destructive" />
            <p className="text-destructive text-center">{error}</p>
          </div>
        )}

        <div className="relative">
          <div
            ref={containerRef}
            className={`w-full h-[250px] sm:h-[clamp(300px,50vh,700px)] overflow-hidden rounded-md border bg-white ${loading || error ? 'hidden' : ''}`}
          />

          {/* Issue Tooltip */}
          {tooltip.visible && tooltip.issues && (
            <div
              className="absolute z-50 bg-popover border rounded-lg shadow-lg p-3 max-w-sm"
              style={{
                left: Math.min(tooltip.x, containerWidth - 320),
                top: Math.max(tooltip.y - 10, 10),
                transform: 'translateY(-100%)',
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-semibold text-sm">Element: {tooltip.elementId}</p>
                  <p className="text-xs text-muted-foreground">
                    {tooltip.issues.issues.length} issue{tooltip.issues.issues.length !== 1 ? 's' : ''}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 hover:cursor-pointer"
                          onClick={handleCopyIssues}
                        >
                          {copied ? (
                            <Check className="h-4 w-4 text-green-500" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{copied ? 'Copied!' : 'Copy issues'}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 hover:cursor-pointer"
                    onClick={closeTooltip}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {tooltip.issues.issues.map((issue) => (
                  <div
                    key={`${issue.source}-${issue.message}`}
                    className={`text-xs p-2 rounded border-l-2 ${
                      issue.type === 'error'
                        ? 'bg-red-50 dark:bg-red-950/30 border-red-500'
                        : issue.type === 'warning'
                        ? 'bg-yellow-50 dark:bg-yellow-950/30 border-yellow-500'
                        : issue.type === 'semantic'
                        ? 'bg-purple-50 dark:bg-purple-950/30 border-purple-500'
                        : 'bg-blue-50 dark:bg-blue-950/30 border-blue-500'
                    }`}
                  >
                    <p className="font-medium text-muted-foreground mb-0.5">{issue.source}</p>
                    <p>{issue.message}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Legend */}
        {!loading && !error && showOverlays && totalIssues > 0 && (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 text-xs text-muted-foreground">
            <span className="font-medium">Element colors (click for details):</span>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-4 w-6 rounded border-2" style={{ borderColor: '#dc2626', backgroundColor: '#fee2e2' }}></span>
                <span>Error</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-4 w-6 rounded border-2" style={{ borderColor: '#f59e0b', backgroundColor: '#fef3c7' }}></span>
                <span>Warning</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-4 w-6 rounded border-2" style={{ borderColor: '#7c3aed', backgroundColor: '#ede9fe' }}></span>
                <span>Semantic</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="inline-block h-4 w-6 rounded border-2" style={{ borderColor: '#2563eb', backgroundColor: '#dbeafe' }}></span>
                <span>Info</span>
              </div>
            </div>
          </div>
        )}

        {/* Element Marker Styles */}
        <style jsx global>{`
          /* Error marker - Red */
          .issue-error:not(.djs-connection) .djs-visual > :nth-child(1) {
            stroke: #dc2626 !important;
            fill: #fee2e2 !important;
          }

          /* Warning marker - Orange */
          .issue-warning:not(.djs-connection) .djs-visual > :nth-child(1) {
            stroke: #f59e0b !important;
            fill: #fef3c7 !important;
          }

          /* Semantic marker - Purple */
          .issue-semantic:not(.djs-connection) .djs-visual > :nth-child(1) {
            stroke: #7c3aed !important;
            fill: #ede9fe !important;
          }

          /* Info marker - Blue */
          .issue-info:not(.djs-connection) .djs-visual > :nth-child(1) {
            stroke: #2563eb !important;
            fill: #dbeafe !important;
          }

          /* Connections (sequence flows, etc.) - Line coloring */
          .issue-error.djs-connection .djs-visual > path {
            stroke: #dc2626 !important;
            stroke-width: 2px !important;
          }

          .issue-warning.djs-connection .djs-visual > path {
            stroke: #f59e0b !important;
            stroke-width: 2px !important;
          }

          .issue-semantic.djs-connection .djs-visual > path {
            stroke: #7c3aed !important;
            stroke-width: 2px !important;
          }

          .issue-info.djs-connection .djs-visual > path {
            stroke: #2563eb !important;
            stroke-width: 3px !important;
          }

        `}</style>
      </CardContent>
    </Card>
  );
}

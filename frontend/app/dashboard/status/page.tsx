'use client';

import { useEffect, useState } from 'react';
import { useHealth, getHealthHistory, type HealthCheckEntry } from '@/hooks/use-health';
import { formatTime } from '@/lib/date';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, CheckCircle2, XCircle, RefreshCw, Clock, Zap, Database, Bot, FileCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

const REFRESH_INTERVAL = 30;
const MAX_HISTORY = 30;

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { color: string; label: string }> = {
    ok: { color: 'bg-green-100 text-green-800', label: '200' },
    error: { color: 'bg-red-100 text-red-800', label: '500' },
    unreachable: { color: 'bg-red-100 text-red-800', label: '503' },
    not_configured: { color: 'bg-yellow-100 text-yellow-800', label: 'Not Configured' },
    degraded: { color: 'bg-yellow-100 text-yellow-800', label: 'Degraded' },
    unknown: { color: 'bg-gray-100 text-gray-800', label: 'Unknown' },
  };

  const { color, label } = config[status] || config.unknown;

  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${color}`}>
      {label}
    </span>
  );
}

function ResponseTimeIndicator({ ms }: { ms?: number }) {
  if (!ms) return null;

  let color = 'text-green-600 bg-green-50';
  let label = 'Fast';

  if (ms > 1000) {
    color = 'text-red-600 bg-red-50';
    label = 'Slow';
  } else if (ms > 500) {
    color = 'text-yellow-600 bg-yellow-50';
    label = 'OK';
  }

  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-sm font-medium ${color}`}>
      <Zap className="h-3.5 w-3.5" />
      {ms}ms
      <span className="text-xs opacity-75">({label})</span>
    </div>
  );
}

function CountdownTimer({ lastChecked, onRefresh, isFetching }: {
  lastChecked: number | null;
  onRefresh: () => void;
  isFetching: boolean;
}) {
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(REFRESH_INTERVAL);

  useEffect(() => {
    if (!lastChecked) return;

    const interval = setInterval(() => {
      const elapsed = Math.floor((Date.now() - lastChecked) / 1000);
      const remaining = Math.max(0, REFRESH_INTERVAL - elapsed);
      setSecondsUntilRefresh(remaining);
    }, 1000);

    return () => clearInterval(interval);
  }, [lastChecked]);

  return (
    <div className="flex items-center gap-4 text-sm text-muted-foreground">
      {lastChecked && (
        <span className="flex items-center gap-1.5">
          <Clock className="h-4 w-4" />
          Last checked: {formatTime(lastChecked)}
        </span>
      )}
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={isFetching}
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
        {isFetching ? 'Checking...' : `Refresh (${secondsUntilRefresh}s)`}
      </Button>
    </div>
  );
}

function HeroStatus({ status, isLoading }: { status: string; isLoading: boolean }) {
  const config = {
    ok: {
      bg: 'bg-green-500',
      text: 'All Systems Operational',
      icon: CheckCircle2,
    },
    degraded: {
      bg: 'bg-yellow-500',
      text: 'Partial System Outage',
      icon: AlertCircle,
    },
    error: {
      bg: 'bg-red-500',
      text: 'Major System Outage',
      icon: XCircle,
    },
    unreachable: {
      bg: 'bg-red-500',
      text: 'Backend Unreachable',
      icon: XCircle,
    },
    timeout: {
      bg: 'bg-red-500',
      text: 'Backend Timeout',
      icon: XCircle,
    },
    unknown: {
      bg: 'bg-gray-400',
      text: 'Checking Status...',
      icon: RefreshCw,
    },
  };

  const { bg, text, icon: Icon } = config[status as keyof typeof config] || config.unknown;

  return (
    <div className="flex flex-col items-center justify-center py-8">
      <div className={`flex items-center justify-center w-20 h-20 rounded-full ${bg}`}>
        <Icon className={`h-10 w-10 text-white ${isLoading ? 'animate-spin' : ''}`} />
      </div>
      <h2 className="mt-4 text-2xl font-bold">{text}</h2>
    </div>
  );
}

function MiniHistory({ history }: { history: HealthCheckEntry[] }) {
  if (history.length === 0) return null;

  return (
    <div className="flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-2">10 Most Recent:</span>
      {history.slice(0, 10).reverse().map((entry, i) => {
        const color = entry.status === 'ok'
          ? 'bg-green-500'
          : entry.status === 'degraded'
            ? 'bg-yellow-500'
            : 'bg-red-500';

        return (
          <Tooltip key={i}>
            <TooltipTrigger asChild>
              <div className={`w-2 h-6 rounded-sm ${color} cursor-pointer`} />
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-center">
                <div>{formatTime(entry.timestamp)}</div>
                {entry.responseTimeMs && <div className="font-medium">{entry.responseTimeMs}ms</div>}
              </div>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}

function ResponseTimeBar({ ms }: { ms?: number }) {
  if (!ms) return <div className="w-32" />;

  // Max width represents 1500ms, capped at 100%
  const percentage = Math.min((ms / 1500) * 100, 100);

  let barColor = 'bg-green-500';
  if (ms > 1000) {
    barColor = 'bg-red-500';
  } else if (ms > 500) {
    barColor = 'bg-yellow-500';
  }

  return (
    <div className="flex items-center gap-2 w-32">
      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full ${barColor} rounded-full transition-all`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">{ms}ms</span>
    </div>
  );
}

function HistoryLog({ history }: { history: HealthCheckEntry[] }) {
  if (history.length === 0) {
    return (
      <div className="text-sm text-muted-foreground text-center py-8">
        No check history yet
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {history.map((entry, i) => {
        const statusColor = entry.status === 'ok'
          ? 'border-l-green-500'
          : entry.status === 'degraded'
            ? 'border-l-yellow-500'
            : 'border-l-red-500';

        return (
          <div
            key={i}
            className={`flex items-center justify-between text-sm py-3 px-4 border-l-4 ${statusColor} bg-muted/30 hover:bg-muted/50 rounded-r transition-colors`}
          >
            <span className="text-muted-foreground font-mono text-xs">{formatTime(entry.timestamp)}</span>
            <StatusBadge status={entry.status} />
            <ResponseTimeBar ms={entry.responseTimeMs} />
          </div>
        );
      })}
    </div>
  );
}

export default function StatusPage() {
  const { data: health, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useHealth();
  const [history, setHistory] = useState<HealthCheckEntry[]>([]);

  // Load history on mount and refresh when health data changes
  // getHealthHistory is a pure function reading from localStorage with no external dependencies
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    setHistory(getHealthHistory());
  }, [dataUpdatedAt]);

  const isUnreachable = isError || health?.status === 'unreachable' || health?.status === 'timeout' || health?.status === 'error';
  const currentStatus = isLoading ? 'unknown' : (health?.status || 'unknown');

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">System Status</h1>
          <p className="text-muted-foreground">Backend service health and connectivity</p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isFetching}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Hero Status */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <HeroStatus status={currentStatus} isLoading={isLoading || isFetching} />

          {/* Response time and refresh */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-4 pt-4 border-t">
            {health?.responseTimeMs && <ResponseTimeIndicator ms={health.responseTimeMs} />}
            <CountdownTimer
              lastChecked={dataUpdatedAt || null}
              onRefresh={() => refetch()}
              isFetching={isFetching}
            />
          </div>

          {/* Mini history */}
          <div className="flex justify-center mt-4">
            <MiniHistory history={history} />
          </div>
        </CardContent>
      </Card>

      {/* Error state with troubleshooting */}
      {isUnreachable && !isLoading && (
        <Card className="border-red-200 bg-red-50 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-700">
              <XCircle className="h-6 w-6" />
              {health?.status === 'timeout' ? 'Backend Timeout' : health?.status === 'error' ? 'Backend Error' : 'Backend Unreachable'}
            </CardTitle>
            <CardDescription className="text-red-600">
              {health?.status === 'timeout'
                ? 'The backend server took too long to respond. It may be overloaded or experiencing issues.'
                : health?.status === 'error'
                  ? 'The backend server responded with an invalid response.'
                  : 'Cannot connect to the backend server. Please ensure the backend is running.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-white rounded-lg border border-red-200">
                <h3 className="font-medium mb-2">Troubleshooting Steps:</h3>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Check if the backend server is running</li>
                  <li>Verify the backend URL configuration</li>
                  <li>Check for network connectivity issues</li>
                  <li>Review backend logs for errors</li>
                </ol>
              </div>
              <div className="text-sm text-muted-foreground">
                Expected backend URL: <code className="bg-white px-2 py-0.5 rounded border">{process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000'}</code>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Services Table */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Services</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full">
            <thead>
              <tr className="border-b bg-muted/50">
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-3">Service</th>
                <th className="text-left text-sm font-medium text-muted-foreground px-6 py-3">Description</th>
                <th className="text-right text-sm font-medium text-muted-foreground px-6 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Database</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">PostgreSQL connection</td>
                <td className="px-6 py-4 text-right">
                  <StatusBadge status={health?.database || 'unknown'} />
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">LLM API</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">OpenAI / Gemini</td>
                <td className="px-6 py-4 text-right">
                  <StatusBadge status={health?.llm_api || 'unknown'} />
                </td>
              </tr>
              <tr>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <FileCheck className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">BPMN Validation</span>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-muted-foreground">bpmnlint service</td>
                <td className="px-6 py-4 text-right">
                  <StatusBadge status={health?.bpmn_validation || 'unknown'} />
                </td>
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Check History Log */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Recent Checks</CardTitle>
          <CardDescription>Last {MAX_HISTORY} health check results</CardDescription>
        </CardHeader>
        <CardContent>
          <HistoryLog history={history} />
        </CardContent>
      </Card>
    </div>
  );
}

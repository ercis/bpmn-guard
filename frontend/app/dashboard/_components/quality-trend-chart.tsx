'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReportTrend } from '@/types/schemas';
import { formatChartDate } from '@/lib/date';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface QualityTrendChartProps {
  data: ReportTrend[];
}

export function QualityTrendChart({ data }: QualityTrendChartProps) {
  // Filter out days with no data and format dates for display
  const chartData = data
    .filter((item) => item.avg_rating !== null)
    .map((item) => ({
      ...item,
      displayDate: formatChartDate(item.date),
    }));

  // Count how many days have actual data
  const daysWithData = chartData.length;

  return (
    <Card className="col-span-1 md:col-span-3">
      <CardHeader>
        <CardTitle>Model Quality Trend</CardTitle>
        <CardDescription>Average rating over the last 30 days</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="displayDate"
                tick={{ fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={[0, 10]}
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                ticks={[0, 2, 4, 6, 8, 10]}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value) =>
                  value != null ? [Number(value).toFixed(1), 'Avg Rating'] : ['N/A', 'Avg Rating']
                }
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="avg_rating"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: daysWithData <= 5 ? 6 : 3, fill: '#2563eb' }}
                activeDot={{ r: 8 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function QualityTrendChartSkeleton() {
  return (
    <Card className="col-span-1 md:col-span-3">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

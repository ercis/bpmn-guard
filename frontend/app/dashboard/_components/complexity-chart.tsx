'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ComplexityMetrics } from '@/types/schemas';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ComplexityChartProps {
  data: ComplexityMetrics;
}

export function ComplexityChart({ data }: ComplexityChartProps) {
  const chartData = [
    { name: 'CFC Score', value: data.avg_cfc_score, fill: '#3b82f6' },
    { name: 'CW Score', value: data.avg_cw_score, fill: '#8b5cf6' },
  ];

  return (
    <Card className="col-span-1 md:col-span-3">
      <CardHeader>
        <CardTitle>Complexity Overview</CardTitle>
        <CardDescription>Average CFC and Cognitive Weight scores</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value) => [Number(value).toFixed(2), 'Score']}
              />
              <Bar dataKey="value" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ComplexityChartSkeleton() {
  return (
    <Card className="col-span-1 md:col-span-3">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

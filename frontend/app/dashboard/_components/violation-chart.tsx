'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { ViolationDistribution } from '@/types/schemas';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ViolationChartProps {
  data: ViolationDistribution[];
}

const COLORS: Record<string, string> = {
  Syntax: '#ef4444',
  Semantics: '#f59e0b',
  'Custom Rules': '#3b82f6',
  Duplicates: '#8b5cf6',
};

export function ViolationChart({ data }: ViolationChartProps) {
  const chartData = data.map((item) => ({
    ...item,
    fill: COLORS[item.category] || '#6b7280',
  }));

  return (
    <Card className="col-span-1 md:col-span-4">
      <CardHeader>
        <CardTitle>Violation Distribution</CardTitle>
        <CardDescription>Issues by category across all reports</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="category" tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function ViolationChartSkeleton() {
  return (
    <Card className="col-span-1 md:col-span-4">
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

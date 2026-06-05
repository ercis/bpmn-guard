'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import type { RatingDistribution } from '@/types/schemas';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface RatingDistributionChartProps {
  data: RatingDistribution[];
}

// Color scale from red (1) to green (10)
function getRatingColor(rating: number): string {
  if (rating <= 3) return '#ef4444'; // red
  if (rating <= 5) return '#f59e0b'; // amber
  if (rating <= 7) return '#eab308'; // yellow
  return '#22c55e'; // green
}

export function RatingDistributionChart({ data }: RatingDistributionChartProps) {
  return (
    <Card className="col-span-1 md:col-span-4">
      <CardHeader>
        <CardTitle>Rating Distribution</CardTitle>
        <CardDescription>How reports are distributed across ratings 1-10</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[300px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis
                dataKey="rating"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px',
                }}
                formatter={(value) => [value ?? 0, 'Reports']}
                labelFormatter={(label) => `Rating: ${label}`}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={`cell-${entry.rating}`} fill={getRatingColor(entry.rating)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

export function RatingDistributionChartSkeleton() {
  return (
    <Card className="col-span-1 md:col-span-4">
      <CardHeader>
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-[300px] w-full" />
      </CardContent>
    </Card>
  );
}

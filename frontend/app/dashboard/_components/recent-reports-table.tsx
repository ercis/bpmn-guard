'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { RecentReport } from '@/types/schemas';
import { FileText } from 'lucide-react';
import Link from 'next/link';
import { formatDateShort } from '@/lib/date';

interface RecentReportsTableProps {
  data: RecentReport[];
}

function getScoreBadgeVariant(score: number | null): 'success' | 'secondary' | 'destructive' {
  if (score === null) return 'secondary';
  if (score >= 8) return 'success';
  if (score >= 5) return 'secondary';
  return 'destructive';
}

function getFileName(filePath: string): string {
  // Extract filename from path like "models/20260118_102826_8da5c744_Hotel.bpmn"
  const fullName = filePath.split('/').pop() || filePath;
  // Remove timestamp and UUID prefix: "20260118_102826_8da5c744_Hotel.bpmn" -> "Hotel.bpmn"
  const match = fullName.match(/^\d{8}_\d{6}_[a-f0-9]{8}_(.+)$/);
  const fileName = match ? match[1] : fullName;
  // Remove .bpmn extension
  return fileName.replace(/\.bpmn$/i, '');
}

function getComplexityColor(level: string): string {
  switch (level) {
    case 'Low':
      return 'text-green-600 bg-green-100 dark:bg-green-900/30';
    case 'Med':
      return 'text-yellow-600 bg-yellow-100 dark:bg-yellow-900/30';
    case 'High':
      return 'text-red-600 bg-red-100 dark:bg-red-900/30';
    default:
      return 'text-muted-foreground bg-muted';
  }
}

export function RecentReportsTable({ data }: RecentReportsTableProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Recent Analyses</CardTitle>
          <CardDescription>Your latest BPMN model evaluations</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground flex h-32 items-center justify-center">
            No reports yet. Run your first analysis to see results here.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Analyses</CardTitle>
        <CardDescription>Your latest BPMN model evaluations</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Model Name</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Complexity</TableHead>
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((report) => (
              <TableRow key={report.id}>
                <TableCell className="max-w-[200px] truncate font-medium" title={getFileName(report.file_name)}>
                  {getFileName(report.file_name)}
                </TableCell>
                <TableCell>{formatDateShort(report.created_at)}</TableCell>
                <TableCell>
                  <span
                    className={cn(
                      'inline-flex rounded-full px-2 py-0.5 text-xs font-medium',
                      getComplexityColor(report.complexity_level)
                    )}
                  >
                    {report.complexity_level}
                  </span>
                </TableCell>
                <TableCell>
                  <Badge variant={getScoreBadgeVariant(report.evaluation_rating)}>
                    {report.evaluation_rating !== null ? `${report.evaluation_rating}/10` : 'N/A'}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/dashboard/reports/${report.id}`}>
                      <FileText className="h-4 w-4 mr-1" />
                      Report
                    </Link>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function RecentReportsTableSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-6 w-36" />
        <Skeleton className="h-4 w-56" />
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-4 w-12" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

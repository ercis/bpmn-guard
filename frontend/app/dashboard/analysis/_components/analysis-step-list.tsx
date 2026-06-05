'use client';

import { Check, Loader2, Circle } from 'lucide-react';
import { ANALYSIS_STEPS, type AnalysisStatusValue, type StepStatus } from '@/types/schemas';
import { cn } from '@/lib/utils';

interface AnalysisStepListProps {
  stepsStatus: Record<string, StepStatus>;
  status: AnalysisStatusValue;
}

export function AnalysisStepList({ stepsStatus, status }: AnalysisStepListProps) {
  return (
    <ul className="space-y-3">
      {ANALYSIS_STEPS.map((step) => {
        const stepStatus = stepsStatus[step.id] ?? 'running';
        const isCompleted = stepStatus === 'completed';
        const isRunning = stepStatus === 'running' && status === 'running';

        return (
          <li key={step.id} className="flex items-center gap-3">
            {isCompleted ? (
              <Check className="h-5 w-5 text-green-500" />
            ) : isRunning ? (
              <Loader2 className="h-5 w-5 text-blue-500 animate-spin" />
            ) : (
              <Circle className="h-5 w-5 text-gray-300" />
            )}
            <span
              className={cn(
                isCompleted && 'text-green-700',
                isRunning && 'text-blue-700 font-medium',
                !isCompleted && !isRunning && 'text-gray-400'
              )}
            >
              {step.label}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

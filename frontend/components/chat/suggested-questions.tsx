'use client';

import { Button } from '@/components/ui/button';
import { AlertTriangle, Lightbulb } from 'lucide-react';

interface SuggestedQuestionsProps {
  onSelect: (question: string) => void;
  disabled?: boolean;
}

const SUGGESTED_QUESTIONS = [
  {
    text: "What are the main issues in my BPMN model?",
    icon: AlertTriangle,
  },
  {
    text: "How can I improve my model's quality score?",
    icon: Lightbulb,
  },
];

export function SuggestedQuestions({ onSelect, disabled }: SuggestedQuestionsProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Suggested questions:</p>
      <div className="flex flex-col gap-2">
        {SUGGESTED_QUESTIONS.map((question, index) => {
          const Icon = question.icon;
          return (
            <Button
              key={index}
              variant="outline"
              size="sm"
              className="justify-start h-auto py-2 px-3 text-left text-sm font-normal cursor-pointer"
              onClick={() => onSelect(question.text)}
              disabled={disabled}
            >
              <Icon className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
              <span className="line-clamp-2">{question.text}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}

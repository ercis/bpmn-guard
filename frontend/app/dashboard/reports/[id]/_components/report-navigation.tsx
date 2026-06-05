'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
    FileText,
    Star,
    Tags,
    CheckCircle2,
    AlertCircle,
    Layers,
    GitBranch,
    EyeOff,
    Maximize2,
    Minimize2,
} from "lucide-react";

interface ReportNavigationProps {
    hasSemanticCheck: boolean;
    hasSyntaxCheck: boolean;
    hasCustomRulesCheck: boolean;
    hasDuplicateCheck: boolean;
    hasComplexityCheck: boolean;
    hasExcludedIssues: boolean;
    hasEvaluation: boolean;
    onExpandAll: () => void;
    onCollapseAll: () => void;
}

const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

export function ReportNavigation({
    hasSemanticCheck,
    hasSyntaxCheck,
    hasCustomRulesCheck,
    hasDuplicateCheck,
    hasComplexityCheck,
    hasExcludedIssues,
    hasEvaluation,
    onExpandAll,
    onCollapseAll,
}: ReportNavigationProps) {
    const navItems = [
        { id: 'model-description', label: 'Description', icon: FileText, exists: true },
        { id: 'overall-evaluation', label: 'Evaluation', icon: Star, exists: hasEvaluation },
        { id: 'semantic-label-check', label: 'Semantic', icon: Tags, exists: hasSemanticCheck },
        { id: 'syntax-check', label: 'Syntax', icon: CheckCircle2, exists: hasSyntaxCheck },
        { id: 'custom-rules-check', label: 'Custom Rules', icon: AlertCircle, exists: hasCustomRulesCheck },
        { id: 'duplicate-check', label: 'Duplicates', icon: Layers, exists: hasDuplicateCheck },
        { id: 'complexity-check', label: 'Complexity', icon: GitBranch, exists: hasComplexityCheck },
        { id: 'excluded-issues', label: 'Excluded', icon: EyeOff, exists: hasExcludedIssues },
    ];

    const visibleItems = navItems.filter(item => item.exists);

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <CardTitle className="text-lg">Quick Navigation</CardTitle>
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onExpandAll}
                            className="hover:cursor-pointer"
                        >
                            <Maximize2 className="h-4 w-4 mr-2" />
                            Expand All
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCollapseAll}
                            className="hover:cursor-pointer"
                        >
                            <Minimize2 className="h-4 w-4 mr-2" />
                            Collapse All
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                    {visibleItems.map((item, index) => {
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.id}
                                onClick={() => scrollToSection(item.id)}
                                className="group flex items-center gap-2 px-3 py-2.5 text-sm font-medium rounded-md border border-transparent hover:border-border hover:bg-muted/50 hover:cursor-pointer transition-all"
                            >
                                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-muted text-xs font-semibold text-muted-foreground group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                                    {index + 1}
                                </span>
                                <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                <span className="text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                            </button>
                        );
                    })}
                </div>
            </CardContent>
        </Card>
    );
}

'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ErrorAlert } from '@/components/error-alert';
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    FileText,
    Star,
    AlertCircle,
    GitBranch,
    Loader2,
    Trash2,
    ArrowLeft,
    Layers,
    Eye,
    EyeOff,
    ClipboardCheck,
    ExternalLink,
    ChevronDown,
} from "lucide-react";
import type { EvaluationReport, IssueExclusionListResponse, IssueExclusion } from '@/types/schemas';
import { CheckType } from '@/types/schemas';
import { toast } from "sonner";
import { BPMNVisualizationComponent } from './_components/bpmn-visualisation';
import { PDFDownloadButton } from './_components/pdf-download-button';
import { ReportSkeleton } from './_components/report-skeleton';
import { ReportNavigation } from './_components/report-navigation';
import { ScrollToTop } from './_components/scroll-to-top';
import { ChatTrigger } from '@/components/chat/chat-trigger';
import { formatDateShort } from '@/lib/date';

// Helper to get a human-readable label for check types
function getCheckTypeLabel(checkType: string): string {
    switch (checkType) {
        case CheckType.SYNTAX_CHECK:
            return 'Syntax Check';
        case CheckType.SEMANTIC_LABEL_CHECK:
            return 'Semantic Label Check';
        case CheckType.CUSTOM_RULES_CHECK:
            return 'Custom Rules Check';
        default:
            return checkType;
    }
}

// Helper to get issue summary from snapshot
function getIssueSummary(exclusion: IssueExclusion): string {
    const snapshot = exclusion.issue_snapshot as Record<string, unknown>;

    // Try common fields that might contain the issue description
    if (snapshot.message && typeof snapshot.message === 'string') {
        return snapshot.message;
    }
    if (snapshot.explanation && typeof snapshot.explanation === 'string') {
        return snapshot.explanation;
    }
    if (snapshot.description && typeof snapshot.description === 'string') {
        return snapshot.description;
    }

    // Fallback: stringify the identifier for context
    return `Issue: ${JSON.stringify(exclusion.issue_identifier)}`;
}

// Helper to create a unique key for an issue (must match review page logic)
function createIssueKey(checkType: string, identifier: Record<string, unknown>): string {
    return `${checkType}:${JSON.stringify(identifier)}`;
}

// Helper to extract clean filename from path
function getFileName(filePath: string): string {
    // Extract filename from path like "models/20260118_102826_8da5c744_Hotel.bpmn"
    const fullName = filePath.split('/').pop() || filePath;
    // Remove timestamp and UUID prefix: "20260118_102826_8da5c744_Hotel.bpmn" -> "Hotel.bpmn"
    const match = fullName.match(/^\d{8}_\d{6}_[a-f0-9]{8}_(.+)$/);
    const fileName = match ? match[1] : fullName;
    // Remove .bpmn extension
    return fileName.replace(/\.bpmn$/i, '');
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ResultsPage({ params }: PageProps) {
    const { id: reportId } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();
    const [showBpmnVisualization, setShowBpmnVisualization] = useState(true);
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        description: true,
        evaluation: true,
        semantic: true,
        syntax: true,
        customRules: true,
        duplicate: true,
        complexity: true,
        excluded: true,
    });

    const toggleSection = (section: string) => {
        setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
    };

    const expandAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    };

    const collapseAll = () => {
        setOpenSections(Object.keys(openSections).reduce((acc, key) => ({ ...acc, [key]: false }), {}));
    };

    // Fetch report using TanStack Query
    const {
        data: report,
        isLoading: loading,
        error: queryError,
        refetch,
        isFetching,
    } = useQuery({
        queryKey: ['report', reportId],
        queryFn: async () => {
            const res = await fetch(`/api/reports/${reportId}`);
            if (!res.ok) {
                if (res.status === 404) throw new Error('Report not found');
                throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch report');
            }
            return res.json() as Promise<EvaluationReport>;
        },
        enabled: !!reportId,
        retry: 5,
        retryDelay: (attemptIndex) => Math.min(1000 * Math.pow(2, attemptIndex), 10000),
    });

    // Fetch existing exclusions
    const { data: exclusionsData } = useQuery({
        queryKey: ['report', reportId, 'exclusions'],
        queryFn: async () => {
            const res = await fetch(`/api/reports/${reportId}/exclusions`);
            if (!res.ok) return { items: [], total: 0 }; // If exclusions fail to load, return empty
            return res.json() as Promise<IssueExclusionListResponse>;
        },
        enabled: !!reportId && !!report,
    });

    // Build a set of excluded issue keys for quick lookup
    const excludedIssueKeys = useMemo(() => {
        const keys = new Set<string>();
        if (exclusionsData?.items) {
            for (const exclusion of exclusionsData.items) {
                const key = createIssueKey(exclusion.check_type, exclusion.issue_identifier as Record<string, unknown>);
                keys.add(key);
            }
        }
        return keys;
    }, [exclusionsData]);

    // Create filtered report with excluded issues removed
    const filteredReport = useMemo((): EvaluationReport | undefined => {
        if (!report) return undefined;

        // Deep clone the report to avoid mutating the original
        const filtered = structuredClone(report);

        // Filter syntax check issues - use stable identifiers: rule_name + issue_id
        if (filtered.syntax_check) {
            let newErrorCount = 0;
            let newWarningCount = 0;

            filtered.syntax_check.issues = filtered.syntax_check.issues.map((rule) => {
                const filteredIssues = rule.issues.filter((issue) => {
                    const identifier = { rule_name: rule.rule_name, issue_id: issue.id };
                    const key = createIssueKey(CheckType.SYNTAX_CHECK, identifier);
                    return !excludedIssueKeys.has(key);
                });

                // Count errors and warnings in filtered issues
                for (const issue of filteredIssues) {
                    if (issue.category.toLowerCase() === 'error') {
                        newErrorCount++;
                    } else {
                        newWarningCount++;
                    }
                }

                return { ...rule, issues: filteredIssues };
            }).filter(rule => rule.issues.length > 0);

            filtered.syntax_check.error_count = newErrorCount;
            filtered.syntax_check.warning_count = newWarningCount;
            filtered.syntax_check.is_valid = newErrorCount === 0;
        }

        // Filter semantic label check violations - use stable identifiers: bpmn_element_id + rule_id
        if (filtered.semantic_label_check) {
            filtered.semantic_label_check.violations = filtered.semantic_label_check.violations.filter((violation) => {
                const identifier = { bpmn_element_id: violation.bpmn_element_id, rule_id: violation.rule_id };
                const key = createIssueKey(CheckType.SEMANTIC_LABEL_CHECK, identifier);
                return !excludedIssueKeys.has(key);
            });
        }

        // Filter custom rules check issues - use stable identifiers: check_id + element_id
        if (filtered.custom_rules_check) {
            let totalIssues = 0;
            let checksPassed = 0;
            let checksFailed = 0;

            filtered.custom_rules_check.checks = filtered.custom_rules_check.checks.map((check) => {
                const filteredIssues = check.issues.filter((issue) => {
                    const identifier = { check_id: issue.check_id, element_id: issue.element_id };
                    const key = createIssueKey(CheckType.CUSTOM_RULES_CHECK, identifier);
                    return !excludedIssueKeys.has(key);
                });

                totalIssues += filteredIssues.length;
                const passed = filteredIssues.length === 0;
                if (passed) {
                    checksPassed++;
                } else {
                    checksFailed++;
                }

                return { ...check, issues: filteredIssues, passed };
            });

            filtered.custom_rules_check.total_issues = totalIssues;
            filtered.custom_rules_check.checks_passed = checksPassed;
            filtered.custom_rules_check.checks_failed = checksFailed;
        }

        return filtered;
    }, [report, excludedIssueKeys]);

    const error = queryError ? (queryError as Error).message : null;

    // Delete mutation
    const deleteMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/reports/${reportId}`, { method: 'DELETE' });
            if (!res.ok) {
                const errorData = await res.json().catch(() => ({ error: 'Unknown error' }));
                throw new Error(errorData.error || 'Failed to delete report');
            }
        },
        onMutate: () => {
            toast.loading('Deleting report...', { id: 'delete-report' });
        },
        onSuccess: () => {
            toast.success('Report deleted successfully', { id: 'delete-report' });
            queryClient.invalidateQueries({ queryKey: ['reports'] });
            router.push('/dashboard/reports');
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to delete report', { id: 'delete-report' });
        },
    });

    // Loading state
    if (loading) {
        return <ReportSkeleton />;
    }

    // Error state
    if (error) {
        return (
            <div className="w-full min-h-screen p-6">
                <div className="mb-6">
                    <Link href="/dashboard/reports">
                        <Button variant="outline" className="hover:cursor-pointer">
                            <ArrowLeft className="h-4 w-4" /> Back to Reports
                        </Button>
                    </Link>
                </div>
                <ErrorAlert error={error} onRetry={() => refetch()} isRetrying={isFetching} title="Error Loading Report" />
            </div>
        );
    }

    // Report not found state
    if (!report) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center p-6">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <AlertCircle className="h-6 w-6" />
                            Report Not Found
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <p className="text-muted-foreground mb-4">
                            The requested evaluation report could not be found.
                        </p>
                        <Button onClick={() => router.back()} variant="outline" className="hover:cursor-pointer">
                            Go Back
                        </Button>
                    </CardContent>
                </Card>
            </div>
        );
    }

    // Main report display
    return (
        <div className="w-full min-h-screen p-6 space-y-6">
            {/* Navigation Row */}
            <div className="flex items-center justify-between">
                <Link href="/dashboard/reports">
                    <Button variant="outline" className="hover:cursor-pointer">
                        <ArrowLeft className="h-4 w-4" /> Back to Reports
                    </Button>
                </Link>
                <ChatTrigger />
            </div>

            {/* Header */}
            <div className="space-y-4">
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">{getFileName(report.file_path)}</h1>
                    <p className="text-muted-foreground">
                        BPMN Model Evaluation Report
                    </p>
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3">
                    <Button
                        size="lg"
                        variant="outline"
                        onClick={() => setShowBpmnVisualization(!showBpmnVisualization)}
                        className="w-full sm:w-fit hover:cursor-pointer border-slate-300 hover:bg-slate-100 shadow-none"
                    >
                        {showBpmnVisualization ? (
                            <>
                                <EyeOff className="h-5 w-5 mr-2" />
                                Hide Visualization
                            </>
                        ) : (
                            <>
                                <Eye className="h-5 w-5 mr-2" />
                                Show Visualization
                            </>
                        )}
                    </Button>
                    <PDFDownloadButton
                        report={report}
                        size="lg"
                        variant="secondary"
                    />
                    <Link href={`/dashboard/reports/${reportId}/review`} className="w-full sm:w-fit">
                        <Button
                            size="lg"
                            variant="outline"
                            className="w-full hover:cursor-pointer border-primary text-primary hover:bg-primary/10 shadow-none"
                        >
                            <ClipboardCheck className="h-5 w-5 mr-2" />
                            Review Report
                        </Button>
                    </Link>
                    <Link href={`/dashboard/models/${report.model_id}`} className="w-full sm:w-fit">
                        <Button
                            size="lg"
                            variant="outline"
                            className="w-full hover:cursor-pointer shadow-none"
                        >
                            <ExternalLink className="h-5 w-5 mr-2" />
                            View Source Model
                        </Button>
                    </Link>
                    <AlertDialog>
                        <AlertDialogTrigger asChild>
                            <Button
                                size="lg"
                                variant="destructive"
                                disabled={deleteMutation.isPending}
                                className="w-full sm:w-fit hover:cursor-pointer"
                            >
                                {deleteMutation.isPending ? (
                                    <>
                                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="h-5 w-5 mr-2" />
                                        Delete Report
                                    </>
                                )}
                            </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                            <AlertDialogHeader>
                                <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                                <AlertDialogDescription>
                                    This action cannot be undone. This will permanently delete the
                                    evaluation report for model {report.model_id}.
                                </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                                <AlertDialogCancel disabled={deleteMutation.isPending} className="hover:cursor-pointer">Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                    onClick={() => deleteMutation.mutate()}
                                    disabled={deleteMutation.isPending}
                                    className="bg-red-600 hover:bg-red-700 hover:cursor-pointer"
                                >
                                    Delete
                                </AlertDialogAction>
                            </AlertDialogFooter>
                        </AlertDialogContent>
                    </AlertDialog>
                </div>
            </div>

            {/* Navigation Card */}
            <ReportNavigation
                hasSemanticCheck={!!filteredReport?.semantic_label_check}
                hasSyntaxCheck={!!filteredReport?.syntax_check}
                hasCustomRulesCheck={!!report.custom_rules_check}
                hasDuplicateCheck={!!report.duplicate_check}
                hasComplexityCheck={!!report.complexity_check}
                hasExcludedIssues={!!exclusionsData && exclusionsData.items.length > 0}
                hasEvaluation={!!report.model_evaluation}
                onExpandAll={expandAll}
                onCollapseAll={collapseAll}
            />

            {/* BPMN Model Visualization */}
            {showBpmnVisualization && filteredReport && <BPMNVisualizationComponent report={filteredReport} />}

            {/* Model Description */}
            <Collapsible
                open={openSections.description}
                onOpenChange={() => toggleSection('description')}
                className="rounded-lg border bg-card text-card-foreground shadow-sm"
                id="model-description"
            >
                <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                    <div className="flex items-center gap-2 font-semibold leading-none tracking-tight">
                        <FileText className="h-5 w-5" />
                        Model Description
                    </div>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.description ? 'rotate-180' : ''}`} />
                </CollapsibleTrigger>
                <CollapsibleContent>
                    <div className="px-6 pt-2 pb-6">
                        <p className="text-sm leading-relaxed">
                            {report.model_description.description}
                        </p>
                    </div>
                </CollapsibleContent>
            </Collapsible>

            {/* Overall Evaluation */}
            {report.model_evaluation && (
                <Collapsible
                    open={openSections.evaluation}
                    onOpenChange={() => toggleSection('evaluation')}
                    className="rounded-lg border bg-card text-card-foreground shadow-sm"
                    id="overall-evaluation"
                >
                    <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                        <div className="flex items-center gap-2 font-semibold leading-none tracking-tight">
                            <Star className="h-5 w-5" />
                            Overall Evaluation
                        </div>
                        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.evaluation ? 'rotate-180' : ''}`} />
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                        <div className="px-6 pt-2 pb-6 space-y-4">
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm font-medium">Quality Rating</span>
                                        <span className="text-2xl font-bold">
                                            {report.model_evaluation.evaluation_rating}/10
                                        </span>
                                    </div>
                                    <Progress
                                        value={report.model_evaluation.evaluation_rating * 10}
                                        className={`h-2 bg-gray-200 ${report.model_evaluation.evaluation_rating >= 8
                                            ? '[&>div]:bg-green-600'
                                            : report.model_evaluation.evaluation_rating >= 6
                                                ? '[&>div]:bg-yellow-600'
                                                : '[&>div]:bg-red-600'
                                            }`}
                                    />
                                </div>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {report.model_evaluation.evaluation_summary}
                            </p>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}

            {/* Detailed Checks */}
            <div className="space-y-6 pb-12">
                {/* Semantic Label Check */}
                {filteredReport?.semantic_label_check && (
                    <Collapsible
                        open={openSections.semantic}
                        onOpenChange={() => toggleSection('semantic')}
                        className="rounded-lg border bg-card text-card-foreground shadow-sm"
                        id="semantic-label-check"
                    >
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                            <div className="space-y-1.5 text-left">
                                <div className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
                                    <FileText className="h-6 w-6" />
                                    Semantic Label Analysis
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Evaluation of naming conventions and label quality
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.semantic ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-6 pt-2 pb-6 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium">Semantic Quality Score</span>
                                        <span className="text-2xl font-bold">
                                            {filteredReport.semantic_label_check.rating}%
                                        </span>
                                    </div>
                                    <Progress
                                        value={filteredReport.semantic_label_check.rating}
                                        className={`h-2 bg-gray-200 ${filteredReport.semantic_label_check.rating >= 80
                                            ? '[&>div]:bg-green-600'
                                            : filteredReport.semantic_label_check.rating >= 60
                                                ? '[&>div]:bg-yellow-600'
                                                : '[&>div]:bg-red-600'
                                            }`}
                                    />

                                    <Alert>
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>Evaluation Summary</AlertTitle>
                                        <AlertDescription>
                                            {filteredReport.semantic_label_check.evaluation}
                                        </AlertDescription>
                                    </Alert>

                                    {filteredReport.semantic_label_check.violations.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-semibold">Violations Found</h4>
                                            {filteredReport.semantic_label_check.violations.map((violation) => {
                                                return (
                                                    <div key={`${violation.bpmn_element_id}-${violation.rule_id}`} className="border rounded-lg p-4 bg-white">
                                                        <div className="flex items-start gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                                                                        WARNING
                                                                    </Badge>
                                                                    <span className="text-xs text-muted-foreground">{violation.rule_id}</span>
                                                                    <Badge variant="outline" className="hidden sm:inline-flex break-all">{violation.bpmn_element_id}</Badge>
                                                                </div>
                                                                <Badge variant="outline" className="sm:hidden mb-2 break-all">{violation.bpmn_element_id}</Badge>
                                                                <div className="text-sm text-gray-700">
                                                                    {violation.explanation}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
                {/* Syntax Check */}
                {filteredReport?.syntax_check && (
                    <Collapsible
                        open={openSections.syntax}
                        onOpenChange={() => toggleSection('syntax')}
                        className="rounded-lg border bg-card text-card-foreground shadow-sm"
                        id="syntax-check"
                    >
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                            <div className="space-y-1.5 text-left">
                                <div className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
                                    <CheckCircle2 className="h-6 w-6" />
                                    Syntax Validation
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    BPMN syntax and structural validation results
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.syntax ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-6 pt-2 pb-6 space-y-4">
                                    <div className="grid grid-cols-3 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Status</p>
                                            <div className="flex items-center gap-2">
                                                {filteredReport.syntax_check.is_valid ? (
                                                    <>
                                                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                                                        <span className="font-medium text-green-600">Valid</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <XCircle className="h-4 w-4 text-red-600" />
                                                        <span className="font-medium text-red-600">Invalid</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Errors</p>
                                            <p className="text-2xl font-bold text-red-600">
                                                {filteredReport.syntax_check.error_count}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Warnings</p>
                                            <p className="text-2xl font-bold text-yellow-600">
                                                {filteredReport.syntax_check.warning_count}
                                            </p>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        {filteredReport.syntax_check.issues.map((rule, ruleIdx) => (
                                            <div key={ruleIdx} className="space-y-2">
                                                <h4 className="font-semibold text-sm">{rule.rule_name}</h4>
                                                <div className="space-y-2">
                                                    {rule.issues.map((issue, issueIdx) => {
                                                        const isError = issue.category.toLowerCase() === "error";

                                                        return (
                                                            <div key={issueIdx} className="border rounded-lg p-4 bg-white">
                                                                <div className="flex items-start gap-4">
                                                                    <div className="flex-1">
                                                                        <div className="flex items-center gap-2 mb-2">
                                                                            {isError ? (
                                                                                <>
                                                                                    <XCircle className="h-4 w-4 text-red-500" />
                                                                                    <Badge variant="destructive">ERROR</Badge>
                                                                                </>
                                                                            ) : (
                                                                                <>
                                                                                    <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                                                    <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                                                                                        WARNING
                                                                                    </Badge>
                                                                                </>
                                                                            )}
                                                                            <Badge variant="outline" className="hidden sm:inline-flex break-all">{issue.id}</Badge>
                                                                        </div>
                                                                        <Badge variant="outline" className="sm:hidden mb-2 break-all">{issue.id}</Badge>
                                                                        <div className="text-sm text-gray-700">
                                                                            {issue.message}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
                {/* Custom Rules Check */}
                {report.custom_rules_check && (
                    <Collapsible
                        open={openSections.customRules}
                        onOpenChange={() => toggleSection('customRules')}
                        className="rounded-lg border bg-card text-card-foreground shadow-sm"
                        id="custom-rules-check"
                    >
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                            <div className="space-y-1.5 text-left">
                                <div className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
                                    <AlertCircle className="h-6 w-6" />
                                    Custom Business Rules
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Project-specific validation rules and checks
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.customRules ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-6 pt-2 pb-6 space-y-4">
                                    <div className="grid grid-cols-4 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Passed</p>
                                            <p className="text-2xl font-bold text-green-600">
                                                {report.custom_rules_check.checks_passed}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Failed</p>
                                            <p className="text-2xl font-bold text-red-600">
                                                {report.custom_rules_check.checks_failed}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Total Checks</p>
                                            <p className="text-2xl font-bold">
                                                {report.custom_rules_check.total_checks}
                                            </p>
                                        </div>
                                        <div className="space-y-1">
                                            <p className="text-sm text-muted-foreground">Total Issues</p>
                                            <p className="text-2xl font-bold">
                                                {report.custom_rules_check.total_issues}
                                            </p>
                                        </div>
                                    </div>

                                    <Separator />

                                    <div className="space-y-4">
                                        {report.custom_rules_check.checks.map((check, checkIdx) => (
                                            <Card key={checkIdx}>
                                                <CardHeader>
                                                    <CardTitle className="flex items-center justify-between text-base">
                                                        <span>{check.check_name}</span>
                                                        {check.passed ? (
                                                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                                                Passed
                                                            </Badge>
                                                        ) : (
                                                            <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                                <XCircle className="h-3 w-3 mr-1" />
                                                                Failed
                                                            </Badge>
                                                        )}
                                                    </CardTitle>
                                                    <CardDescription>{check.description}</CardDescription>
                                                </CardHeader>
                                                {check.issues.length > 0 && (
                                                    <CardContent className="space-y-2">
                                                        {check.issues.map((issue, issueIdx) => {
                                                            const isError = issue.category.toLowerCase() === "error";
                                                            const isWarning = issue.category.toLowerCase() === "warning";

                                                            return (
                                                                <div key={issueIdx} className="border rounded-lg p-4 bg-white">
                                                                    <div className="flex items-start gap-4">
                                                                        <div className="flex-1">
                                                                            <div className="flex items-center gap-2 mb-2">
                                                                                {isError ? (
                                                                                    <>
                                                                                        <XCircle className="h-4 w-4 text-red-500" />
                                                                                        <Badge variant="destructive">ERROR</Badge>
                                                                                    </>
                                                                                ) : isWarning ? (
                                                                                    <>
                                                                                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                                                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                                                                                            WARNING
                                                                                        </Badge>
                                                                                    </>
                                                                                ) : (
                                                                                    <>
                                                                                        <Info className="h-4 w-4 text-blue-500" />
                                                                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 border-blue-200">
                                                                                            INFO
                                                                                        </Badge>
                                                                                    </>
                                                                                )}
                                                                                {issue.element_id && (
                                                                                    <Badge variant="outline" className="hidden sm:inline-flex break-all">
                                                                                        {issue.element_id}
                                                                                    </Badge>
                                                                                )}
                                                                            </div>
                                                                            {issue.element_id && (
                                                                                <Badge variant="outline" className="sm:hidden mb-2 max-w-full break-all">
                                                                                    {issue.element_id}
                                                                                </Badge>
                                                                            )}
                                                                            <div className="text-sm text-gray-700 wrap-break-words">
                                                                                {issue.message}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </CardContent>
                                                )}
                                            </Card>
                                        ))}
                                    </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Duplicate Check */}
                {report.duplicate_check && (
                    <Collapsible
                        open={openSections.duplicate}
                        onOpenChange={() => toggleSection('duplicate')}
                        className="rounded-lg border bg-card text-card-foreground shadow-sm"
                        id="duplicate-check"
                    >
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                            <div className="space-y-1.5 text-left">
                                <div className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
                                    <Layers className="h-6 w-6" />
                                    Duplicate Detection
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Similar models in the knowledge base
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.duplicate ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-6 pt-2 pb-6 space-y-4">
                                    <Alert>
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>Analysis Result</AlertTitle>
                                        <AlertDescription>
                                            {report.duplicate_check.response_answer}
                                        </AlertDescription>
                                    </Alert>

                                    {report.duplicate_check.similar_models.length > 0 && (
                                        <div className="space-y-3">
                                            <h4 className="text-sm font-semibold">Similar Models</h4>
                                            {report.duplicate_check.similar_models.map((model) => {
                                                return (
                                                    <div key={model.model_id} className="border rounded-lg p-4 bg-white">
                                                        <div className="flex items-start gap-4">
                                                            <div className="flex-1">
                                                                <div className="flex items-center gap-2 mb-2">
                                                                    <Link href={`/dashboard/models/${model.model_id}`} className="inline-flex items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline">
                                                                        {model.model_name || model.model_id}
                                                                        <ExternalLink className="h-3 w-3" />
                                                                    </Link>
                                                                    <Badge variant="outline">
                                                                        Similarity: {model.rating}/10
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-sm text-gray-700">{model.reasoning}</p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Complexity Check */}
                {report.complexity_check && (
                    <Collapsible
                        open={openSections.complexity}
                        onOpenChange={() => toggleSection('complexity')}
                        className="rounded-lg border bg-card text-card-foreground shadow-sm"
                        id="complexity-check"
                    >
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                            <div className="space-y-1.5 text-left">
                                <div className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight">
                                    <GitBranch className="h-6 w-6" />
                                    Complexity Analysis
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    Control flow and cognitive weight metrics
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.complexity ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-6 pt-2 pb-6 space-y-6">
                                <div className="grid grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">Control Flow Complexity (CFC)</h4>
                                        <p className="text-3xl font-bold">{report.complexity_check.cfc_score}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Measures the number of decision points in the process
                                        </p>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="text-sm font-semibold">Cognitive Weight (CW)</h4>
                                        <p className="text-3xl font-bold">{report.complexity_check.cw_score}</p>
                                        <p className="text-xs text-muted-foreground">
                                            Estimates mental effort required to understand the model
                                        </p>
                                    </div>
                                </div>

                                <Separator />

                                <div className="space-y-4">
                                    <h4 className="text-sm font-semibold">Cognitive Weight Breakdown</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {Object.entries(report.complexity_check.cw_breakdown).map(([key, value]) => (
                                            <div key={key} className="flex items-center justify-between p-3 border rounded-lg">
                                                <span className="text-sm capitalize">{key.replace(/_/g, ' ')}</span>
                                                <Badge variant="secondary">{value}</Badge>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}

                {/* Excluded Issues - Transparency Section */}
                {exclusionsData && exclusionsData.items.length > 0 && (
                    <Collapsible
                        open={openSections.excluded}
                        onOpenChange={() => toggleSection('excluded')}
                        className="rounded-lg border border-dashed border-muted-foreground/50 bg-card text-card-foreground shadow-sm"
                        id="excluded-issues"
                    >
                        <CollapsibleTrigger className="flex w-full items-center justify-between p-6 hover:bg-muted/50 hover:cursor-pointer transition-colors">
                            <div className="space-y-1.5 text-left">
                                <div className="flex items-center gap-2 text-2xl font-semibold leading-none tracking-tight text-muted-foreground">
                                    <EyeOff className="h-6 w-6" />
                                    Excluded Issues
                                </div>
                                <p className="text-sm text-muted-foreground">
                                    {exclusionsData.items.length} issue{exclusionsData.items.length !== 1 ? 's' : ''} excluded from this report during review
                                </p>
                            </div>
                            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${openSections.excluded ? 'rotate-180' : ''}`} />
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                            <div className="px-6 pt-2 pb-6 space-y-4">
                                    <Alert>
                                        <Info className="h-4 w-4" />
                                        <AlertTitle>Transparency Notice</AlertTitle>
                                        <AlertDescription>
                                            The following issues were excluded during the review process. They are shown here for transparency and audit purposes.
                                        </AlertDescription>
                                    </Alert>

                                    <div className="space-y-3">
                                        {exclusionsData.items.map((exclusion) => (
                                            <div
                                                key={exclusion.id}
                                                className="border border-dashed rounded-lg p-4 bg-muted/30"
                                            >
                                                <div className="flex items-start gap-4">
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2 mb-2">
                                                            <EyeOff className="h-4 w-4 text-muted-foreground" />
                                                            <Badge variant="outline" className="text-muted-foreground">
                                                                {getCheckTypeLabel(exclusion.check_type)}
                                                            </Badge>
                                                            <span className="text-xs text-muted-foreground">
                                                                Excluded on {formatDateShort(exclusion.created_at)}
                                                            </span>
                                                        </div>
                                                        <div className="text-sm text-muted-foreground line-through">
                                                            {getIssueSummary(exclusion)}
                                                        </div>
                                                        {exclusion.reason && (
                                                            <div className="mt-2 text-xs text-muted-foreground italic">
                                                                Reason: {exclusion.reason}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                            </div>
                        </CollapsibleContent>
                    </Collapsible>
                )}
            </div>
            <ScrollToTop />
        </div>
    );
}

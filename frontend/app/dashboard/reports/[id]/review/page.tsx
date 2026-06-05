'use client';

import { use, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Input } from "@/components/ui/input";
import {
    CheckCircle2,
    XCircle,
    AlertTriangle,
    Info,
    Loader2,
    ArrowLeft,
    Undo2,
    Ban,
    Save,
    Check,
    X,
} from "lucide-react";
import type { EvaluationReport, IssueExclusion, IssueExclusionListResponse, BulkExclusionResponse } from '@/types/schemas';
import { CheckType } from '@/types/schemas';
import { toast } from "sonner";
import { ErrorAlert } from '@/components/error-alert';

// Types for tracking local exclusion state
interface PendingExclusion {
    check_type: CheckType;
    issue_identifier: Record<string, unknown>;
    issue_snapshot: Record<string, unknown>;
    reason?: string | null;
}

interface LocalExclusionState {
    // Existing exclusions to delete (restore issues)
    toDelete: Set<string>;
    // New exclusions to create
    toCreate: Map<string, PendingExclusion>;
}

// Helper to create a unique key for an issue
function createIssueKey(checkType: string, identifier: Record<string, unknown>): string {
    return `${checkType}:${JSON.stringify(identifier)}`;
}

interface PageProps {
    params: Promise<{ id: string }>;
}

export default function ReviewReportPage({ params }: PageProps) {
    const { id: reportId } = use(params);
    const router = useRouter();
    const queryClient = useQueryClient();

    // Local state for tracking pending changes
    const [localState, setLocalState] = useState<LocalExclusionState>({
        toDelete: new Set(),
        toCreate: new Map(),
    });

    // State for inline exclusion form (which issue is being excluded, and the reason)
    const [excludingIssue, setExcludingIssue] = useState<string | null>(null);
    const [exclusionReason, setExclusionReason] = useState('');

    // Fetch report data
    const {
        data: report,
        isLoading: reportLoading,
        error: reportError,
        refetch,
        isFetching,
    } = useQuery({
        queryKey: ['report', reportId],
        queryFn: async () => {
            const res = await fetch(`/api/reports/${reportId}`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch report');
            return res.json() as Promise<EvaluationReport>;
        },
        enabled: !!reportId,
    });

    // Fetch existing exclusions
    const {
        data: exclusionsData,
        isLoading: exclusionsLoading,
    } = useQuery({
        queryKey: ['report', reportId, 'exclusions'],
        queryFn: async () => {
            const res = await fetch(`/api/reports/${reportId}/exclusions`);
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to fetch exclusions');
            return res.json() as Promise<IssueExclusionListResponse>;
        },
        enabled: !!reportId,
    });

    // Build a map of existing exclusions for quick lookup
    const existingExclusionsMap = useMemo(() => {
        const map = new Map<string, IssueExclusion>();
        if (exclusionsData?.items) {
            for (const exclusion of exclusionsData.items) {
                const key = createIssueKey(exclusion.check_type, exclusion.issue_identifier as Record<string, unknown>);
                map.set(key, exclusion);
            }
        }
        return map;
    }, [exclusionsData]);

    // Check if an issue is currently excluded (considering local state)
    const isIssueExcluded = (checkType: string, identifier: Record<string, unknown>): boolean => {
        const key = createIssueKey(checkType, identifier);
        const existingExclusion = existingExclusionsMap.get(key);

        if (existingExclusion) {
            // It's in DB - excluded unless marked for deletion
            return !localState.toDelete.has(existingExclusion.id);
        } else {
            // Not in DB - excluded only if marked for creation
            return localState.toCreate.has(key);
        }
    };

    // Get the exclusion reason for an issue (from DB or pending state)
    const getExclusionReason = (checkType: string, identifier: Record<string, unknown>): string | null => {
        const key = createIssueKey(checkType, identifier);

        // Check pending exclusions first (local state takes precedence)
        const pendingExclusion = localState.toCreate.get(key);
        if (pendingExclusion) {
            return pendingExclusion.reason || null;
        }

        // Check existing exclusions from DB
        const existingExclusion = existingExclusionsMap.get(key);
        if (existingExclusion && !localState.toDelete.has(existingExclusion.id)) {
            return existingExclusion.reason || null;
        }

        return null;
    };

    // Start the exclusion process (show inline form)
    const startExclusion = (key: string) => {
        setExcludingIssue(key);
        setExclusionReason('');
    };

    // Cancel the exclusion process
    const cancelExclusion = () => {
        setExcludingIssue(null);
        setExclusionReason('');
    };

    // Confirm the exclusion with optional reason
    const confirmExclusion = (
        checkType: CheckType,
        identifier: Record<string, unknown>,
        snapshot: Record<string, unknown>
    ) => {
        const key = createIssueKey(checkType, identifier);

        setLocalState(prev => {
            const newToCreate = new Map(prev.toCreate);
            newToCreate.set(key, {
                check_type: checkType,
                issue_identifier: identifier,
                issue_snapshot: snapshot,
                reason: exclusionReason.trim() || null,
            });
            return { ...prev, toCreate: newToCreate };
        });

        setExcludingIssue(null);
        setExclusionReason('');
    };

    // Restore an excluded issue or re-exclude a restored DB issue
    const restoreIssue = (checkType: CheckType, identifier: Record<string, unknown>) => {
        const key = createIssueKey(checkType, identifier);
        const existingExclusion = existingExclusionsMap.get(key);

        setLocalState(prev => {
            const newToDelete = new Set(prev.toDelete);
            const newToCreate = new Map(prev.toCreate);

            if (existingExclusion) {
                // Issue exists in DB - toggle deletion mark
                if (newToDelete.has(existingExclusion.id)) {
                    // Currently marked for restore -> re-exclude (remove from delete list)
                    newToDelete.delete(existingExclusion.id);
                } else {
                    // Currently excluded -> mark for restore
                    newToDelete.add(existingExclusion.id);
                }
            } else {
                // Issue is pending creation - remove from create list
                newToCreate.delete(key);
            }

            return { toDelete: newToDelete, toCreate: newToCreate };
        });
    };

    // Check if there are unsaved changes
    const hasChanges = localState.toDelete.size > 0 || localState.toCreate.size > 0;

    // Save mutation
    const saveMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/reports/${reportId}/exclusions`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to_create: Array.from(localState.toCreate.values()),
                    to_delete: Array.from(localState.toDelete),
                }),
            });
            if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to save changes');
            return res.json() as Promise<BulkExclusionResponse>;
        },
        onMutate: () => {
            toast.loading('Saving changes...', { id: 'save-exclusions' });
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['report', reportId] });
            queryClient.invalidateQueries({ queryKey: ['report', reportId, 'exclusions'] });
            toast.success(`Saved: ${data.created_count} excluded, ${data.deleted_count} restored`, { id: 'save-exclusions' });
            router.push(`/dashboard/reports/${reportId}`);
        },
        onError: (error: Error) => {
            toast.error(error.message || 'Failed to save changes', { id: 'save-exclusions' });
        },
    });

    // Loading state
    if (reportLoading || exclusionsLoading) {
        return (
            <div className="w-full min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
                    <div>
                        <h2 className="text-2xl font-semibold">Loading Review...</h2>
                        <p className="text-muted-foreground mt-2">
                            Please wait while we load the report data
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (reportError || !report) {
        return (
            <div className="w-full min-h-screen p-6">
                <div className="mb-6">
                    <Link href={`/dashboard/reports/${reportId}`}>
                        <Button variant="outline" className="hover:cursor-pointer">
                            <ArrowLeft className="h-4 w-4" /> Back to Report
                        </Button>
                    </Link>
                </div>
                <ErrorAlert
                    error={reportError instanceof Error ? reportError.message : 'Failed to load report'}
                    onRetry={() => refetch()}
                    isRetrying={isFetching}
                    title="Error Loading Report"
                />
            </div>
        );
    }

    // Count issues by type
    const syntaxIssueCount = report.syntax_check?.issues.reduce((acc, rule) => acc + rule.issues.length, 0) || 0;
    const semanticIssueCount = report.semantic_label_check?.violations.length || 0;
    const customIssueCount = report.custom_rules_check?.checks.reduce((acc, check) => acc + check.issues.length, 0) || 0;
    const totalIssues = syntaxIssueCount + semanticIssueCount + customIssueCount;

    // Count excluded issues
    const countExcluded = () => {
        let count = 0;

        // Syntax check issues - use stable identifiers: rule_name + issue_id
        if (report.syntax_check) {
            report.syntax_check.issues.forEach((rule) => {
                rule.issues.forEach((issue) => {
                    const identifier = { rule_name: rule.rule_name, issue_id: issue.id };
                    if (isIssueExcluded(CheckType.SYNTAX_CHECK, identifier)) count++;
                });
            });
        }

        // Semantic label violations - use stable identifiers: bpmn_element_id + rule_id
        if (report.semantic_label_check) {
            report.semantic_label_check.violations.forEach((violation) => {
                const identifier = { bpmn_element_id: violation.bpmn_element_id, rule_id: violation.rule_id };
                if (isIssueExcluded(CheckType.SEMANTIC_LABEL_CHECK, identifier)) count++;
            });
        }

        // Custom rules issues - use stable identifiers: check_id + element_id
        if (report.custom_rules_check) {
            report.custom_rules_check.checks.forEach((check) => {
                check.issues.forEach((issue) => {
                    const identifier = { check_id: issue.check_id, element_id: issue.element_id };
                    if (isIssueExcluded(CheckType.CUSTOM_RULES_CHECK, identifier)) count++;
                });
            });
        }

        return count;
    };

    const excludedCount = countExcluded();

    return (
        <div className="w-full min-h-screen p-6">
            <div className="max-w-[1200px] mx-auto space-y-6">
                {/* Back Button */}
                <div>
                    <Link href={`/dashboard/reports/${reportId}`}>
                        <Button variant="outline">
                            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Report
                        </Button>
                    </Link>
                </div>

                {/* Header */}
                <div className="space-y-4">
                    <div className="space-y-2">
                        <h1 className="text-3xl font-bold tracking-tight">Review Report</h1>
                        <p className="text-muted-foreground">
                            Review and exclude irrelevant issues for model: {report.model_id}
                        </p>
                    </div>

                    {/* Stats bar */}
                    <div className="flex items-center gap-4 text-sm">
                        <Badge variant="outline" className="text-base px-3 py-1">
                            {excludedCount} of {totalIssues} issues excluded
                        </Badge>
                        {hasChanges && (
                            <Badge variant="secondary" className="text-base px-3 py-1 bg-yellow-100 text-yellow-800">
                                Unsaved changes
                            </Badge>
                        )}
                    </div>
                </div>

                {/* Issue Sections */}
                <div className="space-y-6">
                    {/* Syntax Check Issues */}
                    {report.syntax_check && report.syntax_check.issues.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CheckCircle2 className="h-5 w-5" />
                                    Syntax Check Issues
                                </CardTitle>
                                <CardDescription>
                                    {syntaxIssueCount} issues found
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {report.syntax_check.issues.map((rule, ruleIdx) => (
                                    <div key={ruleIdx} className="space-y-2">
                                        <h4 className="font-semibold text-sm">{rule.rule_name}</h4>
                                        <div className="space-y-2">
                                            {rule.issues.map((issue, issueIdx) => {
                                                // Use stable identifiers: rule_name + issue_id
                                                const identifier = { rule_name: rule.rule_name, issue_id: issue.id };
                                                const issueKey = createIssueKey(CheckType.SYNTAX_CHECK, identifier);
                                                const excluded = isIssueExcluded(CheckType.SYNTAX_CHECK, identifier);
                                                const savedReason = excluded ? getExclusionReason(CheckType.SYNTAX_CHECK, identifier) : null;
                                                const isExcluding = excludingIssue === issueKey;
                                                const isError = issue.category.toLowerCase() === "error";

                                                return (
                                                    <div
                                                        key={issueIdx}
                                                        className={`border rounded-lg p-4 transition-opacity ${excluded ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                                                    >
                                                        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                                                                    {excluded && <Badge variant="outline">Excluded</Badge>}
                                                                </div>
                                                                <Badge variant="outline" className="sm:hidden mb-2 break-all">{issue.id}</Badge>
                                                                <div className={`text-sm ${excluded ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                                                                    {issue.message}
                                                                </div>
                                                                {excluded && savedReason && (
                                                                    <div className="mt-2 text-xs text-muted-foreground italic">
                                                                        Reason: {savedReason}
                                                                    </div>
                                                                )}
                                                            </div>
                                                            {!isExcluding && (
                                                                <Button
                                                                    variant={excluded ? "outline" : "secondary"}
                                                                    size="sm"
                                                                    className="w-full sm:w-auto"
                                                                    onClick={() => excluded
                                                                        ? restoreIssue(CheckType.SYNTAX_CHECK, identifier)
                                                                        : startExclusion(issueKey)
                                                                    }
                                                                >
                                                                    {excluded ? (
                                                                        <>
                                                                            <Undo2 className="h-4 w-4 mr-1" />
                                                                            Restore
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <Ban className="h-4 w-4 mr-1" />
                                                                            Exclude
                                                                        </>
                                                                    )}
                                                                </Button>
                                                            )}
                                                        </div>
                                                        {isExcluding && (
                                                            <div className="mt-3 flex items-center gap-2">
                                                                <Input
                                                                    placeholder="Reason for exclusion (optional)"
                                                                    value={exclusionReason}
                                                                    onChange={(e) => setExclusionReason(e.target.value)}
                                                                    className="flex-1"
                                                                    autoFocus
                                                                    maxLength={500}
                                                                    onKeyDown={(e) => {
                                                                        if (e.key === 'Enter') {
                                                                            confirmExclusion(
                                                                                CheckType.SYNTAX_CHECK,
                                                                                identifier,
                                                                                { ...issue, rule_name: rule.rule_name } as Record<string, unknown>
                                                                            );
                                                                        } else if (e.key === 'Escape') {
                                                                            cancelExclusion();
                                                                        }
                                                                    }}
                                                                />
                                                                <Button
                                                                    size="sm"
                                                                    onClick={() => confirmExclusion(
                                                                        CheckType.SYNTAX_CHECK,
                                                                        identifier,
                                                                        { ...issue, rule_name: rule.rule_name } as Record<string, unknown>
                                                                    )}
                                                                >
                                                                    <Check className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={cancelExclusion}
                                                                >
                                                                    <X className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                    )}

                    {/* Semantic Label Violations */}
                    {report.semantic_label_check && report.semantic_label_check.violations.length > 0 && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <AlertTriangle className="h-5 w-5" />
                                    Semantic Label Violations
                                </CardTitle>
                                <CardDescription>
                                    {semanticIssueCount} violations found
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-2">
                                {report.semantic_label_check.violations.map((violation) => {
                                    // Use stable identifiers: bpmn_element_id + rule_id
                                    const identifier = { bpmn_element_id: violation.bpmn_element_id, rule_id: violation.rule_id };
                                    const issueKey = createIssueKey(CheckType.SEMANTIC_LABEL_CHECK, identifier);
                                    const excluded = isIssueExcluded(CheckType.SEMANTIC_LABEL_CHECK, identifier);
                                    const savedReason = excluded ? getExclusionReason(CheckType.SEMANTIC_LABEL_CHECK, identifier) : null;
                                    const isExcluding = excludingIssue === issueKey;

                                    return (
                                        <div
                                            key={issueKey}
                                            className={`border rounded-lg p-4 transition-opacity ${excluded ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                                        >
                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-2">
                                                        <AlertTriangle className="h-4 w-4 text-orange-500" />
                                                        <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200">
                                                            WARNING
                                                        </Badge>
                                                        <span className="text-xs text-muted-foreground">{violation.rule_id}</span>
                                                        <Badge variant="outline" className="hidden sm:inline-flex break-all">{violation.bpmn_element_id}</Badge>
                                                        {excluded && <Badge variant="outline">Excluded</Badge>}
                                                    </div>
                                                    <Badge variant="outline" className="sm:hidden mb-2 break-all">{violation.bpmn_element_id}</Badge>
                                                    <div className={`text-sm ${excluded ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                                                        {violation.explanation}
                                                    </div>
                                                    {excluded && savedReason && (
                                                        <div className="mt-2 text-xs text-muted-foreground italic">
                                                            Reason: {savedReason}
                                                        </div>
                                                    )}
                                                </div>
                                                {!isExcluding && (
                                                    <Button
                                                        variant={excluded ? "outline" : "secondary"}
                                                        size="sm"
                                                        className="w-full sm:w-auto"
                                                        onClick={() => excluded
                                                            ? restoreIssue(CheckType.SEMANTIC_LABEL_CHECK, identifier)
                                                            : startExclusion(issueKey)
                                                        }
                                                    >
                                                        {excluded ? (
                                                            <>
                                                                <Undo2 className="h-4 w-4 mr-1" />
                                                                Restore
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Ban className="h-4 w-4 mr-1" />
                                                                Exclude
                                                            </>
                                                        )}
                                                    </Button>
                                                )}
                                            </div>
                                            {isExcluding && (
                                                <div className="mt-3 flex items-center gap-2">
                                                    <Input
                                                        placeholder="Reason for exclusion (optional)"
                                                        value={exclusionReason}
                                                        onChange={(e) => setExclusionReason(e.target.value)}
                                                        className="flex-1"
                                                        autoFocus
                                                        maxLength={500}
                                                        onKeyDown={(e) => {
                                                            if (e.key === 'Enter') {
                                                                confirmExclusion(
                                                                    CheckType.SEMANTIC_LABEL_CHECK,
                                                                    identifier,
                                                                    violation as unknown as Record<string, unknown>
                                                                );
                                                            } else if (e.key === 'Escape') {
                                                                cancelExclusion();
                                                            }
                                                        }}
                                                    />
                                                    <Button
                                                        size="sm"
                                                        onClick={() => confirmExclusion(
                                                            CheckType.SEMANTIC_LABEL_CHECK,
                                                            identifier,
                                                            violation as unknown as Record<string, unknown>
                                                        )}
                                                    >
                                                        <Check className="h-4 w-4" />
                                                    </Button>
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={cancelExclusion}
                                                    >
                                                        <X className="h-4 w-4" />
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {/* Custom Rules Issues */}
                    {report.custom_rules_check && report.custom_rules_check.checks.some(c => c.issues.length > 0) && (
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Info className="h-5 w-5" />
                                    Custom Rules Issues
                                </CardTitle>
                                <CardDescription>
                                    {customIssueCount} issues found
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {report.custom_rules_check.checks.map((check, checkIdx) => {
                                    if (check.issues.length === 0) return null;

                                    return (
                                        <div key={checkIdx} className="space-y-2">
                                            <div className="flex items-center gap-2">
                                                <h4 className="font-semibold text-sm">{check.check_name}</h4>
                                                {check.passed ? (
                                                    <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                                                        Passed
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                                                        Failed
                                                    </Badge>
                                                )}
                                            </div>
                                            <p className="text-xs text-muted-foreground">{check.description}</p>
                                            <div className="space-y-2">
                                                {check.issues.map((issue, issueIdx) => {
                                                    // Use stable identifiers: check_id + element_id
                                                    const identifier = { check_id: issue.check_id, element_id: issue.element_id };
                                                    const issueKey = createIssueKey(CheckType.CUSTOM_RULES_CHECK, identifier);
                                                    const excluded = isIssueExcluded(CheckType.CUSTOM_RULES_CHECK, identifier);
                                                    const savedReason = excluded ? getExclusionReason(CheckType.CUSTOM_RULES_CHECK, identifier) : null;
                                                    const isExcluding = excludingIssue === issueKey;
                                                    const isError = issue.category.toLowerCase() === "error";
                                                    const isWarning = issue.category.toLowerCase() === "warning";

                                                    return (
                                                        <div
                                                            key={issueIdx}
                                                            className={`border rounded-lg p-4 transition-opacity ${excluded ? 'opacity-50 bg-gray-50' : 'bg-white'}`}
                                                        >
                                                            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
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
                                                                        {excluded && <Badge variant="outline">Excluded</Badge>}
                                                                    </div>
                                                                    {issue.element_id && (
                                                                        <Badge variant="outline" className="sm:hidden mb-2 max-w-full break-all">
                                                                            {issue.element_id}
                                                                        </Badge>
                                                                    )}
                                                                    <div className={`text-sm wrap-break-words ${excluded ? 'line-through text-gray-500' : 'text-gray-700'}`}>
                                                                        {issue.message}
                                                                    </div>
                                                                    {excluded && savedReason && (
                                                                        <div className="mt-2 text-xs text-muted-foreground italic">
                                                                            Reason: {savedReason}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                                {!isExcluding && (
                                                                    <Button
                                                                        variant={excluded ? "outline" : "secondary"}
                                                                        size="sm"
                                                                        className="w-full sm:w-auto"
                                                                        onClick={() => excluded
                                                                            ? restoreIssue(CheckType.CUSTOM_RULES_CHECK, identifier)
                                                                            : startExclusion(issueKey)
                                                                        }
                                                                    >
                                                                        {excluded ? (
                                                                            <>
                                                                                <Undo2 className="h-4 w-4 mr-1" />
                                                                                Restore
                                                                            </>
                                                                        ) : (
                                                                            <>
                                                                                <Ban className="h-4 w-4 mr-1" />
                                                                                Exclude
                                                                            </>
                                                                        )}
                                                                    </Button>
                                                                )}
                                                            </div>
                                                            {isExcluding && (
                                                                <div className="mt-3 flex items-center gap-2">
                                                                    <Input
                                                                        placeholder="Reason for exclusion (optional)"
                                                                        value={exclusionReason}
                                                                        onChange={(e) => setExclusionReason(e.target.value)}
                                                                        className="flex-1"
                                                                        autoFocus
                                                                        maxLength={500}
                                                                        onKeyDown={(e) => {
                                                                            if (e.key === 'Enter') {
                                                                                confirmExclusion(
                                                                                    CheckType.CUSTOM_RULES_CHECK,
                                                                                    identifier,
                                                                                    { ...issue, check_name: check.check_name } as Record<string, unknown>
                                                                                );
                                                                            } else if (e.key === 'Escape') {
                                                                                cancelExclusion();
                                                                            }
                                                                        }}
                                                                    />
                                                                    <Button
                                                                        size="sm"
                                                                        onClick={() => confirmExclusion(
                                                                            CheckType.CUSTOM_RULES_CHECK,
                                                                            identifier,
                                                                            { ...issue, check_name: check.check_name } as Record<string, unknown>
                                                                        )}
                                                                    >
                                                                        <Check className="h-4 w-4" />
                                                                    </Button>
                                                                    <Button
                                                                        size="sm"
                                                                        variant="outline"
                                                                        onClick={cancelExclusion}
                                                                    >
                                                                        <X className="h-4 w-4" />
                                                                    </Button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    );
                                })}
                            </CardContent>
                        </Card>
                    )}

                    {/* No issues state */}
                    {totalIssues === 0 && (
                        <Card>
                            <CardContent className="py-12 text-center">
                                <CheckCircle2 className="h-12 w-12 mx-auto text-green-500 mb-4" />
                                <h3 className="text-lg font-semibold">No Issues Found</h3>
                                <p className="text-muted-foreground">
                                    This report has no issues to review.
                                </p>
                            </CardContent>
                        </Card>
                    )}
                </div>

                {/* Footer with Save/Cancel buttons */}
                <Separator />
                <div className="flex items-center justify-end gap-3 pb-12">
                    <Button
                        variant="outline"
                        size="lg"
                        onClick={() => router.push(`/dashboard/reports/${reportId}`)}
                        disabled={saveMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <Button
                        size="lg"
                        onClick={() => saveMutation.mutate()}
                        disabled={!hasChanges || saveMutation.isPending}
                    >
                        {saveMutation.isPending ? (
                            <>
                                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            <>
                                <Save className="h-5 w-5 mr-2" />
                                Save Changes
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}

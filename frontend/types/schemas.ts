import { z } from 'zod';

// View mode for All/Me toggles
export const ViewModeSchema = z.enum(['all', 'me']);
export type ViewMode = z.infer<typeof ViewModeSchema>;

// ReportSummary Schema (for bidirectional navigation)
export const ReportSummarySchema = z.object({
  id: z.string(),
  evaluation_rating: z.number().nullable(),
  created_at: z.string(),
});

// BPMNModel Schema
export const BPMNModelSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  version: z.string(),
  file_path: z.string(),
  file_size: z.number().nullable(),
  uploaded_by: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  reports: z.array(ReportSummarySchema).default([]),
});

export const ModelsResponseSchema = z.object({
  total: z.number(),
  items: z.array(BPMNModelSchema),
});

export const BPMNModelDeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  id: z.string(),
});

// Request schemas for model updates
export const BPMNModelUpdateSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(1000).nullable().optional(),
  version: z.string().max(50).optional(),
});

// Request schema for analysis
export const AnalysisRequestSchema = z.object({
  model_id: z.string().min(1, 'model_id is required'),
});

// Validation schemas
export const IssueCategory = z.enum(['error', 'warning']);

export const ValidationIssueSchema = z.object({
  id: z.string(),
  message: z.string(),
  category: IssueCategory,
});

export const ValidationRuleSchema = z.object({
  rule_name: z.string(),
  issues: z.array(ValidationIssueSchema),
});

export const ValidationResultSchema = z.object({
  file: z.string(),
  is_valid: z.boolean(),
  error_count: z.number(),
  warning_count: z.number(),
  total_issues: z.number(),
  issues: z.array(ValidationRuleSchema),
  error_message: z.string().nullable(),
});

// Semantic Label Check schemas
export const SemanticLabelViolationSchema = z.object({
  bpmn_element_id: z.string(),
  rule_id: z.string(),
  explanation: z.string(),
});

export const SemanticLabelCheckResultSchema = z.object({
  rating: z.number().min(0).max(100),
  evaluation: z.string(),
  violations: z.array(SemanticLabelViolationSchema),
});

// Duplicate Check schemas
export const ModelRatingSchema = z.object({
  model_id: z.string(),
  model_name: z.string().optional(),
  rating: z.number().min(0).max(10),
  reasoning: z.string(),
});

export const DuplicateCheckResultSchema = z.object({
  response_answer: z.string(),
  similar_models: z.array(ModelRatingSchema),
});

// Custom Checks schemas
export const CustomCheckCategory = z.enum(['error', 'warning', 'info']);

export const CustomCheckIssueSchema = z.object({
  check_id: z.string(),
  message: z.string(),
  category: CustomCheckCategory,
  element_id: z.string().nullable(),
  element_name: z.string().nullable(),
});

export const CustomCheckSchema = z.object({
  check_name: z.string(),
  check_key: z.string(),
  description: z.string(),
  passed: z.boolean(),
  issues: z.array(CustomCheckIssueSchema),
});

export const CustomChecksResultSchema = z.object({
  file: z.string(),
  checks_passed: z.number(),
  checks_failed: z.number(),
  total_checks: z.number(),
  error_count: z.number(),
  warning_count: z.number(),
  info_count: z.number(),
  total_issues: z.number(),
  checks: z.array(CustomCheckSchema),
  error_message: z.string().nullable(),
});

// Complexity Check schemas
export const CWBreakdownStrictSchema = z.object({
  standard_tasks: z.number(),
  loop_tasks: z.number(),
  sub_processes: z.number(),
  xor_binary: z.number(),
  xor_case: z.number(),
  and_splits: z.number(),
  or_splits: z.number(),
  event_gateways: z.number(),
  events: z.number(),
});

export const ComplexityCheckResultSchema = z.object({
  cfc_score: z.number(),
  cfc_breakdown: z.record(z.string(), z.tuple([z.number(), z.number()])),
  cw_score: z.number(),
  cw_breakdown: CWBreakdownStrictSchema,
});

// Evaluation Report schemas
export const ModelDescriptionSchema = z.object({
  description: z.string(),
});

export const ModelEvaluationSchema = z.object({
  evaluation_summary: z.string(),
  evaluation_rating: z.number().min(1).max(10),
});

export const EvaluationReportSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  file_path: z.string(),
  file_name: z.string().nullable().optional(),
  uploaded_by: z.string().nullable().optional(),
  model_description: ModelDescriptionSchema,
  model_evaluation: ModelEvaluationSchema.nullable(),
  syntax_check: ValidationResultSchema.nullable(),
  duplicate_check: DuplicateCheckResultSchema.nullable(),
  semantic_label_check: SemanticLabelCheckResultSchema.nullable(),
  custom_rules_check: CustomChecksResultSchema.nullable(),
  complexity_check: ComplexityCheckResultSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const EvaluationReportsResponseSchema = z.object({
  total: z.number(),
  items: z.array(EvaluationReportSchema),
});

export const EvaluationReportDeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  id: z.string(),
});

// Issue Exclusion schemas
export const CheckTypeSchema = z.enum(['syntax_check', 'semantic_label_check', 'custom_rules_check']);

// CheckType as const object for enum-like usage (e.g., CheckType.SYNTAX_CHECK)
export const CheckType = {
  SYNTAX_CHECK: 'syntax_check',
  SEMANTIC_LABEL_CHECK: 'semantic_label_check',
  CUSTOM_RULES_CHECK: 'custom_rules_check',
} as const;

export const IssueExclusionCreateSchema = z.object({
  check_type: CheckTypeSchema,
  issue_identifier: z.record(z.string(), z.unknown()),
  issue_snapshot: z.record(z.string(), z.unknown()),
  reason: z.string().max(500).nullable().optional(),
});

export const IssueExclusionSchema = z.object({
  id: z.string(),
  report_id: z.string(),
  check_type: CheckTypeSchema,
  issue_identifier: z.record(z.string(), z.unknown()),
  issue_snapshot: z.record(z.string(), z.unknown()),
  reason: z.string().nullable(),
  excluded_by: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const IssueExclusionListResponseSchema = z.object({
  total: z.number(),
  items: z.array(IssueExclusionSchema),
});

export const IssueExclusionDeleteResponseSchema = z.object({
  success: z.boolean(),
  message: z.string(),
  id: z.string(),
});

export const BulkExclusionCreateSchema = IssueExclusionCreateSchema;

export const BulkExclusionRequestSchema = z.object({
  to_create: z.array(BulkExclusionCreateSchema).default([]),
  to_delete: z.array(z.string()).default([]),
});

export const BulkExclusionResponseSchema = z.object({
  success: z.boolean(),
  created_count: z.number(),
  deleted_count: z.number(),
  skipped_count: z.number(),
  exclusions: z.array(IssueExclusionSchema),
});

// Type exports (inferred from Zod schemas)
export type ReportSummary = z.infer<typeof ReportSummarySchema>;
export type BPMNModel = z.infer<typeof BPMNModelSchema>;
export type ModelsResponse = z.infer<typeof ModelsResponseSchema>;
export type BPMNModelDeleteResponse = z.infer<typeof BPMNModelDeleteResponseSchema>;
export type BPMNModelUpdate = z.infer<typeof BPMNModelUpdateSchema>;
export type AnalysisRequest = z.infer<typeof AnalysisRequestSchema>;
export type ValidationIssue = z.infer<typeof ValidationIssueSchema>;
export type ValidationRule = z.infer<typeof ValidationRuleSchema>;
export type ValidationResult = z.infer<typeof ValidationResultSchema>;
export type SemanticLabelViolation = z.infer<typeof SemanticLabelViolationSchema>;
export type SemanticLabelCheckResult = z.infer<typeof SemanticLabelCheckResultSchema>;
export type ModelRating = z.infer<typeof ModelRatingSchema>;
export type DuplicateCheckResult = z.infer<typeof DuplicateCheckResultSchema>;
export type CustomCheckIssue = z.infer<typeof CustomCheckIssueSchema>;
export type CustomCheck = z.infer<typeof CustomCheckSchema>;
export type CustomChecksResult = z.infer<typeof CustomChecksResultSchema>;
export type CWBreakdownStrict = z.infer<typeof CWBreakdownStrictSchema>;
export type ComplexityCheckResult = z.infer<typeof ComplexityCheckResultSchema>;
export type ModelDescription = z.infer<typeof ModelDescriptionSchema>;
export type ModelEvaluation = z.infer<typeof ModelEvaluationSchema>;
export type EvaluationReport = z.infer<typeof EvaluationReportSchema>;
export type EvaluationReportsResponse = z.infer<typeof EvaluationReportsResponseSchema>;
export type EvaluationReportDeleteResponse = z.infer<typeof EvaluationReportDeleteResponseSchema>;
export type CheckType = z.infer<typeof CheckTypeSchema>;
export type IssueExclusionCreate = z.infer<typeof IssueExclusionCreateSchema>;
export type IssueExclusion = z.infer<typeof IssueExclusionSchema>;
export type IssueExclusionListResponse = z.infer<typeof IssueExclusionListResponseSchema>;
export type IssueExclusionDeleteResponse = z.infer<typeof IssueExclusionDeleteResponseSchema>;
export type BulkExclusionCreate = z.infer<typeof BulkExclusionCreateSchema>;
export type BulkExclusionRequest = z.infer<typeof BulkExclusionRequestSchema>;
export type BulkExclusionResponse = z.infer<typeof BulkExclusionResponseSchema>;

// KPI Dashboard schemas
export const RatingDistributionSchema = z.object({
  rating: z.number().min(1).max(10),
  count: z.number().min(0),
});

export const ReportTrendSchema = z.object({
  date: z.string(),
  count: z.number().min(0),
  avg_rating: z.number().nullable(),
});

export const SyntaxMetricsSchema = z.object({
  total_errors: z.number().min(0),
  total_warnings: z.number().min(0),
  avg_errors_per_report: z.number().min(0),
  avg_warnings_per_report: z.number().min(0),
});

export const ComplexityMetricsSchema = z.object({
  avg_cfc_score: z.number().min(0),
  avg_cw_score: z.number().min(0),
});

export const SemanticLabelMetricsSchema = z.object({
  avg_rating: z.number().min(0).max(100),
});

export const CustomRulesMetricsSchema = z.object({
  total_checks: z.number().min(0),
  total_passed: z.number().min(0),
  total_failed: z.number().min(0),
  pass_rate: z.number().min(0).max(100),
});

export const ViolationDistributionSchema = z.object({
  category: z.string(),
  count: z.number().min(0),
});

export const RecentReportSchema = z.object({
  id: z.string(),
  model_id: z.string(),
  file_path: z.string(),
  file_name: z.string(),
  evaluation_rating: z.number().min(1).max(10).nullable(),
  complexity_level: z.string(),
  cfc_score: z.number().nullable(),
  created_at: z.string(),
});

export const KPIResponseSchema = z.object({
  total_reports: z.number().min(0),
  learning_suggestions: z.string().nullable().optional(),
  avg_evaluation_rating: z.number().nullable(),
  complexity_level: z.string(),
  avg_cfc_score: z.number().nullable(),
  most_common_violation: z.string(),
  duplicate_risk_percentage: z.number().min(0).max(100),
  syntax_metrics: SyntaxMetricsSchema,
  complexity_metrics: ComplexityMetricsSchema,
  semantic_label_metrics: SemanticLabelMetricsSchema,
  custom_rules_metrics: CustomRulesMetricsSchema,
  violation_distribution: z.array(ViolationDistributionSchema),
  rating_distribution: z.array(RatingDistributionSchema),
  report_trends: z.array(ReportTrendSchema),
  recent_reports: z.array(RecentReportSchema),
  cached_at: z.string(),
});

export type RatingDistribution = z.infer<typeof RatingDistributionSchema>;
export type ReportTrend = z.infer<typeof ReportTrendSchema>;
export type SyntaxMetrics = z.infer<typeof SyntaxMetricsSchema>;
export type ComplexityMetrics = z.infer<typeof ComplexityMetricsSchema>;
export type SemanticLabelMetrics = z.infer<typeof SemanticLabelMetricsSchema>;
export type CustomRulesMetrics = z.infer<typeof CustomRulesMetricsSchema>;
export type ViolationDistribution = z.infer<typeof ViolationDistributionSchema>;
export type RecentReport = z.infer<typeof RecentReportSchema>;
export type KPIResponse = z.infer<typeof KPIResponseSchema>;

// Analysis Status schemas
export const StepStatusSchema = z.enum(['running', 'completed']);

export const AnalysisStatusSchema = z.object({
  id: z.string().uuid(),
  model_id: z.string().uuid(),
  model_name: z.string(),
  status: z.enum(['running', 'completed', 'failed']),
  steps_completed: z.array(z.string()),
  steps_status: z.record(z.string(), StepStatusSchema),
  report_id: z.string().uuid().nullable(),
  error: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const RunningAnalysesResponseSchema = z.object({
  analyses: z.array(AnalysisStatusSchema),
  total: z.number(),
});

export const StartAnalysisResponseSchema = z.object({
  analysis_id: z.string().uuid(),
  status: z.literal('started'),
});

export type StepStatus = z.infer<typeof StepStatusSchema>;
export type AnalysisStatus = z.infer<typeof AnalysisStatusSchema>;
export type RunningAnalysesResponse = z.infer<typeof RunningAnalysesResponseSchema>;
export type StartAnalysisResponse = z.infer<typeof StartAnalysisResponseSchema>;

// Analysis step definitions - order matters for UI display
export const ANALYSIS_STEPS = [
  { id: 'duplicate_check', label: 'Duplicate Check' },
  { id: 'semantic_label_check', label: 'Semantic Label Check' },
  { id: 'complexity_check', label: 'Complexity Check' },
  { id: 'custom_checks', label: 'Custom Rules Check' },
  { id: 'validation_check', label: 'Syntax Validation' },
  { id: 'overall_evaluation', label: 'Overall Evaluation' },
] as const;

export type AnalysisStepId = (typeof ANALYSIS_STEPS)[number]['id'];

// Analysis status value type (extracted for convenience)
export type AnalysisStatusValue = AnalysisStatus['status'];

// Chat schemas
export const ChatMessageSchema = z.object({
  id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.string(),
});

export const ChatHistoryResponseSchema = z.object({
  messages: z.array(ChatMessageSchema),
  total: z.number(),
});

export const ChatRequestSchema = z.object({
  report_id: z.string(),
  message: z.string(),
});

export const ChatDeleteResponseSchema = z.object({
  success: z.boolean(),
  deleted_count: z.number(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export type ChatHistoryResponse = z.infer<typeof ChatHistoryResponseSchema>;
export type ChatRequest = z.infer<typeof ChatRequestSchema>;
export type ChatDeleteResponse = z.infer<typeof ChatDeleteResponseSchema>;

import React from 'react';
import {
  Document,
  Page,
  Text,
  View,
} from '@react-pdf/renderer';
import type { EvaluationReport } from '@/types/schemas';
import { styles } from './styles';
import { formatDate, formatDateShort } from '@/lib/date';

interface PDFReportProps {
  report: EvaluationReport;
}

// Header Component
const ReportHeader: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  const modelName = report.file_path.split('/').pop() || 'Unknown Model';

  return (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>BPMN Model Evaluation Report</Text>
      <Text style={styles.headerSubtitle}>Model: {modelName}</Text>
      <Text style={styles.headerSubtitle}>Report ID: {report.id}</Text>
      <Text style={styles.headerSubtitle}>Generated: {formatDate(report.created_at)}</Text>
    </View>
  );
};

// Footer Component
const ReportFooter: React.FC = () => {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        BPMN Quality Assessment | {formatDateShort(new Date().toISOString())}
      </Text>
      <Text
        style={styles.pageNumber}
        render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`}
      />
    </View>
  );
};

// Overall Assessment Component
const OverallAssessment: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  if (!report.model_evaluation) {
    return null;
  }

  const rating = report.model_evaluation.evaluation_rating;
  const progressPercentage = (rating / 10) * 100;

  const getProgressBarColor = (rating: number) => {
    if (rating <= 3) return styles.progressBarRed;
    if (rating <= 6) return styles.progressBarYellow;
    return styles.progressBarGreen;
  };

  const getRatingBadge = (rating: number) => {
    if (rating <= 3) return { style: styles.badgeDanger, text: 'NEEDS IMPROVEMENT' };
    if (rating <= 6) return { style: styles.badgeWarning, text: 'GOOD' };
    return { style: styles.badgeSuccess, text: 'EXCELLENT' };
  };

  const badge = getRatingBadge(rating);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={60}>1. Overall Assessment</Text>
      <View style={styles.subsection} wrap={false}>
        <View style={styles.ratingRow}>
          <Text style={styles.subsectionTitle}>1.1 Quality Rating</Text>
          <View style={badge.style}>
            <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{badge.text}</Text>
          </View>
        </View>

        <View style={styles.ratingContainer}>
          <View style={styles.ratingRow}>
            <Text style={styles.ratingLabel}>Overall Score</Text>
            <Text style={styles.ratingScore}>{rating}/10</Text>
          </View>

          <View style={styles.progressBarContainer}>
            <View
              style={[
                styles.progressBarFill,
                getProgressBarColor(rating),
                { width: `${progressPercentage}%` }
              ]}
            />
          </View>

          <Text style={styles.evaluationSummary}>
            {report.model_evaluation.evaluation_summary}
          </Text>
        </View>
      </View>
    </View>
  );
};

// Model Description Component
const ModelDescription: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>2. Model Description</Text>
      <View style={styles.subsection} wrap={false}>
        <Text style={styles.contentText}>
          {report.model_description.description}
        </Text>
      </View>
    </View>
  );
};

// Syntax Check Component
const SyntaxCheck: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  if (!report.syntax_check) {
    return null;
  }

  const syntaxCheck = report.syntax_check;
  const hasIssues = syntaxCheck.total_issues > 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={50}>3. Syntax Validation</Text>
      <View style={styles.subsection} wrap={false}>
        <View style={styles.ratingRow}>
          <Text style={styles.subsectionTitle}>3.1 Validation Status</Text>
          <View style={syntaxCheck.is_valid ? styles.badgeSuccess : styles.badgeDanger}>
            <Text style={{ fontSize: 8, fontWeight: 'bold' }}>
              {syntaxCheck.is_valid ? 'VALID' : 'INVALID'}
            </Text>
          </View>
        </View>

        <View style={styles.metadataContainer}>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Total Issues: </Text>
            {syntaxCheck.total_issues}
          </Text>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Errors: </Text>
            {syntaxCheck.error_count}
          </Text>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Warnings: </Text>
            {syntaxCheck.warning_count}
          </Text>
        </View>

        {syntaxCheck.error_message && (
          <Text style={[styles.contentText, { marginTop: 8, color: '#DC2626' }]}>
            {syntaxCheck.error_message}
          </Text>
        )}
      </View>

      {hasIssues && syntaxCheck.issues.map((rule, idx) => (
        <View key={idx} style={[styles.subsection, { marginTop: 12 }]} wrap={false}>
          <Text style={styles.subsectionTitle}>3.{idx + 2} {rule.rule_name}</Text>
          {rule.issues.map((issue, issueIdx) => (
            <View key={issueIdx} style={{ marginTop: 4 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                <View style={issue.category === 'error' ? styles.badgeDanger : styles.badgeWarning}>
                  <Text style={{ fontSize: 7, fontWeight: 'bold' }}>
                    {issue.category.toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.contentText}>
                    {issue.message}
                  </Text>
                  {issue.id && (
                    <Text style={[styles.metadataItem, { marginTop: 2 }]}>
                      <Text style={styles.metadataLabel}>Element ID: </Text>
                      {issue.id}
                    </Text>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
};

// Semantic Label Check Component
const SemanticLabelCheck: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  if (!report.semantic_label_check) {
    return null;
  }

  const semanticCheck = report.semantic_label_check;
  const hasViolations = semanticCheck.violations.length > 0;

  const getRatingBadge = (rating: number) => {
    if (rating <= 20) return { style: styles.badgeDanger, text: 'NEEDS IMPROVEMENT' };
    if (rating <= 40) return { style: styles.badgeWarning, text: 'GOOD' };
    return { style: styles.badgeSuccess, text: 'EXCELLENT' };
  };

  const badge = getRatingBadge(semanticCheck.rating);

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={50}>4. Semantic Label Validation</Text>
      <View style={styles.subsection} wrap={false}>
        <View style={styles.ratingRow}>
          <Text style={styles.subsectionTitle}>4.1 Semantic Quality</Text>
          <View style={badge.style}>
            <Text style={{ fontSize: 8, fontWeight: 'bold' }}>{badge.text}</Text>
          </View>
        </View>

        <View style={styles.ratingRow}>
          <Text style={styles.ratingLabel}>Rating Score</Text>
          <Text style={styles.ratingScore}>{semanticCheck.rating}/100</Text>
        </View>

        <Text style={styles.evaluationSummary}>
          {semanticCheck.evaluation}
        </Text>

        <Text style={[styles.metadataItem, { marginTop: 8 }]}>
          <Text style={styles.metadataLabel}>Violations Found: </Text>
          {semanticCheck.violations.length}
        </Text>
      </View>

      {hasViolations && semanticCheck.violations.map((violation, idx) => (
        <View key={idx} style={[styles.subsection, { marginTop: 12 }]} wrap={false}>
          <Text style={styles.subsectionTitle}>4.{idx + 2} Element: {violation.bpmn_element_id}</Text>
          <Text style={[styles.metadataItem, { marginTop: 4 }]}>
            <Text style={styles.metadataLabel}>Rule ID: </Text>
            {violation.rule_id}
          </Text>
          <Text style={[styles.contentText, { marginTop: 4 }]}>
            {violation.explanation}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Custom Rules Check Component
const CustomRulesCheck: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  if (!report.custom_rules_check) {
    return null;
  }

  const customCheck = report.custom_rules_check;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={50}>5. Custom Rules Validation</Text>
      <View style={styles.subsection} wrap={false}>
        <Text style={styles.subsectionTitle}>5.1 Check Summary</Text>

        <View style={styles.metadataContainer}>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Total Checks: </Text>
            {customCheck.total_checks}
          </Text>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Passed: </Text>
            {customCheck.checks_passed}
          </Text>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Failed: </Text>
            {customCheck.checks_failed}
          </Text>
        </View>

        <View style={styles.metadataContainer}>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Errors: </Text>
            {customCheck.error_count}
          </Text>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Warnings: </Text>
            {customCheck.warning_count}
          </Text>
          <Text style={styles.metadataItem}>
            <Text style={styles.metadataLabel}>Info: </Text>
            {customCheck.info_count}
          </Text>
        </View>

        {customCheck.error_message && (
          <Text style={[styles.contentText, { marginTop: 8, color: '#DC2626' }]}>
            {customCheck.error_message}
          </Text>
        )}
      </View>

      {customCheck.checks.map((check, idx) => (
        <View key={idx} style={[styles.subsection, { marginTop: 12 }]} wrap={false}>
          <View style={styles.ratingRow}>
            <Text style={styles.subsectionTitle}>5.{idx + 2} {check.check_name}</Text>
            <View style={check.passed ? styles.badgeSuccess : styles.badgeDanger}>
              <Text style={{ fontSize: 8, fontWeight: 'bold' }}>
                {check.passed ? 'PASSED' : 'FAILED'}
              </Text>
            </View>
          </View>

          <Text style={[styles.contentText, { marginTop: 4 }]}>
            {check.description}
          </Text>

          {check.issues.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {check.issues.map((issue, issueIdx) => (
                <View key={issueIdx} style={{ marginTop: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
                    <View
                      style={
                        issue.category === 'error'
                          ? styles.badgeDanger
                          : issue.category === 'warning'
                            ? styles.badgeWarning
                            : styles.badgeSuccess
                      }
                    >
                      <Text style={{ fontSize: 7, fontWeight: 'bold' }}>
                        {issue.category.toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text style={styles.contentText}>{issue.message}</Text>
                      {issue.element_id && (
                        <Text style={[styles.metadataItem, { marginTop: 2 }]}>
                          <Text style={styles.metadataLabel}>Element: </Text>
                          {issue.element_name || issue.element_id}
                        </Text>
                      )}
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      ))}
    </View>
  );
};

// Complexity Check Component
const ComplexityCheck: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  if (!report.complexity_check) {
    return null;
  }

  const complexityCheck = report.complexity_check;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={50}>6. Complexity Analysis</Text>

      <View style={styles.subsection} wrap={false}>
        <Text style={styles.subsectionTitle}>6.1 Control Flow Complexity (CFC)</Text>
        <Text style={styles.ratingScore}>{complexityCheck.cfc_score}</Text>

        <View style={{ marginTop: 8 }}>
          {Object.entries(complexityCheck.cfc_breakdown).map(([key, [weight, count]], idx) => (
            <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
              <Text style={styles.contentText}>{key}</Text>
              <Text style={styles.contentText}>
                Weight: {weight} × Count: {count} = {weight * count}
              </Text>
            </View>
          ))}
        </View>
      </View>

      <View style={[styles.subsection, { marginTop: 12 }]} wrap={false}>
        <Text style={styles.subsectionTitle}>6.2 Cyclomatic Weight (CW)</Text>
        <Text style={styles.ratingScore}>{complexityCheck.cw_score}</Text>

        <View style={{ marginTop: 8 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>Standard Tasks</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.standard_tasks}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>Loop Tasks</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.loop_tasks}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>Sub Processes</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.sub_processes}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>XOR Binary</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.xor_binary}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>XOR Case</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.xor_case}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>AND Splits</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.and_splits}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>OR Splits</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.or_splits}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>Event Gateways</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.event_gateways}</Text>
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 2 }}>
            <Text style={styles.contentText}>Events</Text>
            <Text style={styles.contentText}>{complexityCheck.cw_breakdown.events}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

// Duplicate Check Component
const DuplicateCheck: React.FC<{ report: EvaluationReport }> = ({ report }) => {
  if (!report.duplicate_check) {
    return null;
  }

  const duplicateCheck = report.duplicate_check;
  const hasSimilarModels = duplicateCheck.similar_models.length > 0;

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle} minPresenceAhead={40}>7. Duplicate Analysis</Text>

      <View style={styles.subsection} wrap={false}>
        <Text style={styles.subsectionTitle}>7.1 Analysis Result</Text>
        <Text style={styles.contentText}>
          {duplicateCheck.response_answer}
        </Text>

        {hasSimilarModels && (
          <Text style={[styles.metadataItem, { marginTop: 8 }]}>
            <Text style={styles.metadataLabel}>Similar Models Found: </Text>
            {duplicateCheck.similar_models.length}
          </Text>
        )}
      </View>

      {hasSimilarModels && duplicateCheck.similar_models.map((model, idx) => (
        <View key={idx} style={[styles.subsection, { marginTop: 12 }]} wrap={false}>
          <View style={styles.ratingRow}>
            <Text style={styles.subsectionTitle}>7.{idx + 2} Model ID: {model.model_id}</Text>
            <Text style={[styles.ratingScore, { fontSize: 14 }]}>{model.rating}/10</Text>
          </View>
          <Text style={[styles.contentText, { marginTop: 4 }]}>
            {model.reasoning}
          </Text>
        </View>
      ))}
    </View>
  );
};

// Main PDF Document Component
export const PDFReport: React.FC<PDFReportProps> = ({ report }) => {
  return (
    <Document
      title={`BPMN Evaluation Report - ${report.model_id}`}
      author="BPMN Quality Assessment System"
      subject="BPMN Model Evaluation"
      keywords="BPMN, evaluation, quality, assessment"
    >
      <Page size="A4" style={styles.page}>
        <ReportHeader report={report} />

        <OverallAssessment report={report} />

        <ModelDescription report={report} />

        <SyntaxCheck report={report} />

        <SemanticLabelCheck report={report} />

        <CustomRulesCheck report={report} />

        <ComplexityCheck report={report} />

        <DuplicateCheck report={report} />

        <ReportFooter />
      </Page>
    </Document>
  );
};

export default PDFReport;

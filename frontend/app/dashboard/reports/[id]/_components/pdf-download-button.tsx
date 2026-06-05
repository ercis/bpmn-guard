'use client';

import React from 'react';
import { PDFDownloadLink } from '@react-pdf/renderer';
import { Button } from '@/components/ui/button';
import { FileText, Loader2, Download } from 'lucide-react';
import type { EvaluationReport } from '@/types/schemas';
import { PDFReport } from './pdf-report';

interface PDFDownloadButtonProps {
  report: EvaluationReport;
  variant?: 'default' | 'secondary' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export const PDFDownloadButton: React.FC<PDFDownloadButtonProps> = ({
  report,
  variant = 'secondary',
  size = 'lg',
  className = '',
}) => {
  const fileName = `BPMN_Evaluation_Report_${report.model_id}_${new Date().toISOString().split('T')[0]}.pdf`;

  return (
    <PDFDownloadLink
      document={<PDFReport report={report} />}
      fileName={fileName}
      className={className}
    >
      {({ loading, error }) => {
        if (loading) {
          return (
            <Button size={size} variant={variant} disabled className="hover:cursor-pointer w-full sm:w-fit">
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              Generating PDF...
            </Button>
          );
        }

        if (error) {
          return (
            <Button size={size} variant="destructive" disabled className="hover:cursor-pointer w-full sm:w-fit">
              <FileText className="h-5 w-5 mr-2" />
              PDF Error
            </Button>
          );
        }

        return (
          <Button size={size} variant={variant} className="hover:cursor-pointer w-full sm:w-fit">
            <Download className="h-5 w-5 mr-2" />
            Download Report
          </Button>
        );
      }}
    </PDFDownloadLink>
  );
};

export default PDFDownloadButton;

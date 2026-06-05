'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
    Upload,
    FileSearch,
    PlayCircle,
    FileText,
    CheckCircle2,
    AlertTriangle,
    Download,
    Trash2,
    Eye,
    EyeOff,
    ClipboardCheck,
    Workflow,
    ArrowRight
} from "lucide-react";

export default function HelpPage() {
    return (
        <div className="w-full min-h-screen py-6">
            <div className="space-y-8 pb-12">
                {/* Header */}
                <div className="space-y-2">
                    <h1 className="text-3xl font-bold tracking-tight">Help & Documentation</h1>
                    <p className="text-muted-foreground">
                        Learn how to use the BPMN Evaluation Platform to analyze and improve your process models.
                    </p>
                </div>

                <Separator />

                {/* Section 1: Upload and Manage Models */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Workflow className="h-6 w-6" />
                            Upload and Manage Models
                        </CardTitle>
                        <CardDescription>
                            How to upload, view, edit, and organize your BPMN models
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Upload */}
                        <div className="space-y-3">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Upload className="h-4 w-4" />
                                Uploading Models
                            </h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                                <li>Navigate to <strong>Models → Upload New</strong> from the sidebar</li>
                                <li>Drag and drop your BPMN files into the upload zone, or click to browse</li>
                                <li>Supported formats: <code>.bpmn</code> and <code>.xml</code> files (max 5MB each)</li>
                                <li>You can upload multiple files at once (up to 10 files)</li>
                                <li>Click <strong>Upload</strong> to submit your models</li>
                                <li>A description will be automatically generated for each model</li>
                            </ol>
                        </div>

                        <Separator />

                        {/* View & Manage */}
                        <div className="space-y-3">
                            <h3 className="font-semibold flex items-center gap-2">
                                <FileSearch className="h-4 w-4" />
                                Viewing and Managing Models
                            </h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                                <li>Go to <strong>Models → All Models</strong> to see your uploaded models</li>
                                <li>Click <strong>Details</strong> on any model to view its full information</li>
                                <li>From the details page you can:
                                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                        <li><strong>Edit</strong> – Update the name, description, version, or replace the file</li>
                                        <li><strong>Download</strong> – Download the original BPMN file</li>
                                        <li><strong>Delete</strong> – Remove the model permanently</li>
                                    </ul>
                                </li>
                                <li>Use checkboxes in the table to select multiple models for bulk deletion</li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 2: Running an Analysis */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <PlayCircle className="h-6 w-6" />
                            Running a New Analysis
                        </CardTitle>
                        <CardDescription>
                            How to evaluate your BPMN models for quality and compliance
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <div className="space-y-3">
                            <h3 className="font-semibold">Starting an Analysis</h3>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2">
                                <li>Navigate to <strong>Evaluations → New Analysis</strong></li>
                                <li>Choose your input method:
                                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                        <li><strong>Select Existing Model</strong> – Pick from your uploaded models</li>
                                        <li><strong>Upload New Model</strong> – Upload a file directly for analysis</li>
                                    </ul>
                                </li>
                                <li>Click <strong>Start Analysis</strong> to begin the evaluation</li>
                                <li>You will be automatically redirected to the report page once the analysis completes</li>
                            </ol>
                        </div>

                        <Separator />

                        <div className="space-y-3">
                            <h3 className="font-semibold">What Gets Analyzed</h3>
                            <p className="text-sm text-muted-foreground">
                                Each analysis evaluates your model across multiple dimensions:
                            </p>
                            <ul className="space-y-2 text-sm text-muted-foreground ml-2">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="h-4 w-4 mt-0.5 text-green-600" />
                                    <span><strong>Syntax Validation</strong> – Checks for BPMN structural correctness</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <FileText className="h-4 w-4 mt-0.5 text-blue-600" />
                                    <span><strong>Semantic Labels</strong> – Evaluates naming conventions and label quality</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <AlertTriangle className="h-4 w-4 mt-0.5 text-orange-600" />
                                    <span><strong>Custom Rules</strong> – Project-specific business rules and best practices</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Workflow className="h-4 w-4 mt-0.5 text-purple-600" />
                                    <span><strong>Complexity Analysis</strong> – Control flow and cognitive weight metrics</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <FileSearch className="h-4 w-4 mt-0.5 text-gray-600" />
                                    <span><strong>Duplicate Detection</strong> – Identifies similar models in your repository</span>
                                </li>
                            </ul>
                        </div>
                    </CardContent>
                </Card>

                {/* Section 3: Understanding Reports */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <FileText className="h-6 w-6" />
                            Understanding the Report Page
                        </CardTitle>
                        <CardDescription>
                            How to read, interact with, and export your evaluation reports
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Report Overview */}
                        <div className="space-y-3">
                            <h3 className="font-semibold">Report Overview</h3>
                            <p className="text-sm text-muted-foreground">
                                Each report provides a comprehensive evaluation of your BPMN model. At the top, you&apos;ll see an overall quality rating (0-10) with a summary of the analysis results.
                            </p>
                        </div>

                        <Separator />

                        {/* BPMN Visualization */}
                        <div className="space-y-3">
                            <h3 className="font-semibold flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Interactive BPMN Visualization
                            </h3>
                            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-2">
                                <li>Toggle the visualization on/off using the <strong>Show/Hide Visualization</strong> button</li>
                                <li>Elements with issues are highlighted with colored markers:
                                    <ul className="list-disc list-inside ml-4 mt-1 space-y-1">
                                        <li><span className="text-red-600">Red</span> – Errors that need attention</li>
                                        <li><span className="text-orange-500">Orange</span> – Warnings to review</li>
                                        <li><span className="text-blue-600">Blue</span> – Semantic label issues</li>
                                    </ul>
                                </li>
                                <li>Hover over highlighted elements to see issue details</li>
                                <li>Use zoom controls to navigate large diagrams</li>
                            </ul>
                        </div>

                        <Separator />

                        {/* Report Sections */}
                        <div className="space-y-3">
                            <h3 className="font-semibold">Report Sections</h3>
                            <p className="text-sm text-muted-foreground mb-2">
                                The report is organized into distinct sections:
                            </p>
                            <ul className="space-y-2 text-sm text-muted-foreground ml-2">
                                <li><strong>Model Description</strong> – Auto-generated summary of your process</li>
                                <li><strong>Overall Evaluation</strong> – Quality rating and summary</li>
                                <li><strong>Semantic Label Analysis</strong> – Naming convention violations</li>
                                <li><strong>Syntax Validation</strong> – Structural errors and warnings</li>
                                <li><strong>Custom Business Rules</strong> – Project-specific rule violations</li>
                                <li><strong>Duplicate Detection</strong> – Similar models in your repository</li>
                                <li><strong>Complexity Analysis</strong> – CFC and cognitive weight metrics</li>
                            </ul>
                        </div>

                        <Separator />

                        {/* Actions */}
                        <div className="space-y-3">
                            <h3 className="font-semibold">Report Actions</h3>
                            <ul className="space-y-3 text-sm text-muted-foreground ml-2">
                                <li className="flex items-start gap-2">
                                    <Download className="h-4 w-4 mt-0.5" />
                                    <span><strong>Download Report</strong> – Export the report as a PDF document for sharing or archival</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <ClipboardCheck className="h-4 w-4 mt-0.5" />
                                    <span><strong>Review Report</strong> – Open the review page to exclude irrelevant issues (see below)</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Trash2 className="h-4 w-4 mt-0.5" />
                                    <span><strong>Delete Report</strong> – Permanently remove the report</span>
                                </li>
                            </ul>
                        </div>

                        <Separator />

                        {/* Review & Exclude */}
                        <div className="space-y-3">
                            <h3 className="font-semibold flex items-center gap-2">
                                <ClipboardCheck className="h-4 w-4" />
                                Reviewing and Excluding Issues
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                Sometimes the analysis may flag issues that are not relevant to your specific use case. The review feature allows you to exclude these issues:
                            </p>
                            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground ml-2 mt-2">
                                <li>Click <strong>Review Report</strong> to open the review page</li>
                                <li>Browse through all detected issues organized by category</li>
                                <li>Click <strong>Exclude</strong> on any issue you want to remove from the report</li>
                                <li>Optionally provide a reason for the exclusion</li>
                                <li>Click <strong>Save Changes</strong> when done</li>
                            </ol>
                            <div className="mt-3 p-3 bg-muted rounded-lg">
                                <p className="text-sm flex items-start gap-2">
                                    <EyeOff className="h-4 w-4 mt-0.5" />
                                    <span>
                                        <strong>Transparency:</strong> Excluded issues are hidden from the main report but remain visible in a dedicated &quot;Excluded Issues&quot; section at the bottom for audit purposes.
                                    </span>
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Tips */}
                <Card>
                    <CardHeader>
                        <CardTitle>Quick Tips</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <ul className="space-y-2 text-sm text-muted-foreground">
                            <li className="flex items-start gap-2">
                                <ArrowRight className="h-4 w-4 mt-0.5" />
                                <span>Use descriptive names for your models to easily identify them later</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight className="h-4 w-4 mt-0.5" />
                                <span>Run analyses regularly as you iterate on your process designs</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight className="h-4 w-4 mt-0.5" />
                                <span>Export PDF reports to share findings with stakeholders</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <ArrowRight className="h-4 w-4 mt-0.5" />
                                <span>Document your exclusion reasons to maintain a clear audit trail</span>
                            </li>
                        </ul>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}

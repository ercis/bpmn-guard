import {
  CheckCircle2,
  FileCode2,
  Brain,
  Shield,
  Target,
  Users,
  Lightbulb,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

export default function Page(){

  const faq_items = [
    {
      id: "faq-1",
      question: "What file formats does BPMN Guard support?",
      answer:
        "BPMN Guard supports BPMN 2.0 files in XML format. The system can import, parse, and normalize these files for comprehensive quality analysis. Future versions may include support for DMN (Decision Model and Notation) files.",
    },
    {
      id: "faq-2",
      question: "How accurate is the quality detection?",
      answer:
        "The system is designed to achieve ≥ 85% accuracy in identifying rule violations compared to manual baseline assessments. This combines rule-based validation, formal analysis, and AI-driven evaluation to ensure comprehensive coverage.",
    },
    {
      id: "faq-3",
      question: "What are the Seven Process Modeling Guidelines (7PMG)?",
      answer:
        "The 7PMG are established best practices for process modeling that ensure clarity, consistency, and maintainability. BPMN Guard enforces these guidelines along with BPMN 2.0 specifications and configurable custom rules to maintain high-quality models.",
    },
    {
      id: "faq-4",
      question: "How fast is the analysis?",
      answer:
        "The system is optimized to deliver analysis results in under 2 seconds per model. This ensures that feedback is provided quickly without interrupting the modeler's workflow.",
    },
    {
      id: "faq-5",
      question: "Can teams collaborate on BPMN models?",
      answer:
        "Yes, BPMN Guard provides shared access to models, rule sets, and analysis results within team or project spaces. It implements role-based access control (RBAC) with roles such as modeler, governor, and admin to facilitate collaboration while maintaining security.",
    },
    {
      id: "faq-6",
      question: "What privacy considerations are in place?",
      answer:
        "Data privacy and security are paramount. The system is designed so that organisations can choose an LLM provider that matches their data-handling policy (including private or on-prem deployments), and BPMN files are stored on infrastructure the operator controls.",
    },
    {
      id: "faq-7",
      question: "How does the AI evaluator work?",
      answer:
        "The AI evaluator uses Large Language Models (LLMs) to provide critique and rubric-driven suggestions for aspects that aren't strictly syntactic, such as naming conventions, label clarity, structural improvements, and documentation consistency.",
    },
    {
      id: "faq-8",
      question: "What makes a BPMN model 'sound'?",
      answer:
        "A sound BPMN model has no deadlocks, proper completion paths, and correct control flow logic. The formal analyzer verifies properties like soundness, safeness, and liveness to ensure the model represents a valid process.",
    },
  ];

  return (
    <section className="max-w-7xl mx-auto px-6 lg:px-16 py-8 md:py-16 lg:py-24">
      <div className="flex flex-col gap-12 lg:flex-row lg:gap-24">
        <article className="mx-auto">
            <div className="mb-12 md:mb-16">
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-sm">
                  AI-Assisted Quality Assurance
                </Badge>
              </div>
              <h1 className="mt-4 text-3xl md:text-4xl lg:text-5xl font-extrabold leading-tight">
                BPMN Guard
              </h1>
              <p className="text-muted-foreground mt-4 md:mt-6 text-base md:text-lg lg:text-xl leading-relaxed">
                An AI-assisted quality assurance system for BPMN models that combines rule-based validation, formal analysis, and intelligent feedback to ensure your business process models meet the highest standards.
              </p>
            </div>

            <section
              id="section1"
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-12 md:mb-16"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Project Overview</h2>
              <p className="text-base md:text-lg leading-relaxed mb-6">
                BPMN Guard is a prototype solution designed to automatically evaluate the quality of Business Process Model and Notation (BPMN) models using a hybrid approach that combines rule-based, formal, and AI-driven methods. The system provides actionable feedback to modelers, helping enforce established quality standards and modeling conventions.
              </p>
              <p className="text-base md:text-lg leading-relaxed mb-6">
                The core goal is to explore how AI can assist organisations in ensuring their BPMN models consistently meet high standards of quality, thereby improving clarity, reducing maintenance overhead, and increasing trust in the models across the organisation.
              </p>
              <Alert className="mt-6">
                <Target className="h-5 w-5 text-primary" />
                <AlertTitle className="text-base md:text-lg font-semibold">Mission</AlertTitle>
                <AlertDescription className="text-sm md:text-base leading-relaxed mt-2">
                  To provide comprehensive, automated quality checks that combine the precision of rule-based validation with the intelligence of AI-driven analysis, ensuring BPMN models are syntactically correct, semantically sound, and consistently documented.
                </AlertDescription>
              </Alert>
            </section>

            <section
              id="section2"
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-12 md:mb-16"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Problem Statement</h2>
              <p className="text-base md:text-lg leading-relaxed mb-6">
                The quality of BPMN models at scale is often hindered by several common issues that impact both the usability and reliability of process documentation:
              </p>
              <div className="ml-3.5 mt-8 space-y-6">
                <div className="relative flex items-start pb-4">
                  <div className="bg-border/70 absolute top-[2.75rem] h-[calc(100%-2.75rem)] w-px"></div>
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <FileCode2 className="h-5 w-5 text-destructive" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Inconsistent Syntax & Semantics
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      Violations of BPMN rules and conventions lead to ambiguity and confusion. Models that don{"'"}t adhere to standards become difficult to understand and maintain, reducing their value as documentation.
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start pb-4">
                  <div className="bg-border/70 absolute top-[2.75rem] h-[calc(100%-2.75rem)] w-px"></div>
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <FileCode2 className="h-5 w-5 text-destructive" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Duplicated and Cloned Models
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      Redundant models increase maintenance overhead and create inconsistencies across the organization. When similar processes exist in multiple versions, keeping them synchronized becomes a challenge.
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start pb-4">
                  <div className="bg-border/70 absolute top-[2.75rem] h-[calc(100%-2.75rem)] w-px"></div>
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <FileCode2 className="h-5 w-5 text-destructive" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Model-Text Mismatches
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      Documentation and the BPMN model often diverge over time as changes are made to one but not the other. This discrepancy undermines trust in the documentation.
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start pb-4">
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <FileCode2 className="h-5 w-5 text-destructive" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Lack of Unified Quality Feedback
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      Without consistent validation feedback, the review process slows down and stakeholder trust erodes. Teams need immediate, actionable insights to maintain quality.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="section3"
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-12 md:mb-16"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Solution & Core Functionality</h2>
              <p className="text-base md:text-lg leading-relaxed mb-6">
                BPMN Guard is a hybrid quality-assurance system that combines multiple layers of analysis to provide comprehensive and transparent feedback. The system architecture includes several integrated components working together:
              </p>
              <div className="ml-3.5 mt-8 space-y-6">
                <div className="relative flex items-start pb-4">
                  <div className="bg-border/70 absolute top-[2.75rem] h-[calc(100%-2.75rem)] w-px"></div>
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <Shield className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Rule Catalog
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      Enforces syntactic correctness based on established guidelines like the Seven Process Modeling Guidelines (7PMG) and configurable custom style rules. Ensures all models adhere to organisational standards.
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start pb-4">
                  <div className="bg-border/70 absolute top-[2.75rem] h-[calc(100%-2.75rem)] w-px"></div>
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Formal Analyzer
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      Performs deep checks on the model{"'"}s logic to verify properties like soundness (no deadlocks, proper completion), safeness, and liveness. Ensures the process flow is logically valid.
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start pb-4">
                  <div className="bg-border/70 absolute top-[2.75rem] h-[calc(100%-2.75rem)] w-px"></div>
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <Brain className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      AI Evaluator (LLM)
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      Provides critique and rubric-driven suggestions for improving aspects that aren{"'"}t strictly syntactic, such as naming conventions, label clarity, structural improvements, and documentation consistency.
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start pb-4">
                  <div className="bg-border/70 absolute top-[2.75rem] h-[calc(100%-2.75rem)] w-px"></div>
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <Lightbulb className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Feedback UI & Reporting
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      An interactive interface that presents violations and suggestions to users with explanations of what the issue is, why it matters, and how to fix it. Supports human review and interaction.
                    </p>
                  </div>
                </div>
                <div className="relative flex items-start pb-4">
                  <div className="absolute ml-[-14px] py-2">
                    <div className="bg-muted flex size-8 md:size-9 shrink-0 items-center justify-center rounded-lg">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <div className="pl-12 md:pl-14">
                    <h3 className="mt-2 text-lg md:text-xl font-semibold mb-2">
                      Model Store & Telemetry
                    </h3>
                    <p className="text-base md:text-lg text-muted-foreground leading-relaxed">
                      A repository for versioning models and tracking quality metrics over time. Enables teams to monitor improvement and maintain historical records of process evolution.
                    </p>
                  </div>
                </div>
              </div>
            </section>

            <section
              id="section4"
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-12 md:mb-16"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Quality Checks</h2>
              <p className="text-base md:text-lg leading-relaxed mb-6">
                The system performs two main categories of quality checks to ensure comprehensive model validation:
              </p>

              <div className="my-8">
                <h3 className="text-xl md:text-2xl font-semibold mb-4">Deterministic Checks</h3>
                <div className="my-6 overflow-x-auto">
                  <table className="w-full text-sm md:text-base">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">Check Type</th>
                        <th className="text-left py-3 px-4 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-3 px-4 font-medium">Structural Rules</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          Ensures proper structure (e.g., single start/end event per pool)
                        </td>
                      </tr>
                      <tr className="even:bg-muted border-b">
                        <td className="py-3 px-4 font-medium">Workflow Characteristics</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          Identifies issues like dead paths and unreachable nodes
                        </td>
                      </tr>
                      <tr className="even:bg-muted border-b">
                        <td className="py-3 px-4 font-medium">7PMG Enforcement</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          Validates against Seven Process Modeling Guidelines
                        </td>
                      </tr>
                      <tr className="even:bg-muted border-b">
                        <td className="py-3 px-4 font-medium">BPMN 2.0 Specifications</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          Validates against official BPMN 2.0 standard requirements
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="my-8">
                <h3 className="text-xl md:text-2xl font-semibold mb-4">Linguistic and Semantic Checks</h3>
                <div className="my-6 overflow-x-auto">
                  <table className="w-full text-sm md:text-base">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-3 px-4 font-semibold">Check Type</th>
                        <th className="text-left py-3 px-4 font-semibold">Description</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b">
                        <td className="py-3 px-4 font-medium">Naming Conventions</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          Validates element labels against defined patterns (e.g., Verb + Noun for activities)
                        </td>
                      </tr>
                      <tr className="even:bg-muted border-b">
                        <td className="py-3 px-4 font-medium">Glossary Application</td>
                        <td className="py-3 px-4 text-muted-foreground">
                          Applies domain-specific glossary to ensure consistent terminology
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <Alert className="mt-6">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                <AlertTitle className="text-base md:text-lg font-semibold">
                  Results and Reporting
                </AlertTitle>
                <AlertDescription className="text-sm md:text-base leading-relaxed mt-2">
                  All findings are structured to link violated rules directly to the offending nodes in the model. Results are presented within an interactive BPMN editor and can be exported to formats like PDF and CSV for reporting purposes.
                </AlertDescription>
              </Alert>
            </section>

            <section
              id="section5"
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-12 md:mb-16"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Expected Outcomes & Evaluation</h2>
              <p className="text-base md:text-lg leading-relaxed mb-6">
                The project{"'"}s success will be measured against several key performance metrics to ensure the system delivers real value:
              </p>
              <div className="my-6 overflow-x-auto">
                <table className="w-full text-sm md:text-base">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-3 px-4 font-semibold">Metric</th>
                      <th className="text-left py-3 px-4 font-semibold">Target</th>
                      <th className="text-left py-3 px-4 font-semibold">Purpose</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-3 px-4 font-medium">Quality Detection</td>
                      <td className="py-3 px-4 text-muted-foreground">≥ 85% accuracy</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        Identifying rule violations vs. manual baseline
                      </td>
                    </tr>
                    <tr className="even:bg-muted border-b">
                      <td className="py-3 px-4 font-medium">Model Soundness</td>
                      <td className="py-3 px-4 text-muted-foreground">70% reduction</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        Decrease in unsound models post-validation
                      </td>
                    </tr>
                    <tr className="even:bg-muted border-b">
                      <td className="py-3 px-4 font-medium">Response Time</td>
                      <td className="py-3 px-4 text-muted-foreground">&lt; 2 seconds</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        Analysis results per model
                      </td>
                    </tr>
                    <tr className="even:bg-muted border-b">
                      <td className="py-3 px-4 font-medium">User Trust</td>
                      <td className="py-3 px-4 text-muted-foreground">≥ 4/5 rating</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        Usefulness and clarity of AI feedback
                      </td>
                    </tr>
                    <tr className="even:bg-muted border-b">
                      <td className="py-3 px-4 font-medium">Learning Loop</td>
                      <td className="py-3 px-4 text-muted-foreground">Continuous improvement</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        Rule precision via human-in-the-loop corrections
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
              <blockquote className="border-l-4 border-primary pl-4 md:pl-6 py-2 my-6 italic text-base md:text-lg">
                By combining automated validation with AI-driven insights, BPMN Guard aims to significantly improve process model quality while reducing the time and effort required for manual review.
              </blockquote>
            </section>

            <section
              id="section6"
              className="prose prose-base md:prose-lg dark:prose-invert max-w-none mb-12 md:mb-16"
            >
              <h2 className="text-2xl md:text-3xl font-bold mb-4 md:mb-6">Frequently Asked Questions</h2>

              <Accordion type="single" collapsible className="w-full">
                {faq_items.map((item) => (
                  <AccordionItem key={item.id} value={item.id}>
                    <AccordionTrigger className="text-left text-base md:text-lg font-semibold hover:no-underline">
                      {item.question}
                    </AccordionTrigger>
                    <AccordionContent className="text-muted-foreground text-sm md:text-base leading-relaxed">
                      {item.answer}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
        </article>
      </div>
    </section>
  );
}

"use client";

import { FileCheck, Network, Brain, FileText } from "lucide-react";

export default function Functionality(){
  const features = [
    {
      icon: <FileCheck className="h-6 w-6" />,
      title: "Rule Catalog",
      description:
        "Enforces syntactic correctness based on established guidelines like 7PMG (Seven Process Modeling Guidelines) and configurable custom style rules.",
      items: ["BPMN 2.0 Validation", "7PMG Enforcement", "Custom Style Rules"],
    },
    {
      icon: <Network className="h-6 w-6" />,
      title: "Formal Analyzer",
      description:
        "Performs deeper checks on the model's logic to verify critical properties and identify structural issues.",
      items: ["Soundness Verification", "Deadlock Detection", "Workflow Analysis"],
    },
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI Evaluator",
      description:
        "Provides critique and rubric-driven suggestions for improving aspects beyond strict syntax validation.",
      items: ["Naming Conventions", "Clarity Analysis", "Documentation Consistency"],
    },
    {
      icon: <FileText className="h-6 w-6" />,
      title: "Feedback & Reporting",
      description:
        "Interactive interface that presents violations and actionable suggestions with detailed explanations.",
      items: ["Interactive BPMN Editor", "PDF & CSV Reports", "Version Tracking"],
    },
  ];

  return (
    <section className="py-8 md:py-16 lg:py-24">
      <div className="space-y-4 text-center pb-12">
        <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
          Core Features
        </h2>
        <p className="text-muted-foreground mx-auto max-w-2xl text-lg tracking-tight md:text-xl">
          A hybrid quality-assurance system combining rule-based, formal, and
          AI-driven methods for comprehensive BPMN model evaluation.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-6 md:gap-8 md:grid-cols-2">
        {features.map((feature) => (
          <div
            key={feature.title}
            className="border-border space-y-4 sm:space-y-6 rounded-lg border p-4 sm:p-6 md:p-8 transition-shadow hover:shadow-sm"
          >
            <div className="flex items-center gap-3 sm:gap-4">
              <div className="bg-muted text-primary rounded-full p-3">
                {feature.icon}
              </div>
              <h3 className="text-xl font-semibold">{feature.title}</h3>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              {feature.description}
            </p>
            <div className="space-y-2">
              {feature.items.map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <div className="bg-foreground h-1.5 w-1.5 rounded-full" />
                  <span className="text-sm font-medium">{item}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function Hero(){

  return (
    <section className="py-8 md:py-16 lg:py-24 text-center">
        <div className="mx-auto flex max-w-5xl flex-col gap-6">
          <h1 className="text-3xl font-semibold lg:text-6xl">AI-Assisted Quality Checks for BPMN Models</h1>
          <p className="text-muted-foreground text-balance lg:text-lg">
            Explore our hybrid quality-assurance system that combines rule-based, formal, and
            AI-driven methods to automatically evaluate BPMN models. Our solution provides
            actionable feedback to modelers, helping enforce quality standards and modeling
            conventions while improving clarity and reducing maintenance overhead.
          </p>
        </div>
        <div className="mt-10 flex justify-center gap-4">
          <Button asChild size="lg">
            <Link href="/dashboard">Go to Dashboard</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/about">Learn More</Link>
          </Button>
        </div>
    </section>
  );
};

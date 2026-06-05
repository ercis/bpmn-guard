"use client"
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function Footer() {
  const pathname = usePathname();
  if (pathname.startsWith('/dashboard')) return null;

  const navLinks = [
    { title: "Home", url: "/" },
    { title: "About", url: "/about" },
  ];

  const authLinks = [
    { text: "Login", url: "/auth/login" },
    { text: "Sign Up", url: "/auth/sign-up" },
  ];

  return (
    <section className="py-16 border-t">
      <div className="max-w-7xl mx-auto px-6 lg:px-16">
        <footer>
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            <div>
              <Link href="/" className="flex items-center gap-2 text-lg font-semibold">
                BPMN Guard
              </Link>
              <p className="mt-4 text-sm text-muted-foreground">
                Automated quality checks for BPMN models.
              </p>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Navigation</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {navLinks.map((link) => (
                  <li key={link.title} className="w-fit hover:text-primary">
                    <Link href={link.url}>{link.title}</Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="mb-4 font-semibold">Account</h3>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {authLinks.map((link) => (
                  <li key={link.text} className="w-fit hover:text-primary">
                    <Link href={link.url}>{link.text}</Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
}

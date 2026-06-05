"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from '@/lib/client'
import Link from "next/link";
import { LogOut, UserCircle, Loader2Icon } from "lucide-react";
import { useRouter } from 'next/navigation'
import type { DemoUser as User } from '@/lib/demo'

export default function AuthButtons() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    // Check current session
    const checkUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      setLoading(false);
    };

    checkUser();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.refresh();
    router.push('/auth/login');
  };

  if (loading) {
    return <Loader2Icon
          role="status"
          aria-label="Loading"
          className={"size-4 animate-spin"}
        />;
  }

  // User is authenticated
  if (user) {
    return (
      <>
        {/* Desktop */}
        <div className="hidden lg:flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <UserCircle className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
        {/* Mobile */}
        <div className="flex lg:hidden flex-col gap-3 w-full">
          <Button asChild variant="outline" className="w-full">
            <Link href="/dashboard">
              <UserCircle className="mr-2 h-4 w-4" />
              Dashboard
            </Link>
          </Button>
          <Button
            variant="ghost"
            className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={logout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </div>
      </>
    );
  }

  // User is NOT authenticated
  return (
    <>
      {/* Desktop */}
      <div className="hidden lg:flex gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href="/auth/login">
            Login
          </Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/auth/sign-up">
            Sign Up
          </Link>
        </Button>
      </div>
      {/* Mobile */}
      <div className="flex lg:hidden flex-col gap-3 w-full">
        <Button asChild variant="outline" className="w-full">
          <Link href="/auth/login">
            Login
          </Link>
        </Button>
        <Button asChild className="w-full">
          <Link href="/auth/sign-up">
            Sign Up
          </Link>
        </Button>
      </div>
    </>
  );
}

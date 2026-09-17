"use client";

import { SessionProvider } from "next-auth/react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        {children}
      </div>
    </SessionProvider>
  );
}
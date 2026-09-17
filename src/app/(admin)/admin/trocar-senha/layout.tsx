import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default function TrocarSenhaLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
      {children}
    </div>
  );
}
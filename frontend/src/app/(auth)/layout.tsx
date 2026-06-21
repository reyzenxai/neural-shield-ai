import { Logo } from "@/components/layout/Logo";

/**
 * Centered, glassy layout for authentication pages over the brand grid backdrop.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col">
      <div className="grid-bg pointer-events-none absolute inset-0 -z-10" />
      <header className="mx-auto w-full max-w-6xl px-5 py-6">
        <Logo />
      </header>
      <main className="flex flex-1 items-center justify-center px-5 pb-16">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}

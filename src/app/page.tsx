import { Suspense } from "react";
import { ShieldAlert } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { EmergencyForm } from "@/components/EmergencyForm";

export default function HomePage() {
  return (
    <div className="flex min-h-screen flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <ShieldAlert className="h-7 w-7 text-red-600 sm:h-8 sm:w-8" aria-hidden />
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">
                ResQGo
              </h1>
              <p className="text-xs font-medium text-slate-600 sm:text-sm">
                災害時の位置情報共有・救助要請サービス
              </p>
            </div>
          </div>
          <AuthPanel />
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-3 py-4 sm:px-6 sm:py-6">
        <Suspense fallback={<p className="text-sm text-slate-600">読み込み中…</p>}>
          <EmergencyForm />
        </Suspense>
      </main>
    </div>
  );
}

import { ShieldAlert } from "lucide-react";
import { AuthPanel } from "@/components/AuthPanel";
import { EmergencyForm } from "@/components/EmergencyForm";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-4xl flex-col gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <ShieldAlert className="h-8 w-8 text-red-600" aria-hidden />
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                ResQGo
              </h1>
              <p className="text-sm font-medium text-slate-600">
                災害時の位置情報共有・救助要請サービス
              </p>
            </div>
          </div>
          <AuthPanel />
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-8">
        <p className="mb-6 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
          地図上で現在地を確認し、救助要請の送信または周辺情報の検索ができます。通信が不安定な場合はQRコードによる情報共有をご利用ください。
        </p>
        <EmergencyForm />
      </main>
    </div>
  );
}

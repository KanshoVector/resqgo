"use client";

import { AlertTriangle, Loader2, LogIn, LogOut, UserCircle, UserPlus } from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";

type AuthMode = "login" | "signup";

export function AuthPanel() {
  const { user, role, loading, signIn, signUp, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("login");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const err =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password);
    setSubmitting(false);
    if (err) setError(err);
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" />
        認証状態を確認中…
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 text-sm text-slate-700">
          <UserCircle className="h-5 w-5 text-slate-500" aria-hidden />
          <span>{user.email}</span>
          {role === "shelter_admin" && (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-xs font-bold text-orange-700">
              避難所管理者
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={() => signOut()}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          <LogOut className="h-4 w-4" />
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div
        role="tablist"
        aria-label="認証モード"
        className="grid grid-cols-2 border-b border-slate-200"
      >
        <button
          type="button"
          role="tab"
          aria-selected={mode === "login"}
          onClick={() => {
            setMode("login");
            setError(null);
          }}
          className={`px-4 py-3 text-sm font-bold transition ${
            mode === "login"
              ? "border-b-2 border-indigo-600 bg-indigo-50 text-indigo-700"
              : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          ログイン
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          onClick={() => {
            setMode("signup");
            setError(null);
          }}
          className={`px-4 py-3 text-sm font-bold transition ${
            mode === "signup"
              ? "border-b-2 border-indigo-600 bg-indigo-50 text-indigo-700"
              : "bg-white text-slate-500 hover:bg-slate-50"
          }`}
        >
          新規アカウント作成
        </button>
      </div>

      <div className="p-4 sm:p-5">
        {mode === "login" ? (
          <p className="mb-4 flex items-start gap-2 text-sm text-slate-600">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            登録済みのアカウントでログインすると、周辺の救助要請・避難所情報を閲覧できます。
          </p>
        ) : (
          <p className="mb-4 flex items-start gap-2 text-sm text-slate-600">
            <UserPlus className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
            新規アカウントを作成して、防災情報の閲覧・共有に参加できます。救助要請の投稿は未ログインでも可能です。
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="auth-email" className="mb-1 block text-xs font-semibold text-slate-600">
              メールアドレス
            </label>
            <input
              id="auth-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="example@email.com"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="mb-1 block text-xs font-semibold text-slate-600">
              パスワード
            </label>
            <input
              id="auth-password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6文字以上"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className={`flex w-full items-center justify-center gap-2 rounded-lg px-4 py-3 text-sm font-bold text-white disabled:opacity-50 ${
              mode === "login"
                ? "bg-indigo-600 hover:bg-indigo-500"
                : "bg-indigo-700 hover:bg-indigo-600"
            }`}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : mode === "login" ? (
              <LogIn className="h-4 w-4" />
            ) : (
              <UserPlus className="h-4 w-4" />
            )}
            {mode === "login"
              ? "ログインする"
              : "アカウントを作成して防災に参加する"}
          </button>
        </form>

        {error && (
          <p className="mt-3 text-sm font-semibold text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}

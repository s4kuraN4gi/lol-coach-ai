"use client";

import Link from "next/link";

export default function AuthCodeErrorPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#0a0a0f]">
      <div className="glass-panel p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-slate-800 backdrop-blur-xl text-center">
        <div className="text-4xl mb-4">!</div>
        <h1 className="text-xl font-bold text-white mb-2">Authentication Error</h1>
        <p className="text-slate-400 text-sm mb-6">
          Authentication failed. Please try again.
        </p>
        <Link
          href="/login"
          className="block w-full bg-gradient-to-r from-blue-600 to-cyan-600 text-white font-bold py-3 rounded-lg hover:from-blue-500 hover:to-cyan-500 transition"
        >
          Back to Login
        </Link>
      </div>
    </main>
  );
}

"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";

export default function LoginPage() {
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const payload = Object.fromEntries(new FormData(form).entries());
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (response.ok) {
      window.location.href = "/";
    } else {
      setMessage(result.message ?? "Login failed");
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-slate-50 p-6 text-ink">
      <form onSubmit={submit} className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl border border-amber-200 bg-white p-1 shadow-sm">
            <Image src="/tafga.png" alt="Tamimi Global CAFM logo" width={48} height={48} className="h-full w-full object-contain" priority />
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight text-slate-900">Tamimi Global</h1>
            <p className="text-sm text-slate-500">CAFM system</p>
            <p className="mt-1 text-xs font-bold text-slate-400">Sign in to continue</p>
          </div>
        </div>
        <div className="mt-6 grid gap-3">
          <input name="email" type="email" placeholder="Email" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
          <input name="password" type="password" placeholder="Password" className="h-11 rounded-lg border border-slate-200 px-3 outline-none focus:border-lagoon" />
          <button className="h-11 rounded-lg bg-emerald-600 font-medium text-white transition hover:bg-emerald-700">Login</button>
          {message && <p className="text-sm font-bold text-coral">{message}</p>}
        </div>
      </form>
    </main>
  );
}

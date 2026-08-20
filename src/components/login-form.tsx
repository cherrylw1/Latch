"use client";

import { ArrowRight, LockKey, SpinnerGap } from "@phosphor-icons/react";
import { FormEvent, useState } from "react";

export function LoginForm({ configured }: { configured: boolean }) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!configured) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) throw new Error();
      const target = new URLSearchParams(window.location.search).get("next");
      window.location.assign(target?.startsWith("/") ? target : "/");
    } catch {
      setError("That password does not match.");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="login-shell">
      <section className="login-card" aria-labelledby="login-title">
        <span className="login-mark" aria-hidden="true"><i /><i /></span>
        <p className="login-kicker">Personal relay</p>
        <h1 id="login-title">Open Latch</h1>
        <p className="login-copy">Your notes and files are held behind one private password.</p>
        {configured ? (
          <form onSubmit={submit} className="login-form">
            <label htmlFor="latch-password">Password</label>
            <div className="password-field">
              <LockKey size={18} />
              <input
                id="latch-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter your password"
                autoFocus
                required
              />
            </div>
            {error ? <p className="login-error" role="alert">{error}</p> : null}
            <button type="submit" className="login-submit" disabled={submitting}>
              {submitting ? <SpinnerGap className="spin" size={18} /> : <ArrowRight size={18} weight="bold" />}
              Enter Latch
            </button>
          </form>
        ) : (
          <p className="login-error">Latch is waiting for its password to be configured in Vercel.</p>
        )}
        <p className="login-session">You stay signed in for 30 days of activity.</p>
      </section>
    </main>
  );
}

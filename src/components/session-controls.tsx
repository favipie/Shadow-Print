"use client";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

export function SignIn({ classic }: { classic: boolean }) {
  const [message, setMessage] = useState("");
  const [pending, setPending] = useState(false);
  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fields = new FormData(e.currentTarget);
    setPending(true);
    setMessage("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: fields.get("username"),
          password: fields.get("password"),
        }),
      });
      if (response.ok) {
        window.location.replace(classic ? "/?mode=workspace" : "/");
        return;
      }
      setMessage(
        response.status === 401
          ? "Username or password is incorrect."
          : response.status === 429
            ? "Too many attempts. Try again in a minute."
            : "Sign-in is unavailable. Try again.",
      );
    } catch {
      setMessage("Could not reach the service. Try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <main
      className="screen-stack"
      style={{ maxWidth: 440, margin: "10vh auto", padding: 16 }}
    >
      <form className="panel screen-stack" onSubmit={submit}>
        <h1>Investigator sign-in</h1>
        <label>
          Username
          <input
            name="username"
            autoComplete="username"
            required
            maxLength={32}
          />
        </label>
        <label>
          Password
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            maxLength={256}
          />
        </label>
        <Button disabled={pending}>
          {pending ? "Signing in…" : "Sign in"}
        </Button>
        {message && <p role="alert">{message}</p>}
      </form>
    </main>
  );
}

export function SignOut({ investigator }: { investigator: string }) {
  const [error, setError] = useState(false);
  return (
    <div className="demo-mode-banner">
      {investigator} ·{" "}
      <button
        onClick={async () => {
          try {
            if (!(await fetch("/api/session", { method: "DELETE" })).ok)
              throw new Error();
            window.location.replace("/sign-in");
          } catch {
            setError(true);
          }
        }}
      >
        Sign out
      </button>
      {error && <span role="alert"> Could not sign out. Retry.</span>}
    </div>
  );
}

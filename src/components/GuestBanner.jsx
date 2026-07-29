// src/components/GuestBanner.jsx
//
// The demo's conversion path. While a guest session is active it shows an
// unobtrusive top banner; opening it reveals the "Save your universe" claim
// form, which upgrades the guest account in place (same _id, so the universe
// they've been playing is simply kept). Mounted globally so it follows the
// guest across the dashboard and into gameplay.
import { useState, useContext } from "react";
import { AuthContext } from "../context/AuthContext";
import { claimAccount } from "../api/authApi";
import { useToast } from "./ui/ToastProvider";

export const GuestBanner = () => {
  const { user, login } = useContext(AuthContext);
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ username: "", email: "", password: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (!user?.isGuest) return null;

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const data = await claimAccount(form);
      login(data, data.token); // upgrades the live session to the real account
      toast("Universe saved — welcome aboard, warden.", "success", 6000);
      setOpen(false);
    } catch (err) {
      setError(err.response?.data?.message || "Could not save. Try a different name or email.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {/* Slim always-present banner */}
      <button
        onClick={() => setOpen(true)}
        className="fixed top-2 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-2 rounded-full border border-accent/50 bg-void/85 backdrop-blur-sm px-3.5 py-1 font-mono text-[11px] tracking-wide text-accent hover:border-accent hover:text-ink transition-colors pointer-events-auto"
      >
        <span className="opacity-70">DEMO</span>
        <span className="text-ink-dim">·</span>
        <span>Save your universe ↗</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-void/85 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm bg-void-raised border border-line p-6">
            <div className="mb-1 font-sans text-ink text-lg font-medium">Save your universe</div>
            <p className="mb-5 font-mono text-[11px] leading-relaxed text-ink-faint">
              {"You've been playing as a guest. Create an account to keep this universe — everything you've done carries over, nothing is lost."}
            </p>

            {error && (
              <div className="mb-4 border border-critical/40 bg-critical/5 px-3 py-2 font-mono text-[11px] text-critical">
                {error}
              </div>
            )}

            <form onSubmit={submit} className="space-y-3">
              <input
                autoFocus
                type="text"
                placeholder="Username"
                value={form.username}
                onChange={(e) => setForm({ ...form, username: e.target.value })}
                className="w-full bg-void border border-line focus:border-accent px-3 py-2 font-mono text-[13px] text-ink outline-none transition-colors"
              />
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full bg-void border border-line focus:border-accent px-3 py-2 font-mono text-[13px] text-ink outline-none transition-colors"
              />
              <input
                type="password"
                placeholder="Password (min 6 characters)"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                className="w-full bg-void border border-line focus:border-accent px-3 py-2 font-mono text-[13px] text-ink outline-none transition-colors"
              />

              <div className="flex gap-2 pt-1">
                <button
                  type="submit"
                  disabled={busy}
                  className="flex-1 font-mono text-[12px] tracking-wider uppercase text-void bg-accent hover:bg-accent/90 px-4 py-2.5 transition-colors disabled:opacity-60"
                >
                  {busy ? "Saving…" : "Save universe"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="font-mono text-[12px] tracking-wider uppercase text-ink-dim hover:text-ink border border-line-bright px-4 py-2.5 transition-colors"
                >
                  Later
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

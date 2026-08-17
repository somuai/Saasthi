import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import logoImg from "@/assets/logo.png";
import { Phone, Lock, ArrowRight, Loader2, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

const BASE = window.location.origin;

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequested, setOtpRequested] = useState(false);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; type: "error" | "success" } | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMsg(null);

    if (!otpRequested) {
      if (phone.length < 10) {
        setMsg({ text: "Enter a valid phone number", type: "error" });
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(`${BASE}/api/v1/auth/otp/request/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone }),
        });
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          let detail = "Failed";
          try {
            const body = JSON.parse(text);
            detail = body.detail || body.message || detail;
          } catch {
            detail = text || `Request failed with status ${r.status}`;
          }
          throw new Error(detail);
        }
        const text = await r.text();
        const d = text ? JSON.parse(text) : {};
        setOtpRequested(true);
        if (d.otp) {
          setOtp(String(d.otp));
          setMsg({ text: `Dev OTP Auto-Filled: ${d.otp}`, type: "success" });
        } else {
          setMsg({ text: "OTP sent (check SMS or server logs)", type: "success" });
        }
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : "Failed", type: "error" });
      } finally {
        setLoading(false);
      }
    } else {
      if (otp.length < 4) {
        setMsg({ text: "Enter the OTP", type: "error" });
        return;
      }
      setLoading(true);
      try {
        const r = await fetch(`${BASE}/api/v1/auth/otp/verify/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, otp }),
        });
        if (!r.ok) {
          const text = await r.text().catch(() => "");
          let detail = "Invalid OTP";
          try {
            const body = JSON.parse(text);
            detail = body.detail || body.message || detail;
          } catch {
            detail = text || `Verification failed with status ${r.status}`;
          }
          throw new Error(detail);
        }
        const text = await r.text();
        const d = text ? JSON.parse(text) : {};

        const meRes = await fetch(`${BASE}/api/v1/auth/users/me/`, {
          headers: { Authorization: `Bearer ${d.access}` },
        });
        if (!meRes.ok) {
          const text = await meRes.text().catch(() => "");
          let detail = "Failed to retrieve user profile";
          try {
            const body = JSON.parse(text);
            detail = body.detail || body.message || detail;
          } catch {
            detail = text || `Profile fetch failed with status ${meRes.status}`;
          }
          throw new Error(detail);
        }
        const meText = await meRes.text();
        const me = meText ? JSON.parse(meText) : {};

        const allowedRoles = new Set([
          "admin", "supervisor", "auditor", "referral_partner",
          "state_admin", "district_officer", "block_manager",
        ]);
        if (!allowedRoles.has(me.role)) {
          throw new Error("Access denied. You do not have permission to access this portal.");
        }
        login(d.access, d.refresh, me);
        navigate("/", { replace: true });
      } catch (err) {
        setMsg({ text: err instanceof Error ? err.message : "Verification failed", type: "error" });
      } finally {
        setLoading(false);
      }
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-slate-900 overflow-hidden font-sans p-4">
      {/* Decorative premium background meshes */}
      <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-br from-teal-500/20 to-emerald-500/10 blur-[120px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-teal-700/20 to-blue-500/10 blur-[120px]" />

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl border border-slate-200/50 shadow-2xl rounded-3xl relative z-10 p-2 overflow-hidden animate-fade-in">
        <CardHeader className="text-center pb-4 pt-6">
          <div className="flex justify-center mb-3">
            <div className="p-3 bg-teal-50/50 border border-teal-100/50 rounded-2xl shadow-sm">
              <img src={logoImg} alt="Shaasthi Logo" className="h-10 w-10 object-contain rounded-md" />
            </div>
          </div>
          <CardTitle className="text-xl font-extrabold text-slate-900 tracking-tight">Shaasthi Portal</CardTitle>
          <CardDescription className="text-xs text-slate-500 font-medium mt-1">
            Maternal health management platform
          </CardDescription>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-2">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Phone className="h-3 w-3 text-slate-400" /> Phone Number
              </label>
              <Input
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-inner text-sm h-11"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                maxLength={15}
                disabled={otpRequested}
                autoFocus
              />
            </div>

            {otpRequested && (
              <div className="space-y-1.5 animate-fade-in">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                  <Lock className="h-3 w-3 text-slate-400" /> Enter verification OTP
                </label>
                <Input
                  type="text"
                  placeholder="Verification Code"
                  className="rounded-xl border-slate-200 bg-slate-50/50 focus:bg-white transition-all shadow-inner text-sm h-11 tracking-widest text-center font-bold"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                  autoFocus
                />
              </div>
            )}

            {msg && (
              <div
                className={cn(
                  "text-xs px-3.5 py-2.5 rounded-xl border font-medium flex items-start gap-2",
                  msg.type === "error"
                    ? "bg-rose-50 text-rose-750 border-rose-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-100"
                )}
              >
                <ShieldCheck className={cn("h-4 w-4 shrink-0 mt-0.5", msg.type === "error" ? "text-rose-500" : "text-emerald-500")} />
                <div>{msg.text}</div>
              </div>
            )}

            <Button type="submit" className="w-full bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-xs h-11 shadow-md transition-all flex items-center justify-center gap-1.5" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </>
              ) : otpRequested ? (
                <>
                  Verify OTP & Login <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Request OTP Invite <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

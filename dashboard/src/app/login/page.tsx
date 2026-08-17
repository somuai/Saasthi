"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import Image from "next/image";

export default function LoginPage() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const { loginOtpRequest, verifyOtp } = useAuth();
  const router = useRouter();

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simple validation
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("Please enter a valid phone number.");
      setIsLoading(false);
      return;
    }

    const res = await loginOtpRequest(phoneNumber);
    if (res.success) {
      setStep("otp");
      // If we got a debug OTP (from the log/sms_provider=log fallback), display it (for dev purposes only)
      if (res.debug_otp && process.env.NODE_ENV === "development") {
        console.log("DEBUG OTP:", res.debug_otp);
      }
    } else {
      setError(res.message || "Failed to request OTP. Ensure your number is registered.");
    }
    setIsLoading(false);
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    if (!otp || otp.length < 4) {
      setError("Please enter a valid OTP.");
      setIsLoading(false);
      return;
    }

    const res = await verifyOtp(phoneNumber, otp);
    if (res.success) {
      router.push("/");
    } else {
      setError(res.message || "Invalid OTP. Please try again.");
    }
    setIsLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg border-t-4 border-t-[#416CAF]">
        <CardHeader className="flex flex-col space-y-4 items-center justify-center">
          <Image
            src="/shaasthi-mark.png"
            alt="Shaasthi Logo"
            width={104}
            height={122}
            className="mx-auto rounded-2xl shadow-md object-contain"
            style={{ width: 104, height: 122 }}
            priority
          />
          <div className="text-center">
            <CardTitle className="text-2xl font-bold text-gray-900">Saasthi Admin</CardTitle>
            <CardDescription>
              {step === "phone" ? "Enter your registered phone number to sign in" : "Enter the OTP sent to your phone"}
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent>
          {step === "phone" ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="tel"
                  placeholder="+91 9876543210"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  disabled={isLoading}
                  className="text-lg py-6"
                />
              </div>
              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
              <Button type="submit" className="w-full py-6 text-lg bg-[#416CAF] hover:bg-[#325690]" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send OTP"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div className="space-y-2">
                <Input
                  type="text"
                  placeholder="Enter OTP (e.g. 123456)"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  disabled={isLoading}
                  className="text-lg py-6 tracking-widest text-center"
                  maxLength={6}
                />
              </div>
              {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
              <Button type="submit" className="w-full py-6 text-lg bg-[#416CAF] hover:bg-[#325690]" disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify & Sign In"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setStep("phone");
                  setOtp("");
                  setError("");
                }}
                disabled={isLoading}
              >
                Change Phone Number
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

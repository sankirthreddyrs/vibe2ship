import React, { useState } from "react";
import { Sparkles, Eye, EyeOff } from "lucide-react";
import { apiFetch as fetch } from "../utils/api";

interface SettingsViewProps {
  geminiStatus: "connected" | "disconnected" | "checking" | "expired" | "error" | "limited";
  setGeminiStatus: (status: "connected" | "disconnected" | "checking" | "expired" | "error" | "limited") => void;
  geminiError: string;
  isAutopilotOn: boolean;
  onToggleAutopilot: () => void;
  showToast: (message: string, type: "success" | "info" | "error") => void;
  onResetApp?: () => void;
}

export default function SettingsView({
  geminiStatus,
  setGeminiStatus,
  geminiError,
  isAutopilotOn,
  onToggleAutopilot,
  showToast,
  onResetApp,
}: SettingsViewProps) {
  const [isTesting, setIsTesting] = useState(false);

  const testConnection = async () => {
    setIsTesting(true);
    setGeminiStatus("checking");
    try {
      const res = await fetch("/api/gemini-status");
      if (res.ok) {
        const data = await res.json();
        if (data.status === "connected") {
          setGeminiStatus("connected");
          showToast("Gemini AI Engine Connected ✓", "success");
        } else {
          setGeminiStatus("error");
          showToast("Gemini AI Engine Connection Failed ✗", "error");
        }
      } else {
        setGeminiStatus("error");
        showToast("Gemini AI Engine Connection Failed ✗", "error");
      }
    } catch (err) {
      setGeminiStatus("error");
      showToast("Connection test failed", "error");
    } finally {
      setIsTesting(false);
    }
  };

  const CARD_CLASS = "bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5 shadow-xl transition-all duration-300";

  return (
    <div className="space-y-5 animate-fade-in" id="settings-view-container">
      <div>
        <h2 className="text-[24px] font-bold text-white tracking-tight">System Configuration</h2>
        <p className="text-[14px] text-[#d0d0e8]">Fine-tune Gemini artificial intelligence, schedule auto-pilot vigilance, and configure settings.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5" id="settings-grid">
        {/* Gemini API Status Card (consistent card style!) */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5 shadow-xl space-y-4" id="settings-gemini-card">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-[#a0a0c0]">Gemini AI Engine</h3>
            <button
              onClick={() => testConnection()}
              disabled={isTesting}
              className="text-xs bg-[#0f0f1e] border border-[#2a2a4a] px-3 py-1.5 rounded text-[#a0a0c0] hover:text-white cursor-pointer disabled:opacity-50"
              id="settings-test-connection-btn"
            >
              {isTesting ? "Testing..." : "Test Connection"}
            </button>
          </div>

          <div className="space-y-3 font-mono text-sm text-[#d0d0e8] bg-[#0f0f1e] p-4 border border-[#2a2a4a] rounded-xl">
            <div className="flex justify-between">
              <span>Status</span>
              <span className={`font-bold uppercase ${
                geminiStatus === "connected" ? "text-emerald-400" : geminiStatus === "checking" ? "text-amber-400 animate-pulse" : "text-amber-500"
              }`} id="settings-gemini-status-label">
                {geminiStatus === "connected" ? "CONNECTED" : geminiStatus === "checking" ? "CHECKING..." : "LIMITED MODE"}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Default Model</span>
              <span className="text-white">gemini-1.5-flash</span>
            </div>
          </div>
        </div>

        {/* Auto-Pilot Status Card (consistent card style!) */}
        <div className="bg-[#1a1a2e] border border-[#2a2a4a] rounded-xl p-5 shadow-xl space-y-4" id="settings-autopilot-card">
          <div className="flex items-center justify-between">
            <h3 className="text-[16px] font-semibold text-[#a0a0c0]">Auto-Pilot System</h3>
            <button
              onClick={onToggleAutopilot}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                isAutopilotOn ? "bg-indigo-600 text-white animate-pulse" : "bg-[#0f0f1e] border border-[#2a2a4a] text-slate-400"
              }`}
              id="settings-autopilot-toggle"
            >
              {isAutopilotOn ? "ACTIVE" : "OFFLINE"}
            </button>
          </div>

          <p className="text-[14px] text-[#d0d0e8] leading-relaxed">
            When enabled, DeadlineOS automatically scans your tasks every 30 minutes, escalating risk scores and triggering Cascade Delay warnings.
          </p>

          <div className="space-y-3 font-mono text-sm text-[#d0d0e8] bg-[#0f0f1e] p-4 border border-[#2a2a4a] rounded-xl">
            <div className="flex justify-between">
              <span>Active vigilance</span>
              <span>{isAutopilotOn ? "Enabled" : "Disabled"}</span>
            </div>
            <div className="flex justify-between">
              <span>Pulse Check Frequency</span>
              <span>Every 30 Minutes</span>
            </div>
          </div>
        </div>

        {/* System Reset / Diagnostic Onboarding Card */}
        {onResetApp && (
          <div className="bg-[#1a1a2e] border border-rose-950/40 rounded-xl p-5 shadow-xl space-y-4 md:col-span-2" id="settings-reset-card">
            <div className="flex items-center justify-between">
              <h3 className="text-[16px] font-semibold text-rose-400">Database Diagnostics &amp; Calibration</h3>
              <span className="text-[10px] bg-rose-500/10 text-rose-400 font-bold px-2.5 py-1 rounded-full border border-rose-500/20">Danger Zone</span>
            </div>
            <p className="text-[14px] text-[#d0d0e8] leading-relaxed">
              Clear your local browser database cache, reset your experience points, wipe tasks, and initialize the <strong>DeadlineOS Setup Onboarding Flow</strong>.
            </p>
            <div>
              <button
                onClick={() => {
                  if (confirm("Are you absolutely sure you want to delete all tasks, reset AI calibration, and launch the onboarding flow? This action is irreversible.")) {
                    onResetApp();
                  }
                }}
                className="px-4 py-2.5 bg-rose-950/20 border border-rose-800 hover:bg-rose-900/40 text-rose-300 font-bold text-xs rounded-xl cursor-pointer transition-all animate-pulse"
              >
                Wipe Local State &amp; Launch Onboarding
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

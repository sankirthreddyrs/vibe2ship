import React, { useState, useEffect } from "react";
import { X, Sparkles, CheckCircle, AlertTriangle, RefreshCw, Cpu, ToggleLeft, ShieldAlert } from "lucide-react";
import { apiFetch as fetch } from "../utils/api";

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAutopilotOn: boolean;
  onToggleAutopilot: () => void;
  theme?: string;
}

export default function SettingsModal({
  isOpen,
  onClose,
  isAutopilotOn,
  onToggleAutopilot,
  theme = "dark"
}: SettingsModalProps) {
  const [apiStatus, setApiStatus] = useState<"connected" | "disconnected" | "checking" | "expired" | "error">("checking");
  const [modelName, setModelName] = useState("gemini-1.5-flash");
  const [errorMessage, setErrorMessage] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const isDark = theme === "dark";

  const checkStatus = async () => {
    setIsRefreshing(true);
    setApiStatus("checking");
    try {
      const res = await fetch("/api/gemini-status");
      if (res.ok) {
        const data = await res.json();
        setApiStatus(data.status || "disconnected");
        if (data.model) {
          setModelName(data.model);
        }
        if (data.error) {
          setErrorMessage(data.error);
        } else {
          setErrorMessage("");
        }
      } else {
        setApiStatus("disconnected");
        setErrorMessage("");
      }
    } catch (err) {
      setApiStatus("disconnected");
      setErrorMessage("");
    } finally {
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      checkStatus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in" 
      id="settings-modal-overlay"
    >
      <div 
        className={`w-full max-w-md overflow-hidden border rounded-2xl shadow-2xl flex flex-col transition-colors duration-300 ${
          isDark ? "border-white/5 bg-[#0a0a0c]" : "border-slate-200 bg-white"
        }`}
        id="settings-modal-container"
      >
        {/* Header */}
        <div className={`flex items-center justify-between px-6 py-4 border-b ${
          isDark ? "border-white/5 bg-[#050505]/40" : "border-slate-100 bg-slate-50/50"
        }`}>
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
              <Cpu className="w-4 h-4 text-indigo-500" />
            </div>
            <div>
              <h3 className={`text-sm font-semibold ${isDark ? "text-white" : "text-slate-900"}`}>
                System Settings
              </h3>
              <p className="text-[10px] text-slate-500">AI Engine & Auto-Pilot Hub</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className={`p-1 rounded-lg text-slate-500 transition-colors cursor-pointer ${
              isDark ? "hover:text-white hover:bg-[#050505]" : "hover:text-slate-900 hover:bg-slate-100"
            }`}
            id="close-settings-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Gemini API Status Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                <span className="w-1.5 h-3 bg-indigo-500 rounded-sm"></span>
                Gemini AI Engine
              </h4>
              <button
                onClick={checkStatus}
                disabled={isRefreshing}
                className={`p-1 rounded-lg border transition-all text-xs font-medium cursor-pointer ${
                  isDark
                    ? "bg-[#111114] border-white/5 text-slate-400 hover:text-white"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900"
                }`}
                title="Test API Connection"
                id="test-connection-btn"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin text-indigo-500" : ""}`} />
              </button>
            </div>

            {/* Status Card */}
            <div className={`p-4 rounded-xl border space-y-3.5 ${
              isDark ? "bg-[#111114] border-white/5" : "bg-slate-50 border-slate-200/80"
            }`}>
              {/* API Connection Indicator */}
              <div className="flex items-center justify-between">
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>Connection Status</span>
                <div className="flex items-center gap-1.5">
                  <div className="relative flex h-2.5 w-2.5">
                    {apiStatus === "connected" ? (
                      <>
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </>
                    ) : apiStatus === "checking" ? (
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500 animate-pulse"></span>
                    ) : (
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                    )}
                  </div>
                  <span className={`text-xs font-bold uppercase ${
                    apiStatus === "connected" 
                      ? "text-emerald-500" 
                      : apiStatus === "checking" 
                        ? "text-amber-500 animate-pulse" 
                        : "text-amber-500"
                  }`} id="gemini-api-status-label">
                    {apiStatus === "connected" ? "CONNECTED" : apiStatus === "checking" ? "CHECKING..." : "LIMITED MODE"}
                  </span>
                </div>
              </div>

              {/* Model Name */}
              <div className="flex items-center justify-between border-t pt-3 border-slate-200/40 dark:border-white/5">
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>Active Model</span>
                <span className={`text-xs font-mono font-bold px-2.5 py-1 rounded-md ${
                  isDark ? "bg-[#050505] text-indigo-400 border border-white/5" : "bg-white text-indigo-600 border border-slate-200"
                }`} id="gemini-active-model-label">
                  gemini-1.5-flash
                </span>
              </div>
            </div>
          </div>

          {/* Auto-Pilot Status Section */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
              <span className="w-1.5 h-3 bg-amber-500 rounded-sm"></span>
              Auto-Pilot Engine
            </h4>

            <div className={`p-4 rounded-xl border space-y-3.5 ${
              isDark ? "bg-[#111114] border-white/5" : "bg-slate-50 border-slate-200/80"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <span className={`text-xs block font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>Schedule Vigilance</span>
                  <span className="text-[10px] text-slate-500">AI scans every 30 mins</span>
                </div>
                <button
                  onClick={onToggleAutopilot}
                  className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                    isAutopilotOn ? "bg-indigo-600" : "bg-slate-300 dark:bg-slate-800"
                  }`}
                  id="settings-autopilot-toggle"
                  role="switch"
                  aria-checked={isAutopilotOn}
                >
                  <span
                    aria-hidden="true"
                    className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                      isAutopilotOn ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between border-t pt-3 border-slate-200/40 dark:border-white/5">
                <span className={`text-xs ${isDark ? "text-slate-400" : "text-slate-600"}`}>Interval</span>
                <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-700"}`}>30 Minutes</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-4 border-t flex justify-end gap-3 ${
          isDark ? "border-white/5 bg-[#050505]/20" : "border-slate-100 bg-slate-50/50"
        }`}>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-500 shadow-lg shadow-indigo-600/10 transition-all cursor-pointer"
            id="settings-done-btn"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

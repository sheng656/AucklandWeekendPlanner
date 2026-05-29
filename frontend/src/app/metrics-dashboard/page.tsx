"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Compass, RefreshCw, BarChart2, Activity, ShieldAlert, Cpu, Database, AlertTriangle, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface ModelStat {
  model: string;
  count: number;
  percentage: number;
  avgLatencyMs: number;
}

interface ProviderStat {
  provider: string;
  count: number;
  percentage: number;
}

interface LogError {
  model: string;
  error: string;
  timestamp: string;
}

interface MetricsSummary {
  totalInvocations: number;
  avgLatencyMs: number;
  fallbackRatePercentage: number;
  totalTokensUsed: number;
  avgTokensPerRequest: number;
  modelStats: ModelStat[];
  providerStats: ProviderStat[];
  recentErrors: LogError[];
}

interface RawLog {
  timestamp: string;
  provider: string;
  model: string;
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  fallbackCount: number;
  errorReason?: string;
  ipHash: string;
  endpoint: string;
}

export default function MetricsDashboard() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<{ summary: MetricsSummary; rawLogs: RawLog[] } | null>(null);

  const fetchMetrics = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}/api/v2/metrics`
        : "/api/v2/metrics";

      const response = await fetch(apiUrl);
      if (!response.ok) {
        throw new Error(`Failed to load metrics: ${response.statusText}`);
      }
      const resData = await response.json();
      if (resData.success) {
        setData({
          summary: resData.summary,
          rawLogs: resData.rawLogs
        });
      } else {
        throw new Error(resData.error || "Failed to parse API metrics response");
      }
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
  }, []);

  const spring = { type: "spring" as const, stiffness: 300, damping: 20 };

  return (
    <main className="min-h-screen mesh-bg p-3 md:p-8 font-sans flex flex-col">
      <div className="max-w-5xl mx-auto w-full flex flex-col gap-4 md:gap-6 flex-1">
        
        {/* ===== HEADER ===== */}
        <motion.header
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={spring}
          className="flex justify-between items-center glass-panel p-4 md:p-5 shrink-0"
        >
          <div className="flex items-center gap-3">
            <Link href="/" className="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </Link>
            <div className="flex flex-col">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-5 h-5 text-purple-500" />
                <h1 className="text-lg md:text-2xl font-extrabold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent leading-none">
                  LLM Copilot Analytics
                </h1>
              </div>
              <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 mt-1">
                Real-time operational monitoring dashboard for the multi-LLM resilient chain
              </p>
            </div>
          </div>
          <button
            onClick={fetchMetrics}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
        </motion.header>

        {/* ===== LOADING STATE ===== */}
        {loading && !data && (
          <div className="flex-1 flex flex-col items-center justify-center p-12 glass-panel">
            <div className="w-12 h-12 rounded-full border-4 border-blue-500 border-t-transparent animate-spin mb-4"></div>
            <p className="text-sm font-semibold text-gray-700 dark:text-gray-300">Fetching metrics from Sydney DynamoDB...</p>
          </div>
        )}

        {/* ===== ERROR STATE ===== */}
        {error && (
          <div className="p-6 glass-panel border-red-200 dark:border-red-900/30 bg-red-50/10 flex items-center gap-4">
            <AlertTriangle className="w-12 h-12 text-red-500 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-red-700 dark:text-red-400">Database Fetch Error</h3>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">{error}</p>
              <button
                onClick={fetchMetrics}
                className="mt-3 px-4 py-1.5 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* ===== METRICS CONTENT ===== */}
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col gap-4 md:gap-6"
          >
            {/* 1. AGGREGATED CARDS */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              
              <div className="glass-panel p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start text-blue-500 mb-2">
                  <Database className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total Calls</span>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-white leading-none">
                    {data.summary.totalInvocations}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Last 100 requests</p>
                </div>
              </div>

              <div className="glass-panel p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start text-emerald-500 mb-2">
                  <Activity className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg Latency</span>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-white leading-none">
                    {data.summary.avgLatencyMs}<span className="text-sm font-semibold ml-0.5">ms</span>
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Overall response time</p>
                </div>
              </div>

              <div className="glass-panel p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start text-amber-500 mb-2">
                  <ShieldAlert className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Fallback Rate</span>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-white leading-none">
                    {data.summary.fallbackRatePercentage}%
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Resiliency activation rate</p>
                </div>
              </div>

              <div className="glass-panel p-4 flex flex-col justify-between">
                <div className="flex justify-between items-start text-purple-500 mb-2">
                  <Cpu className="w-5 h-5" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Avg Tokens</span>
                </div>
                <div>
                  <div className="text-2xl md:text-3xl font-extrabold text-gray-800 dark:text-white leading-none">
                    {data.summary.avgTokensPerRequest}
                  </div>
                  <p className="text-[10px] text-gray-400 mt-1">Input & Output tokens</p>
                </div>
              </div>

            </div>

            {/* 2. MODEL DISTRIBUTION & ERRORS BLOCK */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Model Distribution */}
              <div className="glass-panel p-4 md:p-5 md:col-span-2 flex flex-col">
                <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base border-b border-gray-100 dark:border-gray-800 pb-3 mb-4">
                  LLM Model Share & Latency
                </h3>
                
                <div className="flex flex-col gap-4 flex-1">
                  {data.summary.modelStats.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-6">No models logged yet.</p>
                  ) : (
                    data.summary.modelStats.map((stat, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5">
                        <div className="flex justify-between text-xs font-semibold text-gray-700 dark:text-gray-300">
                          <span className="truncate max-w-[70%]">{stat.model}</span>
                          <span>
                            {stat.count} calls ({stat.percentage}%) • Avg: {stat.avgLatencyMs}ms
                          </span>
                        </div>
                        {/* Progress Bar */}
                        <div className="w-full h-2 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              stat.model.includes("lite") 
                                ? "bg-gradient-to-r from-blue-400 to-cyan-400" 
                                : stat.model.includes("flash")
                                ? "bg-gradient-to-r from-indigo-500 to-blue-500"
                                : "bg-gradient-to-r from-purple-500 to-pink-500"
                            }`}
                            style={{ width: `${stat.percentage}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Provider Distribution */}
              <div className="glass-panel p-4 md:p-5 flex flex-col">
                <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base border-b border-gray-100 dark:border-gray-800 pb-3 mb-4">
                  Provider Distribution
                </h3>
                <div className="flex flex-col gap-4 flex-1 justify-center">
                  {data.summary.providerStats.length === 0 ? (
                    <p className="text-xs text-gray-500 text-center py-4">No provider details available.</p>
                  ) : (
                    data.summary.providerStats.map((stat, idx) => (
                      <div key={idx} className="flex flex-col gap-2">
                        <div className="flex justify-between text-xs font-bold text-gray-700 dark:text-gray-300">
                          <span>{stat.provider === "GoogleAIStudio" ? "⚡ Google AI Studio" : "🧠 AWS Bedrock"}</span>
                          <span>{stat.percentage}%</span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${
                              stat.provider === "GoogleAIStudio" 
                                ? "bg-blue-500" 
                                : "bg-purple-600"
                            }`}
                            style={{ width: `${stat.percentage}%` }}
                          ></div>
                        </div>
                        <p className="text-[10px] text-gray-400">{stat.count} requests dispatched</p>
                      </div>
                    ))
                  )}
                </div>
              </div>

            </div>

            {/* 3. RECENT ERROR LOGS */}
            <div className="glass-panel p-4 md:p-5">
              <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base border-b border-gray-100 dark:border-gray-800 pb-3 mb-3 flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-red-500" />
                <span>Recent Error Logs (Fallback Chain Incidents)</span>
              </h3>
              
              {data.summary.recentErrors.length === 0 ? (
                <div className="text-center py-6 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  ✓ 100% Correct Executions - No backend fallback incidents logged in the query window.
                </div>
              ) : (
                <div className="flex flex-col gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {data.summary.recentErrors.map((err, idx) => (
                    <div key={idx} className="p-3 rounded-lg border border-red-100 dark:border-red-900/20 bg-red-50/5 dark:bg-red-900/5 text-xs">
                      <div className="flex justify-between font-bold text-red-700 dark:text-red-400 mb-1">
                        <span>Incident on Model: {err.model}</span>
                        <span>{new Date(err.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <p className="text-gray-600 dark:text-gray-300 font-mono break-all">{err.error}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. RAW TRANSACTION LOGS */}
            <div className="glass-panel p-4 md:p-5 flex flex-col">
              <h3 className="font-bold text-gray-800 dark:text-white text-sm md:text-base border-b border-gray-100 dark:border-gray-800 pb-3 mb-3">
                Raw Transaction Logs (Last 50 Requests)
              </h3>
              
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-800 text-gray-400 font-bold uppercase text-[9px] tracking-wider">
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3">Model</th>
                      <th className="py-2.5 px-3">Latency</th>
                      <th className="py-2.5 px-3">Tokens</th>
                      <th className="py-2.5 px-3">Fallbacks</th>
                      <th className="py-2.5 px-3">IP Hash (GDPR)</th>
                      <th className="py-2.5 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rawLogs.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-6 text-gray-500">No raw logs stored in DynamoDB yet.</td>
                      </tr>
                    ) : (
                      data.rawLogs.map((log, idx) => (
                        <tr 
                          key={idx} 
                          className="border-b border-gray-100 dark:border-gray-800/50 hover:bg-black/2 dark:hover:bg-white/2 transition-colors font-medium text-gray-700 dark:text-gray-300"
                        >
                          <td className="py-2.5 px-3 font-mono whitespace-nowrap text-gray-400">
                            {new Date(log.timestamp).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              second: "2-digit"
                            })}
                          </td>
                          <td className="py-2.5 px-3 font-bold truncate max-w-[200px]">
                            {log.model}
                            <span className="block text-[9px] font-medium text-gray-400">{log.provider}</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-gray-900 dark:text-white">
                            {log.latencyMs}ms
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-400">
                            in: {log.inputTokens} / out: {log.outputTokens}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {log.fallbackCount > 0 ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-500 font-bold font-mono">
                                {log.fallbackCount}
                              </span>
                            ) : (
                              <span className="text-gray-400 font-mono">0</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-gray-400">{log.ipHash}</td>
                          <td className="py-2.5 px-3">
                            {log.errorReason ? (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-red-500/10 text-red-500 font-bold uppercase text-[9px]">
                                Fail
                              </span>
                            ) : (
                              <span className="inline-block px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-bold uppercase text-[9px]">
                                Success
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </motion.div>
        )}

      </div>
    </main>
  );
}

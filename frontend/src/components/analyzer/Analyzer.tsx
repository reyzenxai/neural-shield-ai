"use client";

import { useState } from "react";
import { analyzeMessage } from "@/services/services/analyze";

export default function Analyzer() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
  scamProbability: number;
  trustScore: number;
  riskLevel: string;
  scamType: string;
  redFlags: string[];
  explanation: string;
  recommendation: string;
} | null>(null);

  const handleAnalyze = async () => {
    if (!message.trim()) return;

    try {
      setLoading(true);

      const data = await analyzeMessage(message);

      setResult(data);
    } catch (error) {
      console.error("Analysis failed:", error);
      alert("Failed to analyze message");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto mt-16">
      <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-3 shadow-2xl">
        <div className="rounded-2xl bg-[#10141c] p-6">
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Paste a WhatsApp message, SMS, email, job offer, or suspicious URL..."
            className="w-full min-h-[220px] bg-transparent outline-none resize-none text-white placeholder:text-gray-500"
          />

          <div className="border-t border-white/10 mt-4 pt-4 flex justify-between items-center">
            <span className="text-sm text-gray-500">
              {message.length} characters
            </span>

            <button
              onClick={handleAnalyze}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-500 transition px-6 py-3 rounded-xl font-semibold disabled:opacity-50"
            >
              {loading ? "Analyzing..." : "Run Neural Shield"}
            </button>
          </div>
        </div>
      </div>

      {result && (
        <div className="mt-8 rounded-2xl border border-white/10 bg-[#10141c] p-6">
          <h2 className="text-2xl font-bold mb-4">
            Analysis Result
          </h2>

          <div className="space-y-2">
            <p>
              <strong>Scam Probability:</strong>{" "}
              {result.scamProbability}%
            </p>

            <p>
              <strong>Trust Score:</strong>{" "}
              {result.trustScore}%
            </p>

            <p>
              <strong>Risk Level:</strong>{" "}
              {result.riskLevel}
            </p>

            <p>
              <strong>Scam Type:</strong>{" "}
              {result.scamType}
            </p>

            <div>
              <strong>Red Flags:</strong>
              <ul className="list-disc pl-6 mt-2">
                {result.redFlags?.map(
                  (flag: string, index: number) => (
                    <li key={index}>{flag}</li>
                  )
                )}
              </ul>
            </div>

            <p>
              <strong>Explanation:</strong>{" "}
              {result.explanation}
            </p>

            <p>
              <strong>Recommendation:</strong>{" "}
              {result.recommendation}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
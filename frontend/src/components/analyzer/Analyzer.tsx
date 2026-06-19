"use client";

import { useState } from "react";

export default function Analyzer() {
  const [message, setMessage] = useState("");

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
              className="bg-blue-600 hover:bg-blue-500 transition px-6 py-3 rounded-xl font-semibold"
            >
              Run Neural Shield
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
import React, { useEffect, useState } from "react";
import { getToken } from "../../storage/auth";
import { API_BASE } from "../../config/api";
import { AlertTriangle, Shield, CheckCircle } from "lucide-react";

const FraudDetection = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFraudFlags();
  }, []);

  const fetchFraudFlags = async () => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/api/admin/fraud-flags`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setFlags(data.activeFlags || []);
      }
    } catch (err) {
      console.error("Failed to fetch fraud flags:", err);
    } finally {
      setLoading(false);
    }
  };

  const resolveFlag = async (flagId) => {
    // Anomaly flags (generated in real-time) can be dismissed locally
    if (
      flagId.startsWith("large_tx_") ||
      flagId.startsWith("rapid_tx_") ||
      flagId.startsWith("ai_fail_")
    ) {
      setFlags((prev) => prev.filter((f) => f._id !== flagId));
      return;
    }
    const token = getToken();
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/issues/${flagId}/resolve`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ notes: "Investigated and resolved" }),
        },
      );
      if (res.ok) {
        fetchFraudFlags();
      }
    } catch (err) {
      console.error("Failed to resolve flag:", err);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Fraud Detection
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Monitor and manage security alerts and suspicious activity
        </p>
      </div>

      {flags.length === 0 ? (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-8 text-center">
          <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-green-900 dark:text-green-100 mb-2">
            No Active Fraud Flags
          </h3>
          <p className="text-green-700 dark:text-green-300">
            Your system is secure. No suspicious activity detected.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {flags.map((flag) => (
            <div
              key={flag._id}
              className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 border-l-4 border-red-500"
            >
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-lg">
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2 capitalize">
                      {flag.suspiciousActivityType.replace(/_/g, " ")}
                    </h3>
                    <div className="space-y-1 mb-4">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Severity:</span>{" "}
                        <span
                          className={`px-2 py-1 rounded text-xs font-semibold ${
                            flag.severity === "critical"
                              ? "bg-red-100 text-red-800"
                              : flag.severity === "high"
                                ? "bg-orange-100 text-orange-800"
                                : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {flag.severity}
                        </span>
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Flagged IPs:</span>{" "}
                        {flag.flaggedIpAddresses?.length || 0}
                      </p>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Detected:</span>{" "}
                        {new Date(flag.timestamp).toLocaleString()}
                      </p>
                      {flag.notes && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Notes:</span>{" "}
                          {flag.notes}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => resolveFlag(flag._id)}
                  className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
                >
                  Resolve
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FraudDetection;

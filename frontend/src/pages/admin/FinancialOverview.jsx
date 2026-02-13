import React, { useEffect, useState } from "react";
import { getToken } from "../../storage/auth";
import { API_BASE } from "../../config/api";
import { DollarSign, TrendingUp, Activity, BarChart3 } from "lucide-react";

const FinancialOverview = () => {
  const [data, setData] = useState(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFinancialData();
  }, [timeRange]);

  const fetchFinancialData = async () => {
    const token = getToken();
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/financial/overview?timeRange=${timeRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch (err) {
      console.error("Failed to fetch financial data:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Financial Overview
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Aggregated transaction metrics (counts only)
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Activity className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Transactions
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {(data?.overview?.sales || 0) + (data?.overview?.expenses || 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Sales Count
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.overview?.sales || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <DollarSign className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Purchases Count
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.overview?.expenses || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
              <BarChart3 className="h-6 w-6 text-orange-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active Users
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {data?.overview?.activeUsers || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Trends */}
      {data?.dailyVolume?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction Trends (Daily)
          </h3>
          <div className="space-y-3">
            {(() => {
              // Group dailyVolume by date
              const byDate = {};
              data.dailyVolume.forEach((d) => {
                byDate[d.date] = (byDate[d.date] || 0) + d.count;
              });
              const entries = Object.entries(byDate).sort(([a], [b]) =>
                a.localeCompare(b),
              );
              const maxCount = Math.max(...entries.map(([, c]) => c), 1);
              return entries.map(([date, count], idx) => (
                <div key={idx} className="flex items-center gap-4">
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-32">
                    {date}
                  </span>
                  <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-6">
                    <div
                      className="bg-blue-600 h-6 rounded-full flex items-center justify-end px-2"
                      style={{
                        width: `${Math.min((count / maxCount) * 100, 100)}%`,
                      }}
                    >
                      <span className="text-xs text-white font-semibold">
                        {count}
                      </span>
                    </div>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}

      {/* Type Breakdown */}
      {data?.dailyVolume?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction Types
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(() => {
              // Group dailyVolume by type
              const byType = {};
              data.dailyVolume.forEach((d) => {
                byType[d.type] = (byType[d.type] || 0) + d.count;
              });
              return Object.entries(byType).map(([type, count], idx) => (
                <div
                  key={idx}
                  className="border border-gray-200 dark:border-slate-700 rounded-lg p-4"
                >
                  <p className="text-sm text-gray-600 dark:text-gray-400 capitalize mb-1">
                    {type}
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {count}
                  </p>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancialOverview;

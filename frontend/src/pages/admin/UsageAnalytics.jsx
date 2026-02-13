import React, { useEffect, useState } from "react";
import { getToken } from "../../storage/auth";
import { API_BASE } from "../../config/api";
import {
  TrendingUp,
  Users,
  Activity,
  BarChart3,
  MessageSquare,
  Bot,
} from "lucide-react";

const UsageAnalytics = () => {
  const [analytics, setAnalytics] = useState(null);
  const [timeRange, setTimeRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    const token = getToken();
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/admin/usage/analytics?timeRange=${timeRange}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setAnalytics(data);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
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
            Usage Analytics
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            User engagement and retention metrics
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

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-8">
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Users
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.overview?.totalUsers || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Activity className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active Users
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.overview?.activeUsers || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Active %
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.overview?.activePercentage || 0}%
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
              <MessageSquare className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Chat Messages
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.overview?.totalChatMessages || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-100 dark:bg-amber-900/20 rounded-lg">
              <Bot className="h-6 w-6 text-amber-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                AI Requests
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics?.overview?.totalAIRequests || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Daily Active Users Chart */}
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Daily Active Users
        </h3>
        <div className="space-y-2">
          {analytics?.dailyActiveUsers?.map((day, idx) => (
            <div key={idx} className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400 w-32">
                {day.date}
              </span>
              <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-4">
                <div
                  className="bg-blue-600 h-4 rounded-full"
                  style={{
                    width: `${(day.count / analytics.overview.totalUsers) * 100}%`,
                  }}
                ></div>
              </div>
              <span className="text-sm font-semibold text-gray-900 dark:text-white w-12 text-right">
                {day.count}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Transaction Activity */}
      {analytics?.transactions?.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Transaction Activity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {analytics.transactions.map((tx, idx) => (
              <div
                key={idx}
                className="border border-gray-200 dark:border-slate-700 rounded-lg p-4"
              >
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                  {tx._id}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">
                  {tx.count} transactions
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UsageAnalytics;

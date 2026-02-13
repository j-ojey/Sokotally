import React, { useEffect, useState } from "react";
import { getToken } from "../../storage/auth";
import { API_BASE } from "../../config/api";
import { Bot, Zap, TrendingUp, Users } from "lucide-react";

const AIMonitoring = () => {
  const [stats, setStats] = useState(null);
  const [userStats, setUserStats] = useState([]);
  const [timeRange, setTimeRange] = useState("30d");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAIStats();
  }, [timeRange]);

  const fetchAIStats = async () => {
    const token = getToken();
    setLoading(true);
    try {
      const [statsRes, userRes] = await Promise.all([
        fetch(`${API_BASE}/api/admin/ai/stats?timeRange=${timeRange}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(
          `${API_BASE}/api/admin/ai/by-user?limit=10&timeRange=${timeRange}`,
          {
            headers: { Authorization: `Bearer ${token}` },
          },
        ),
      ]);

      if (statsRes.ok) {
        const data = await statsRes.json();
        setStats(data);
      }
      if (userRes.ok) {
        const data = await userRes.json();
        setUserStats(data.users || []);
      }
    } catch (err) {
      console.error("Failed to fetch AI stats:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            AI Usage Monitoring
          </h2>
          <p className="text-gray-600 dark:text-gray-400">
            Track AI interactions, token consumption, and performance metrics
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-4 py-2 border border-gray-300 dark:border-white/5 focus:border-blue-400/40 rounded-lg bg-white dark:bg-[#0f172a]/70 text-gray-900 dark:text-white transition-colors"
        >
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="90d">Last 90 Days</option>
        </select>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 hover:border-blue-400/40 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-lg">
              <Bot className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Requests
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.overview?.totalRequests || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 hover:border-blue-400/40 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 rounded-lg">
              <Zap className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Tokens
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.overview?.totalTokens?.toLocaleString() || 0}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 hover:border-blue-400/40 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400 rounded-lg">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Avg Response Time
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.overview?.avgResponseTime || 0}ms
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 hover:border-blue-400/40 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400 rounded-lg">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Success Rate
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats?.overview?.successRate || 0}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Failed Requests
          </p>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">
            {stats?.overview?.failedRequests || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Active AI Users
          </p>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {stats?.overview?.activeUsers || 0}
          </p>
        </div>
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 shadow p-6">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
            Max Tokens (Single Request)
          </p>
          <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {stats?.overview?.maxTokens?.toLocaleString() || 0}
          </p>
        </div>
      </div>

      {/* Daily Usage Chart */}
      {stats?.dailyUsage?.length > 0 && (
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Daily Token Usage
          </h3>
          <div className="space-y-3">
            {stats.dailyUsage.map((day, idx) => (
              <div key={idx} className="flex items-center gap-4">
                <span className="text-sm text-gray-600 dark:text-gray-400 w-32">
                  {day.date}
                </span>
                <div className="flex-1 bg-gray-200 dark:bg-slate-700 rounded-full h-6">
                  <div
                    className="bg-blue-600 h-6 rounded-full flex items-center justify-end px-2"
                    style={{
                      width: `${Math.min((day.tokens / Math.max(...stats.dailyUsage.map((d) => d.tokens))) * 100, 100)}%`,
                    }}
                  >
                    <span className="text-xs text-white font-semibold">
                      {day.tokens.toLocaleString()}
                    </span>
                  </div>
                </div>
                <span className="text-sm text-gray-600 dark:text-gray-400 w-24 text-right">
                  {day.requests} req
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Top Users */}
      {userStats.length > 0 && (
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 shadow p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Top AI Users
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 dark:border-white/5">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    User
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Requests
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Tokens
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Avg Time
                  </th>
                  <th className="text-right py-3 px-4 text-sm font-semibold text-gray-900 dark:text-white">
                    Success Rate
                  </th>
                </tr>
              </thead>
              <tbody>
                {userStats.map((stat, idx) => (
                  <tr
                    key={idx}
                    className="border-b border-gray-100 dark:border-white/5 hover:bg-blue-500/5 transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white">
                      {stat.user?.name || "Unknown User"}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                      {stat.totalRequests}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                      {stat.totalTokens.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                      {stat.avgResponseTime}ms
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-900 dark:text-white text-right">
                      {stat.successRate}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Message Type Breakdown */}
      {stats?.byType?.length > 0 && (
        <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Usage by Message Type
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.byType.map((type, idx) => (
              <div
                key={idx}
                className="border border-gray-200 dark:border-white/5 rounded-lg p-4 hover:border-blue-400/40 transition-colors"
              >
                <p className="text-sm text-gray-600 dark:text-gray-400 capitalize mb-1">
                  {type._id || "Unknown"}
                </p>
                <p className="text-xl font-bold text-gray-900 dark:text-white mb-1">
                  {type.count} requests
                </p>
                <p className="text-sm text-blue-600 dark:text-blue-400">
                  Avg: {Math.round(type.avgTokens || 0)} tokens
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {Math.round(type.avgResponseTime || 0)}ms response
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default AIMonitoring;

import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { getToken } from "../storage/auth";
import { API_BASE } from "../config/api";

const Dashboard = () => {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [stockStats, setStockStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const [dashboardRes, stockRes] = await Promise.all([
          fetch(`${API_BASE}/api/transactions/stats/dashboard`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          fetch(`${API_BASE}/api/inventory/stats`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);

        if (dashboardRes.ok) {
          const dashboardData = await dashboardRes.json();
          setData(dashboardData);
        } else {
          console.error("Dashboard fetch failed:", await dashboardRes.text());
        }

        if (stockRes.ok) {
          const stockData = await stockRes.json();
          setStockStats(stockData);
        } else {
          console.error("Stock stats fetch failed:", await stockRes.text());
          // Set default empty stats if fetch fails
          setStockStats({ totalValue: 0, lowStockCount: 0 });
        }
      } catch (error) {
        console.error("Failed to fetch dashboard data:", error);
        setStockStats({ totalValue: 0, lowStockCount: 0 });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30000);

    return () => clearInterval(interval);
  }, []);

  const stats = {
    sales: data?.sales || 0,
    expenses: data?.expenses || 0,
    profit: data?.profit || 0,
    debt: data?.debts?.outstandingTotal || 0,
  };

  const recent = data?.recentTransactions?.slice(0, 8) || [];
  const topItems = data?.topItems?.slice(0, 5) || [];
  const leastItems = data?.leastItems?.slice(0, 5) || [];

  const now = new Date();
  const currentDate = now.toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white">
            Welcome back, {user?.name || "User"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base mt-2">
            {currentDate}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-900 dark:border-white border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6">
              {[
                {
                  label: "Total Sales",
                  value: stats.sales,
                  symbol: "↑",
                  color: "text-green-600 dark:text-green-400",
                  bg: "bg-green-50 dark:bg-green-900/20",
                },
                {
                  label: "Total Expenses",
                  value: stats.expenses,
                  symbol: "↓",
                  color: "text-red-600 dark:text-red-400",
                  bg: "bg-red-50 dark:bg-red-900/20",
                },
                {
                  label: "Net Profit",
                  value: stats.profit,
                  symbol: "■",
                  color: "text-blue-600 dark:text-blue-400",
                  bg: "bg-blue-50 dark:bg-blue-900/20",
                },
                {
                  label: "Outstanding Debts",
                  value: stats.debt,
                  symbol: "◆",
                  color: "text-orange-600 dark:text-orange-400",
                  bg: "bg-orange-50 dark:bg-orange-900/20",
                },
                {
                  label: "Stock Value",
                  value: stockStats?.totalValue || 0,
                  symbol: "■",
                  color: "text-purple-600 dark:text-purple-400",
                  bg: "bg-purple-50 dark:bg-purple-900/20",
                  link: "/stock",
                },
              ].map((stat, index) =>
                stat.link ? (
                  <Link
                    key={index}
                    to={stat.link}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
                        {stat.label}
                      </p>
                      <div
                        className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}
                      >
                        <span className={`text-2xl ${stat.color}`}>
                          {stat.symbol}
                        </span>
                      </div>
                    </div>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                      KSh {stat.value.toLocaleString()}
                    </p>
                    {stockStats &&
                      stockStats.lowStockCount > 0 &&
                      stat.label === "Stock Value" && (
                        <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                          {stockStats.lowStockCount} items low stock
                        </p>
                      )}
                  </Link>
                ) : (
                  <div
                    key={index}
                    className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400 uppercase tracking-wide font-medium">
                        {stat.label}
                      </p>
                      <div
                        className={`w-10 h-10 ${stat.bg} rounded-lg flex items-center justify-center`}
                      >
                        <span className={`text-2xl ${stat.color}`}>
                          {stat.symbol}
                        </span>
                      </div>
                    </div>
                    <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                      KSh {stat.value.toLocaleString()}
                    </p>
                  </div>
                ),
              )}
            </div>

            {/* Two Column Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              {/* Recent Transactions - Takes 2 columns */}
              <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50 flex items-center justify-between">
                  <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
                    Recent Activity
                  </h2>
                  <Link
                    to="/record"
                    className="text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white flex items-center gap-1"
                  >
                    View All
                    <svg
                      className="w-3.5 h-3.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
                <div className="p-4">
                  {recent.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <svg
                          className="w-6 h-6 text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm font-medium">
                        No transactions yet
                      </p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-slate-800">
                      {recent.map((t, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0"
                        >
                          <div className="flex items-center gap-2.5 flex-1 min-w-0">
                            <div
                              className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${
                                t.type === "income"
                                  ? "bg-green-100 dark:bg-green-900/30"
                                  : "bg-red-100 dark:bg-red-900/30"
                              }`}
                            >
                              {t.type === "income" ? (
                                <svg
                                  className="w-3.5 h-3.5 text-green-600 dark:text-green-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 4v16m8-8H4"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-3.5 h-3.5 text-red-600 dark:text-red-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M20 12H4"
                                  />
                                </svg>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {t.items?.map((item) => item.name).join(", ") ||
                                  t.notes ||
                                  (t.type === "debt" ? "Loan" : t.type)}
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500">
                                {new Date(t.occurredAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <span
                            className={`text-sm font-semibold ml-3 ${
                              t.type === "income"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {t.type === "income" ? "+" : "-"}KSh{" "}
                            {t.amount.toLocaleString()}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* Top & Least Selling Items - stacked in same column */}
              <div className="space-y-6">
                {/* Top Selling Items */}
                <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                    <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Top Products
                    </h2>
                  </div>
                  <div className="p-6">
                    {!topItems || topItems.length === 0 ? (
                      <div className="text-center py-16">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg
                            className="w-8 h-8 text-gray-500 dark:text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                          No sales data yet
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {topItems.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 last:border-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-slate-800/30 p-2 rounded-lg transition-colors -mx-2"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {item.quantity} units sold
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400 ml-3">
                              KSh {item.revenue?.toLocaleString() || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* Least Selling Items */}
                {leastItems.length > 0 && (
                  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                    <div className="px-6 py-5 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                      <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Least Selling Products
                      </h2>
                    </div>
                    <div className="p-6">
                      <div className="space-y-4">
                        {leastItems.map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center justify-between pb-4 border-b border-gray-100 dark:border-slate-800 last:border-0 last:pb-0 hover:bg-gray-50 dark:hover:bg-slate-800/30 p-2 rounded-lg transition-colors -mx-2"
                          >
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <div className="w-8 h-8 bg-orange-500 dark:bg-orange-600 rounded-lg flex items-center justify-center text-white text-sm font-semibold shadow-sm">
                                {i + 1}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 dark:text-white truncate">
                                  {item.name}
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                  {item.quantity} units sold
                                </p>
                              </div>
                            </div>
                            <span className="text-sm font-semibold text-orange-600 dark:text-orange-400 ml-3">
                              KSh {item.revenue?.toLocaleString() || 0}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Quick Actions
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  {
                    label: "Record Sale",
                    path: "/record",
                  },
                  {
                    label: "Add Expense",
                    path: "/record",
                  },
                  {
                    label: "Manage Stock",
                    path: "/stock",
                  },
                  {
                    label: "View Debts",
                    path: "/debts",
                  },
                  {
                    label: "View Reports",
                    path: "/report",
                  },
                  {
                    label: "AI Assistant",
                    path: "/assistant",
                  },
                ].map((action, index) => (
                  <Link
                    key={index}
                    to={action.path}
                    className="bg-white dark:bg-slate-900 text-gray-900 dark:text-white rounded-lg p-4 text-center border border-gray-200 dark:border-slate-800 hover:bg-gray-50 dark:hover:bg-slate-800 transition"
                  >
                    <p className="text-sm font-semibold">{action.label}</p>
                  </Link>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Dashboard;

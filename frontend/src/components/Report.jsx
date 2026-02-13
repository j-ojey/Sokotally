import React, { useState, useEffect, useMemo, useCallback } from "react";
import { getToken } from "../storage/auth";
import { API_BASE } from "../config/api";
import { formatCurrency } from "../utils/formatters";

const Report = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [topItems, setTopItems] = useState([]);
  const [topItemsDisplayCount, setTopItemsDisplayCount] = useState(5);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // Pagination states
  const [transactionsPage, setTransactionsPage] = useState(1);
  const [transactions, setTransactions] = useState([]);
  const [hasMoreTransactions, setHasMoreTransactions] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  const [customersPage, setCustomersPage] = useState(1);
  const [customers, setCustomers] = useState([]);
  const [hasMoreCustomers, setHasMoreCustomers] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);

  const [inventory, setInventory] = useState([]);
  const [inventoryStats, setInventoryStats] = useState(null);

  const [debts, setDebts] = useState({ given: [], owed: [] });
  const ITEMS_PER_PAGE = 10;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      let url = `${API_BASE}/api/transactions/stats/report?period=${period}`;
      if (period === "month" && selectedMonth) {
        url += `&startDate=${selectedMonth}-01`;
      }

      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const reportData = await res.json();
        setData(reportData);
      }
    } catch (err) {
      console.error("Failed to fetch report:", err);
    } finally {
      setLoading(false);
    }
  }, [period, selectedMonth]);

  const fetchAnalytics = useCallback(async () => {
    console.log("[fetchAnalytics] Starting...");
    setAnalyticsLoading(true);
    const token = getToken();
    if (!token) {
      console.log("[fetchAnalytics] No token found");
      setAnalyticsLoading(false);
      return;
    }

    try {
      // Fetch top selling items
      const topRes = await fetch(
        `${API_BASE}/api/transactions/analytics/top-items?limit=10&period=${period}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (topRes.ok) {
        const topData = await topRes.json();
        setTopItems(topData.items || []);
      }

      // Fetch inventory stats
      const inventoryRes = await fetch(`${API_BASE}/api/inventory`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (inventoryRes.ok) {
        const invData = await inventoryRes.json();
        setInventory(invData.inventory || []);
        setInventoryStats(invData.summary || null);
      }

      // Fetch outstanding debts
      console.log(
        "[fetchAnalytics] Fetching debts from:",
        `${API_BASE}/api/transactions/debts?limit=20`,
      );
      const debtsRes = await fetch(
        `${API_BASE}/api/transactions/debts?limit=20`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      console.log("[fetchAnalytics] Debts response status:", debtsRes.status);
      if (debtsRes.ok) {
        const debtsData = await debtsRes.json();
        console.log("Fetched debts:", debtsData);
        setDebts({
          given: debtsData || [],
          owed: [],
        });
      } else {
        const errorText = await debtsRes.text();
        console.log("[fetchAnalytics] Debts response not ok:", errorText);
      }
    } catch (err) {
      console.error("Failed to fetch analytics:", err);
    } finally {
      setAnalyticsLoading(false);
    }
  }, [period]);

  const fetchTransactions = useCallback(
    async (page = 1, append = false) => {
      setTransactionsLoading(true);
      const token = getToken();
      if (!token) {
        setTransactionsLoading(false);
        return;
      }

      try {
        let url = `${API_BASE}/api/transactions?limit=${ITEMS_PER_PAGE}&page=${page}`;
        if (period === "month" && selectedMonth) {
          const [y, m] = selectedMonth.split("-");
          const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
          url += `&from=${selectedMonth}-01&to=${selectedMonth}-${lastDay}`;
        }

        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` },
        });

        if (res.ok) {
          const txData = await res.json();

          if (append) {
            setTransactions((prev) => [...prev, ...txData]);
          } else {
            setTransactions(txData);
          }

          setHasMoreTransactions(txData.length === ITEMS_PER_PAGE);
        }
      } catch (err) {
        console.error("Failed to fetch transactions:", err);
      } finally {
        setTransactionsLoading(false);
      }
    },
    [period, selectedMonth],
  );

  const fetchCustomers = useCallback(async (page = 1, append = false) => {
    setCustomersLoading(true);
    const token = getToken();
    if (!token) {
      setCustomersLoading(false);
      return;
    }

    try {
      const res = await fetch(
        `${API_BASE}/api/transactions/customers/top?limit=${ITEMS_PER_PAGE}&page=${page}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );

      if (res.ok) {
        const newCustomers = await res.json();

        if (append) {
          setCustomers((prev) => [...prev, ...newCustomers]);
        } else {
          setCustomers(newCustomers);
        }

        setHasMoreCustomers(newCustomers.length === ITEMS_PER_PAGE);
      }
    } catch (err) {
      console.error("Failed to fetch customers:", err);
    } finally {
      setCustomersLoading(false);
    }
  }, []);

  const loadMoreTransactions = () => {
    const nextPage = transactionsPage + 1;
    setTransactionsPage(nextPage);
    fetchTransactions(nextPage, true);
  };

  const loadMoreCustomers = () => {
    const nextPage = customersPage + 1;
    setCustomersPage(nextPage);
    fetchCustomers(nextPage, true);
  };

  useEffect(() => {
    setTopItemsDisplayCount(5); // Reset to show 5 items when period changes
    fetchData();
    fetchAnalytics();
    fetchTransactions(1, false);
    fetchCustomers(1, false);
  }, [
    period,
    selectedMonth,
    fetchData,
    fetchAnalytics,
    fetchTransactions,
    fetchCustomers,
  ]);

  const stats = useMemo(() => {
    if (!data) return { sales: 0, expenses: 0, profit: 0, debt: 0 };
    return {
      sales: data.sales || 0,
      expenses: data.expenses || 0,
      profit: data.profit || 0,
      debt: data.debts?.outstandingTotal || 0,
    };
  }, [data]);

  const expenses = useMemo(() => {
    if (!data?.recentTransactions) return [];
    const categories = {};

    data.recentTransactions
      .filter((t) => t.type === "expense")
      .forEach((t) => {
        const cat = t.notes || t.category || "Other Expenses";
        categories[cat] = (categories[cat] || 0) + (t.amount || 0);
      });

    const total = Object.values(categories).reduce((sum, amt) => sum + amt, 0);
    return Object.entries(categories)
      .map(([cat, amt]) => ({
        category: cat,
        amount: amt,
        percent: total > 0 ? (amt / total) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 8);
  }, [data]);

  const handleDownload = async (type) => {
    const token = getToken();
    if (!token) return;

    try {
      let url = `${API_BASE}/api/transactions/`;
      let filename = "sokotally-report";

      if (type === "csv") {
        url += "export";
        if (selectedMonth && period === "month") {
          const [y, m] = selectedMonth.split("-");
          const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
          url += `?from=${selectedMonth}-01&to=${selectedMonth}-${lastDay}`;
        }
        filename += `-${
          selectedMonth || new Date().toISOString().split("T")[0]
        }.csv`;
      } else if (type === "ai") {
        url += "reports/ai?format=pdf&download=1";
        if (selectedMonth && period === "month") {
          const [y, m] = selectedMonth.split("-");
          const lastDay = new Date(parseInt(y), parseInt(m), 0).getDate();
          url += `&startDate=${selectedMonth}-01&endDate=${selectedMonth}-${lastDay}`;
        }
        filename += `-ai-${
          selectedMonth || new Date().toISOString().split("T")[0]
        }.pdf`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const blob = await response.blob();
        const objUrl = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = objUrl;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(objUrl);
      } else {
        alert("Failed to download report");
      }
    } catch (err) {
      console.error("Download error:", err);
      alert("Error downloading report");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-8">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-2">
            Business Reports
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
            Clear summaries of your sales and expenses
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Controls */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-gray-200 dark:border-slate-800 shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Period Selector */}
            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                Period:
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => setPeriod("all")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    period === "all"
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                  }`}
                >
                  All Time
                </button>
                <button
                  onClick={() => setPeriod("month")}
                  className={`px-4 py-2 rounded-md text-sm font-medium transition ${
                    period === "month"
                      ? "bg-gray-900 text-white dark:bg-white dark:text-gray-900"
                      : "bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700"
                  }`}
                >
                  Monthly
                </button>
              </div>
              {period === "month" && (
                <input
                  type="month"
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                  className="px-4 py-2 rounded-lg border border-gray-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-2">
              <button
                onClick={fetchData}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium rounded-md transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
                Refresh
              </button>
              <button
                onClick={() => handleDownload("csv")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-md transition"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                CSV Report
              </button>
              <button
                onClick={() => handleDownload("ai")}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 text-sm font-medium rounded-md transition"
              >
                <svg
                  className="w-4 h-4"
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
                AI Report (PDF)
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-900 dark:border-white border-t-transparent"></div>
          </div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {[
                {
                  label: "Total Sales",
                  value: stats.sales,
                  icon: "↑",
                  color: "text-green-600 dark:text-green-400",
                  bg: "bg-green-50 dark:bg-green-900/20",
                },
                {
                  label: "Total Expenses",
                  value: stats.expenses,
                  icon: "↓",
                  color: "text-red-600 dark:text-red-400",
                  bg: "bg-red-50 dark:bg-red-900/20",
                },
                {
                  label: "Net Profit",
                  value: stats.profit,
                  icon: "■",
                  color: "text-blue-600 dark:text-blue-400",
                  bg: "bg-blue-50 dark:bg-blue-900/20",
                },
                {
                  label: "Outstanding Debts",
                  value: stats.debt,
                  icon: "◆",
                  color: "text-orange-600 dark:text-orange-400",
                  bg: "bg-orange-50 dark:bg-orange-900/20",
                },
              ].map((stat, index) => (
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
                        {stat.icon}
                      </span>
                    </div>
                  </div>
                  <p className="text-3xl font-semibold text-gray-900 dark:text-white">
                    KSh {stat.value.toLocaleString()}
                  </p>
                </div>
              ))}
            </div>

            {/* Charts and Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Top Selling Items */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Top Selling Products
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Best performers by revenue
                  </p>
                </div>
                <div className="p-6">
                  {topItems.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-8 h-8 text-gray-400"
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
                      <p className="text-gray-500 dark:text-gray-400">
                        No sales data available
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {topItems
                        .slice(0, topItemsDisplayCount)
                        .map((item, i) => (
                          <div
                            key={i}
                            className="flex items-center gap-4 p-3 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                          >
                            <div className="flex-shrink-0 w-8 h-8 bg-blue-600 dark:bg-blue-500 rounded-lg flex items-center justify-center text-white font-semibold text-sm shadow-sm">
                              {i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-gray-900 dark:text-white truncate">
                                {item.itemName}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {item.totalQuantity} units @{" "}
                                {formatCurrency(item.avgPrice || 0)}/unit
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="font-semibold text-green-600 dark:text-green-400">
                                {formatCurrency(item.totalRevenue || 0)}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Total
                              </p>
                            </div>
                          </div>
                        ))}
                      {topItems.length > topItemsDisplayCount && (
                        <button
                          onClick={() =>
                            setTopItemsDisplayCount((prev) => prev + 5)
                          }
                          className="w-full mt-4 px-4 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-medium rounded-lg transition"
                        >
                          Load More
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Expense Breakdown */}
              <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Expense Breakdown
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    Where your money goes
                  </p>
                </div>
                <div className="p-6">
                  {expenses.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg
                          className="w-12 h-12 text-gray-400"
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
                      <p className="text-gray-500 dark:text-gray-400">
                        No expense data available
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {expenses.map((exp, i) => (
                        <div key={i} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-gray-900 dark:text-white text-sm">
                              {exp.category}
                            </p>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                {exp.percent.toFixed(1)}%
                              </span>
                              <span className="font-semibold text-red-600 dark:text-red-400 text-sm">
                                {formatCurrency(exp.amount)}
                              </span>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-red-500 dark:bg-red-400 h-full rounded-full transition-all duration-500"
                              style={{ width: `${exp.percent}%` }}
                            ></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Recent Transactions */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Transactions
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Latest business activity
                </p>
              </div>
              <div className="p-6">
                {transactionsLoading && transactions.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-900 dark:border-white border-t-transparent"></div>
                  </div>
                ) : transactions.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      No transactions available
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {transactions.map((txn) => (
                      <div
                        key={txn._id}
                        className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div
                          className={`flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center ${
                            txn.type === "sale"
                              ? "bg-green-50 dark:bg-green-900/20"
                              : txn.type === "expense"
                                ? "bg-red-50 dark:bg-red-900/20"
                                : "bg-blue-50 dark:bg-blue-900/20"
                          }`}
                        >
                          <span
                            className={`text-2xl ${
                              txn.type === "sale"
                                ? "text-green-600 dark:text-green-400"
                                : txn.type === "expense"
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-blue-600 dark:text-blue-400"
                            }`}
                          >
                            {txn.type === "sale"
                              ? "↑"
                              : txn.type === "expense"
                                ? "↓"
                                : "■"}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white capitalize">
                            {txn.type}
                            {txn.customer && (
                              <span className="text-gray-500 dark:text-gray-400 font-normal ml-2">
                                - {txn.customer}
                              </span>
                            )}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400 truncate">
                            {txn.notes || txn.category || "No description"}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                            {new Date(txn.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`font-semibold text-lg ${
                              txn.type === "sale"
                                ? "text-green-600 dark:text-green-400"
                                : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {txn.type === "sale" ? "+" : "-"}
                            {formatCurrency(txn.amount)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {hasMoreTransactions && (
                      <button
                        onClick={loadMoreTransactions}
                        disabled={transactionsLoading}
                        className="w-full mt-4 px-4 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {transactionsLoading ? "Loading..." : "Load More"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Top Customers */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Top Customers
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Highest spending customers
                </p>
              </div>
              <div className="p-6">
                {customersLoading && customers.length === 0 ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-gray-900 dark:border-white border-t-transparent"></div>
                  </div>
                ) : customers.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400">
                      No customer data available
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {customers.map((customer, i) => (
                      <div
                        key={customer._id}
                        className="flex items-center gap-4 p-4 rounded-lg border border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50 transition-colors"
                      >
                        <div className="flex-shrink-0 w-10 h-10 bg-blue-600 dark:bg-blue-500 rounded-full flex items-center justify-center text-white font-semibold shadow-sm">
                          {(customersPage - 1) * ITEMS_PER_PAGE + i + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 dark:text-white">
                            {customer._id || "Anonymous"}
                          </p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {customer.transactionCount} transaction
                            {customer.transactionCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-green-600 dark:text-green-400 text-lg">
                            {formatCurrency(customer.totalSpent)}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">
                            Total spent
                          </p>
                        </div>
                      </div>
                    ))}
                    {hasMoreCustomers && (
                      <button
                        onClick={loadMoreCustomers}
                        disabled={customersLoading}
                        className="w-full mt-4 px-4 py-3 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 text-gray-900 dark:text-white font-medium rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {customersLoading ? "Loading..." : "Load More"}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Current Inventory */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Current Inventory
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Stock levels and low stock alerts
                </p>
              </div>
              <div className="p-6">
                {inventory.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
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
                    <p className="text-gray-500 dark:text-gray-400">
                      No inventory items available
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {inventory.map((item) => {
                      const isLowStock =
                        item.currentQuantity <= item.reorderLevel;
                      return (
                        <div
                          key={item._id}
                          className={`flex items-center gap-4 p-4 rounded-lg border transition-colors ${
                            isLowStock
                              ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/10"
                              : "border-gray-100 dark:border-slate-700 hover:bg-gray-50 dark:hover:bg-slate-800/50"
                          }`}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-gray-900 dark:text-white">
                                {item.itemName}
                              </p>
                              {isLowStock && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300">
                                  Low Stock
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Unit Price: {formatCurrency(item.sellingPrice)} •
                              Value:{" "}
                              {formatCurrency(
                                item.currentQuantity * item.buyingPrice,
                              )}
                            </p>
                          </div>
                          <div className="text-right">
                            <p
                              className={`text-2xl font-bold ${
                                isLowStock
                                  ? "text-red-600 dark:text-red-400"
                                  : "text-gray-900 dark:text-white"
                              }`}
                            >
                              {item.currentQuantity}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {item.unit ||
                                (item.currentQuantity === 1 ? "unit" : "units")}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Outstanding Debts */}
            <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-slate-800 bg-gray-50 dark:bg-slate-800/50">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Outstanding Debts
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                  Money owed to you by customers
                </p>
              </div>
              <div className="p-6">
                {debts.given.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400"
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
                    <p className="text-gray-500 dark:text-gray-400">
                      No outstanding debts
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {debts.given.map((debt) => (
                      <div
                        key={debt._id}
                        className="flex items-center justify-between p-4 rounded-lg bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/20 transition-colors"
                      >
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {debt.customerName ||
                              debt.customer ||
                              "Unknown Customer"}
                          </p>
                          {debt.occurredAt && (
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              Date:{" "}
                              {new Date(debt.occurredAt).toLocaleDateString()}
                            </p>
                          )}
                          {debt.notes && (
                            <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                              {debt.notes}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          <p className="font-semibold text-orange-600 dark:text-orange-400 text-lg">
                            +{formatCurrency(debt.amount)}
                          </p>
                          {debt.status && (
                            <span
                              className={`inline-block mt-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                debt.status === "paid"
                                  ? "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300"
                                  : debt.status === "partial"
                                    ? "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300"
                                    : "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300"
                              }`}
                            >
                              {debt.status}
                            </span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default Report;

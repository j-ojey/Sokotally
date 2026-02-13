import React, { useState, useEffect } from "react";
import { getToken } from "../storage/auth";
import { API_BASE } from "../config/api";
import {
  CreditCard,
  DollarSign,
  AlertCircle,
  CheckCircle,
  Clock,
  Calendar,
  MessageCircle,
  TrendingUp,
  TrendingDown,
} from "lucide-react";

const DebtTracking = () => {
  const [debts, setDebts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("given");
  const [stats, setStats] = useState({
    given: { total: 0, count: 0, unpaid: 0, unpaidAmount: 0 },
    owed: { total: 0, count: 0, unpaid: 0, unpaidAmount: 0 },
  });

  const fetchDebts = React.useCallback(async () => {
    setLoading(true);
    const token = getToken();
    try {
      // Fetch both debt and loan types with high limit
      const [debtRes, loanRes] = await Promise.all([
        fetch(`${API_BASE}/api/transactions?type=debt&limit=500`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/transactions?type=loan&limit=500`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (debtRes.ok && loanRes.ok) {
        const debtData = await debtRes.json();
        const loanData = await loanRes.json();
        const transactions = [
          ...(debtData.transactions || debtData || []),
          ...(loanData.transactions || loanData || []),
        ];

        // Separate debts given vs debts owed
        const debtsGiven = transactions.filter(
          (t) => t.type === "debt" && t.customerName,
        );

        const debtsOwed = transactions.filter(
          (t) => t.type === "loan" || (t.type === "debt" && t.lender),
        );

        // Calculate stats
        const givenStats = calculateStats(debtsGiven);
        const owedStats = calculateStats(debtsOwed);

        setStats({
          given: givenStats,
          owed: owedStats,
        });

        setDebts(activeTab === "given" ? debtsGiven : debtsOwed);
      } else {
        console.error("Failed to fetch debts");
      }
    } catch (err) {
      console.error("Failed to fetch debts:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchDebts();

    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      fetchDebts();
    }, 30000);

    return () => clearInterval(interval);
  }, [fetchDebts]);

  const calculateStats = (debtList) => {
    const total = debtList.reduce((sum, d) => sum + d.amount, 0);
    const unpaidDebts = debtList.filter((d) => d.status !== "paid");
    const unpaidAmount = unpaidDebts.reduce((sum, d) => sum + d.amount, 0);

    return {
      total,
      count: debtList.length,
      unpaid: unpaidDebts.length,
      unpaidAmount,
    };
  };

  const markAsPaid = async (debtId) => {
    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/api/transactions/${debtId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status: "paid" }),
      });

      if (res.ok) {
        fetchDebts();
      }
    } catch (err) {
      console.error("Error marking as paid:", err);
    }
  };

  const deleteDebt = async (debtId) => {
    if (!confirm("Are you sure you want to delete this debt record?")) {
      return;
    }

    const token = getToken();
    try {
      const res = await fetch(`${API_BASE}/api/transactions/${debtId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (res.ok) {
        fetchDebts();
      }
    } catch (err) {
      console.error("Error deleting debt:", err);
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
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-2">
            Debt Tracking
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
            Manage customer debts and track what you owe
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-8">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            icon={<TrendingUp className="h-6 w-6" />}
            title="Total Debts Given"
            value={`KES ${stats.given.total.toLocaleString()}`}
            subtitle={`${stats.given.count} customers`}
            color="blue"
          />
          <StatCard
            icon={<AlertCircle className="h-6 w-6" />}
            title="Unpaid (Given)"
            value={`KES ${stats.given.unpaidAmount.toLocaleString()}`}
            subtitle={`${stats.given.unpaid} pending`}
            color="red"
          />
          <StatCard
            icon={<TrendingDown className="h-6 w-6" />}
            title="Total Debts Owed"
            value={`KES ${stats.owed.total.toLocaleString()}`}
            subtitle={`${stats.owed.count} creditors`}
            color="purple"
          />
          <StatCard
            icon={<Clock className="h-6 w-6" />}
            title="Unpaid (Owed)"
            value={`KES ${stats.owed.unpaidAmount.toLocaleString()}`}
            subtitle={`${stats.owed.unpaid} pending`}
            color="red"
          />
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab("given")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "given"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
            >
              Debts Given
              <span className="ml-2 px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded-full text-xs">
                {stats.given.unpaid}
              </span>
            </button>
            <button
              onClick={() => setActiveTab("owed")}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === "owed"
                  ? "border-blue-500 text-blue-600 dark:text-blue-400"
                  : "border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300"
              }`}
            >
              Debts Owed
              <span className="ml-2 px-2 py-1 bg-gray-100 dark:bg-slate-800 rounded-full text-xs">
                {stats.owed.unpaid}
              </span>
            </button>
          </nav>
        </div>

        {/* Debts List */}
        <div className="space-y-4">
          {debts.length === 0 ? (
            <div className="text-center py-12 bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5">
              <CreditCard className="h-16 w-16 mx-auto text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400 text-lg">
                No {activeTab === "given" ? "debts given" : "debts owed"} yet
              </p>
            </div>
          ) : (
            debts.map((debt) => (
              <DebtCard
                key={debt._id}
                debt={debt}
                type={activeTab}
                onMarkAsPaid={markAsPaid}
                onDelete={deleteDebt}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ icon, title, value, subtitle, color }) => {
  const colorClasses = {
    blue: "bg-blue-500/10 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400",
    green:
      "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400",
    red: "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400",
    purple:
      "bg-purple-500/10 text-purple-600 dark:bg-purple-500/20 dark:text-purple-400",
  };

  return (
    <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 hover:border-blue-400/40 hover:shadow-xl hover:shadow-blue-500/10 transition-all duration-300 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
      <h3 className="text-gray-600 dark:text-gray-400 text-sm font-medium mb-2">
        {title}
      </h3>
      <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
        {value}
      </p>
      <p className="text-gray-500 dark:text-gray-400 text-sm">{subtitle}</p>
    </div>
  );
};

const DebtCard = ({ debt, type, onMarkAsPaid, onDelete }) => {
  const isPaid = debt.status === "paid";
  const personName = type === "given" ? debt.customerName : debt.lender;
  const date = new Date(debt.occurredAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div className="bg-white dark:bg-[#0f172a]/70 backdrop-blur-sm rounded-lg border border-gray-200 dark:border-white/5 hover:border-blue-400/40 hover:shadow-xl transition-all duration-300 p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4 flex-1">
          <div
            className={`p-3 rounded-lg ${isPaid ? "bg-green-500/10 text-green-600 dark:bg-green-500/20 dark:text-green-400" : "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400"}`}
          >
            {isPaid ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <AlertCircle className="h-6 w-6" />
            )}
          </div>

          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {personName || "Unknown"}
              </h3>
              <span
                className={`px-2 py-1 rounded text-xs font-medium ${
                  isPaid
                    ? "bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400"
                }`}
              >
                {isPaid ? "Paid" : "Unpaid"}
              </span>
            </div>

            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <DollarSign className="h-4 w-4" />
                <span className="font-semibold text-gray-900 dark:text-white">
                  KES {debt.amount.toLocaleString()}
                </span>
              </div>

              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Calendar className="h-4 w-4" />
                <span>{date}</span>
              </div>

              {debt.notes && (
                <div className="mt-2 text-gray-600 dark:text-gray-400">
                  {debt.notes}
                </div>
              )}

              {debt.items && debt.items.length > 0 && (
                <div className="mt-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    Items:{" "}
                  </span>
                  <span className="text-gray-900 dark:text-white">
                    {debt.items.map((item) => item.name).join(", ")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {!isPaid && (
            <button
              onClick={() => onMarkAsPaid(debt._id)}
              className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium text-sm"
            >
              Mark as Paid
            </button>
          )}

          {personName && !isPaid && (
            <button
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium text-sm flex items-center justify-center gap-2"
              onClick={() => alert("Reminder feature coming soon")}
            >
              <MessageCircle className="h-4 w-4" />
              Remind
            </button>
          )}

          <button
            onClick={() => onDelete(debt._id)}
            className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors font-medium text-sm"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebtTracking;

import React, { useEffect, useState, useCallback } from "react";
import EditTransactionModal from "./shared/EditTransactionModal";
import { getToken } from "../storage/auth";
import { API_BASE } from "../config/api";
import { formatCurrency } from "../utils/formatters";

const Record = () => {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  const [selectedDate, setSelectedDate] = useState(`${year}-${month}-${day}`);

  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [modalType, setModalType] = useState("sale");
  const [formData, setFormData] = useState({
    amount: "",
    notes: "",
    customerName: "",
    items: [{ name: "", quantity: 1, unitPrice: 0 }],
    date: `${year}-${month}-${day}`,
    status: "paid",
  });

  const [stats, setStats] = useState({
    sales: 0,
    expenses: 0,
    profit: 0,
    debts: 0,
  });
  const [categorized, setCategorized] = useState({
    sales: [],
    expenses: [],
    debts: [],
    loans: [],
  });

  const fetchTransactions = useCallback(async () => {
    setLoading(true);
    try {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      // Build date range for the selected day
      const dayStart = new Date(selectedDate + "T00:00:00");
      const dayEnd = new Date(selectedDate + "T23:59:59");
      const res = await fetch(
        `${API_BASE}/api/transactions?from=${dayStart.toISOString()}&to=${dayEnd.toISOString()}&limit=500`,
        { headers },
      );
      if (!res.ok) throw new Error("Failed to fetch transactions");
      const data = await res.json();

      const normalizedData = (data || []).map((t) => ({
        ...t,
        id: t._id || t.id,
        desc: t.notes || t.desc || "No description",
        date: t.occurredAt
          ? new Date(t.occurredAt).toLocaleDateString()
          : new Date().toLocaleDateString(),
        items: t.items || [],
      }));

      const sales = normalizedData.filter(
        (t) => t.type === "sale" || t.type === "income",
      );
      const expenses = normalizedData.filter((t) => t.type === "expense");
      const debts = normalizedData.filter((t) => t.type === "debt");
      const loans = normalizedData.filter((t) => t.type === "loan");
      setCategorized({ sales, expenses, debts, loans });
      const salesSum = sales.reduce((s, x) => s + (x.amount || 0), 0);
      const expensesSum = expenses.reduce((s, x) => s + (x.amount || 0), 0);
      const debtsSum = debts.reduce((s, x) => s + (x.amount || 0), 0);
      setStats({
        sales: salesSum,
        expenses: expensesSum,
        profit: salesSum - expensesSum,
        debts: debtsSum,
      });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate]);

  useEffect(() => {
    fetchTransactions();
  }, [selectedDate, fetchTransactions]);

  const openModal = (type = "sale") => {
    setModalType(type);
    setEditingId(null);
    setFormData({
      amount: "",
      notes: "",
      customerName: "",
      items: [{ name: "", quantity: 1, unitPrice: 0 }],
      date: selectedDate,
      status: "paid",
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;

    const payload = {
      type: modalType === "sale" ? "income" : modalType,
      amount: parseFloat(formData.amount),
      notes: formData.notes,
      occurredAt: new Date(formData.date || selectedDate),
      customerName: formData.customerName || "",
      status: formData.status,
      ...((modalType === "sale" || modalType === "debt") && {
        items: formData.items,
      }),
    };

    try {
      const url = editingId
        ? `${API_BASE}/api/transactions/${editingId}`
        : `${API_BASE}/api/transactions`;
      const method = editingId ? "PATCH" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        setShowModal(false);
        setEditingId(null);
        setFormData({
          amount: "",
          notes: "",
          customerName: "",
          items: [{ name: "", quantity: 1, price: 0 }],
          date: selectedDate,
          status: "paid",
        });
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Are you sure you want to delete this transaction?")) return;
    const token = getToken();
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/transactions/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        fetchTransactions();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const TransactionCard = ({ t, type }) => {
    // Build a display name from items if available
    const itemsSummary =
      t.items && t.items.length > 0
        ? t.items.map((item) => {
            const name = item.name || "Item";
            const qty = item.quantity || 1;
            const unit = item.unit && item.unit !== "unit" ? item.unit : "";
            const price = item.unitPrice || item.price || 0;
            return { name, qty, unit, price };
          })
        : null;

    const displayTitle = itemsSummary
      ? itemsSummary
          .map((i) => `${i.qty}${i.unit ? " " + i.unit : ""} ${i.name}`)
          .join(", ")
      : t.description || t.desc || "Transaction";

    return (
      <div className="bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  type === "sales"
                    ? "bg-green-100 dark:bg-green-900/30"
                    : type === "expenses"
                      ? "bg-red-100 dark:bg-red-900/30"
                      : type === "debts"
                        ? "bg-purple-100 dark:bg-purple-900/30"
                        : "bg-amber-100 dark:bg-amber-900/30"
                }`}
              >
                <svg
                  className="w-6 h-6 text-gray-700 dark:text-gray-200"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  {type === "sales" ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  ) : type === "expenses" ? (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  ) : (
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                    />
                  )}
                </svg>
              </div>
              <div className="min-w-0">
                <p
                  className={`text-base font-semibold truncate ${
                    type === "sales"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : type === "expenses"
                        ? "text-red-600 dark:text-red-400"
                        : type === "debts"
                          ? "text-purple-600 dark:text-purple-400"
                          : "text-amber-600 dark:text-amber-400"
                  }`}
                >
                  {displayTitle}
                </p>
                {/* Item breakdown */}
                {itemsSummary && itemsSummary.length > 0 && (
                  <div className="mt-1 space-y-0.5">
                    {itemsSummary.map((item, idx) => (
                      <p
                        key={idx}
                        className="text-xs text-gray-500 dark:text-gray-400"
                      >
                        {item.name} — {item.qty}
                        {item.unit ? " " + item.unit : ""} × KSh{" "}
                        {item.price.toLocaleString()}
                      </p>
                    ))}
                  </div>
                )}
                {t.customerName && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Customer: {t.customerName}
                  </p>
                )}
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium mt-1">
                  {t.date}{" "}
                  {t.status && (
                    <span
                      className={`ml-2 px-2 py-0.5 rounded-full text-xs font-bold ${
                        t.status === "paid"
                          ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400"
                          : "bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400"
                      }`}
                    >
                      {t.status}
                    </span>
                  )}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`text-2xl font-black ${
                type === "sales"
                  ? "text-emerald-600 dark:text-emerald-400"
                  : type === "expenses"
                    ? "text-red-600 dark:text-red-400"
                    : type === "debts"
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-orange-600 dark:text-orange-400"
              }`}
            >
              {formatCurrency(t.amount)}
            </span>
            <div className="flex gap-1">
              <button
                onClick={() => {
                  setEditingId(t.id);
                  setModalType(t.type === "income" ? "sale" : t.type);
                  setFormData({
                    amount: t.amount,
                    notes: t.desc,
                    customerName: t.customerName || "",
                    items:
                      t.items && t.items.length > 0
                        ? t.items.map((item) => ({
                            name: item.name || "",
                            quantity: item.quantity || 1,
                            unitPrice: item.unitPrice || item.price || 0,
                          }))
                        : [{ name: "", quantity: 1, unitPrice: 0 }],
                    date: t.occurredAt
                      ? new Date(t.occurredAt).toISOString().split("T")[0]
                      : selectedDate,
                    status: t.status || "paid",
                  });
                  setShowModal(true);
                }}
                className="p-2 bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-200 dark:hover:bg-blue-900/50 rounded-lg transition-all transform hover:scale-110"
              >
                <svg
                  className="w-4 h-4 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
              </button>
              <button
                onClick={() => handleDelete(t.id)}
                className="p-2 bg-red-100 dark:bg-red-900/30 hover:bg-red-200 dark:hover:bg-red-900/50 rounded-lg transition-all transform hover:scale-110"
              >
                <svg
                  className="w-4 h-4 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-slate-900">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-6 py-10">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-3xl md:text-4xl font-semibold text-gray-900 dark:text-white mb-2">
            Daily Transactions
          </h1>
          <p className="text-gray-500 dark:text-gray-400 text-sm md:text-base">
            Track your sales and expenses for{" "}
            {new Date(selectedDate).toLocaleDateString("en-US", {
              weekday: "long",
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 md:px-6 py-8 space-y-6">
        {/* Date Controls */}
        <div className="flex flex-wrap items-center gap-3 bg-white dark:bg-slate-900 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-slate-800">
          <button
            onClick={fetchTransactions}
            className="inline-flex items-center gap-2 px-5 py-3 bg-gray-900 hover:bg-gray-800 text-white text-sm font-semibold rounded-md transition-all"
          >
            <svg
              className="w-5 h-5"
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
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="flex-1 min-w-[200px] bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 text-gray-900 dark:text-white text-sm font-medium px-4 py-3 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900/10"
          />
          <button
            onClick={() =>
              setSelectedDate(() => {
                const today = new Date();
                const year = today.getFullYear();
                const month = String(today.getMonth() + 1).padStart(2, "0");
                const day = String(today.getDate()).padStart(2, "0");
                return `${year}-${month}-${day}`;
              })
            }
            className="px-5 py-3 bg-white text-gray-900 border border-gray-300 hover:bg-gray-50 text-sm font-semibold rounded-md transition-all"
          >
            Today
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: "Sales",
              value: stats.sales,
              color: "text-green-600 dark:text-green-400",
              bg: "bg-green-50 dark:bg-green-900/20",
            },
            {
              label: "Expenses",
              value: stats.expenses,
              color: "text-red-600 dark:text-red-400",
              bg: "bg-red-50 dark:bg-red-900/20",
            },
            {
              label: "Profit",
              value: stats.profit,
              color: "text-blue-600 dark:text-blue-400",
              bg: "bg-blue-50 dark:bg-blue-900/20",
            },
            {
              label: "Debts",
              value: stats.debts,
              color: "text-orange-600 dark:text-orange-400",
              bg: "bg-orange-50 dark:bg-orange-900/20",
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className={`w-2 h-2 ${stat.bg.replace("bg-", "bg-").replace("/20", "")} rounded-full`}
                ></div>
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                  {stat.label}
                </p>
              </div>
              <p className={`text-2xl font-semibold ${stat.color}`}>
                KSh {stat.value.toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            {
              label: "Add Sale",
              type: "sale",
              bg: "bg-green-600 hover:bg-green-700 dark:bg-green-500 dark:hover:bg-green-600",
            },
            {
              label: "Add Expense",
              type: "expense",
              bg: "bg-red-600 hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600",
            },
            {
              label: "Add Debt",
              type: "debt",
              bg: "bg-purple-600 hover:bg-purple-700 dark:bg-purple-500 dark:hover:bg-purple-600",
            },
            {
              label: "Add Loan",
              type: "loan",
              bg: "bg-orange-600 hover:bg-orange-700 dark:bg-orange-500 dark:hover:bg-orange-600",
            },
          ].map((action, i) => (
            <button
              key={i}
              onClick={() => openModal(action.type)}
              className={`${action.bg} text-white rounded-lg p-4 text-center transition-all font-medium shadow-sm hover:shadow-md`}
            >
              {action.label}
            </button>
          ))}
        </div>

        {/* Transactions */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-gray-900 dark:border-white border-t-transparent"></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Sales */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-lg text-green-600 dark:text-green-400 font-bold">
                    +
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Sales ({categorized.sales.length})
                </h3>
              </div>
              {categorized.sales.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-10 text-center border border-gray-200 dark:border-slate-800">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-600 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No sales for this day
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categorized.sales.map((t) => (
                    <TransactionCard key={t.id} t={t} type="sales" />
                  ))}
                </div>
              )}
            </div>

            {/* Expenses */}
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                  <span className="text-lg text-red-600 dark:text-red-400 font-bold">
                    −
                  </span>
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Expenses ({categorized.expenses.length})
                </h3>
              </div>
              {categorized.expenses.length === 0 ? (
                <div className="bg-white dark:bg-slate-900 rounded-xl p-10 text-center border border-gray-200 dark:border-slate-800">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-600 dark:text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"
                      />
                    </svg>
                  </div>
                  <p className="text-gray-500 dark:text-gray-400 font-medium">
                    No expenses for this day
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {categorized.expenses.map((t) => (
                    <TransactionCard key={t.id} t={t} type="expenses" />
                  ))}
                </div>
              )}
            </div>

            {/* Debts */}
            {categorized.debts.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-lg text-purple-600 dark:text-purple-400 font-bold">
                      ↓
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Debts ({categorized.debts.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {categorized.debts.map((t) => (
                    <TransactionCard key={t.id} t={t} type="debts" />
                  ))}
                </div>
              </div>
            )}

            {/* Loans */}
            {categorized.loans.length > 0 && (
              <div className="space-y-4">
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center">
                    <span className="text-lg text-orange-600 dark:text-orange-400 font-bold">
                      ↑
                    </span>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Loans ({categorized.loans.length})
                  </h3>
                </div>
                <div className="space-y-3">
                  {categorized.loans.map((t) => (
                    <TransactionCard key={t.id} t={t} type="loans" />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <EditTransactionModal
        show={showModal}
        onClose={() => {
          setShowModal(false);
          setEditingId(null);
        }}
        onSubmit={handleSubmit}
        formData={formData}
        setFormData={setFormData}
        modalType={modalType}
        setModalType={setModalType}
        editingId={editingId}
      />
    </div>
  );
};

export default Record;

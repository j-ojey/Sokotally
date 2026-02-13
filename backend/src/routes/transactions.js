import { Router } from "express";
import mongoose from "mongoose";
import Transaction from "../models/Transaction.js";
import Debt from "../models/Debt.js";
import Customer from "../models/Customer.js";
import Item from "../models/Item.js";
import { authMiddleware } from "../middleware/auth.js";
import { getLLMResponse } from "../services/llmService.js";

const router = Router();

// Helper to convert string userId to ObjectId
const toObjectId = (id) => {
  try {
    return new mongoose.Types.ObjectId(id);
  } catch {
    return id;
  }
};

// List with basic filters and pagination
router.get("/", authMiddleware, async (req, res, next) => {
  try {
    const { from, to, type, page = 1, limit = 10 } = req.query;
    const query = { userId: toObjectId(req.userId) };
    if (type) query.type = type;
    if (from || to) {
      query.occurredAt = {};
      if (from) query.occurredAt.$gte = new Date(from);
      if (to) query.occurredAt.$lte = new Date(to);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const rows = await Transaction.find(query)
      .sort({ occurredAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.json(rows);
  } catch (e) {
    next(e);
  }
});

// Create transaction
router.post("/", authMiddleware, async (req, res, next) => {
  try {
    const doc = await Transaction.create({
      ...req.body,
      userId: toObjectId(req.userId),
    });
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
});

router.patch("/:id", authMiddleware, async (req, res, next) => {
  try {
    const doc = await Transaction.findOneAndUpdate(
      { _id: req.params.id, userId: toObjectId(req.userId) },
      req.body,
      { new: true },
    );
    if (!doc) return res.status(404).json({ error: "Not Found" });
    res.json(doc);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", authMiddleware, async (req, res, next) => {
  try {
    const out = await Transaction.deleteOne({
      _id: req.params.id,
      userId: toObjectId(req.userId),
    });
    res.json({ ok: out.deletedCount === 1 });
  } catch (e) {
    next(e);
  }
});

// Get top customers with pagination
router.get("/customers/top", authMiddleware, async (req, res, next) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const customers = await Transaction.aggregate([
      {
        $match: {
          userId: toObjectId(req.userId),
          type: { $in: ["sale", "income"] },
          customer: { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$customer",
          totalSpent: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $skip: skip },
      { $limit: parseInt(limit) },
    ]);

    res.json(customers);
  } catch (e) {
    next(e);
  }
});

// Get debts
router.get("/debts", authMiddleware, async (req, res, next) => {
  try {
    const { limit = 20 } = req.query;
    const userId = toObjectId(req.userId);

    console.log("[DEBTS ENDPOINT] userId:", userId);

    // Fetch ONLY UNPAID debts from transactions (not the Debt model)
    // Debts given = transactions where type="debt", has customerName, and status is NOT "paid"
    const debtsGiven = await Transaction.find({
      userId,
      type: "debt",
      customerName: { $exists: true, $ne: null, $ne: "" },
      status: { $ne: "paid" }, // Only unpaid debts
    })
      .sort({ occurredAt: -1 })
      .limit(parseInt(limit))
      .lean();

    console.log("[DEBTS ENDPOINT] Found unpaid debtsGiven:", debtsGiven.length);
    console.log("[DEBTS ENDPOINT] Sample:", debtsGiven.slice(0, 2));

    res.json(debtsGiven);
  } catch (e) {
    next(e);
  }
});

// Dashboard statistics endpoint
router.get("/stats/dashboard", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const now = new Date();

    // Today (from midnight to now) - full 24 hours
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    todayEnd.setHours(23, 59, 59, 999);

    // Yesterday (full day)
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    // Today's sales and expenses (full day)
    const [todaySalesAgg] = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "income",
          occurredAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const [todayExpensesAgg] = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          occurredAt: { $gte: todayStart, $lte: todayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Yesterday's sales and expenses for comparison
    const [yesterdaySalesAgg] = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "income",
          occurredAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const [yesterdayExpensesAgg] = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "expense",
          occurredAt: { $gte: yesterdayStart, $lte: yesterdayEnd },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const sales = todaySalesAgg?.total || 0;
    const expenses = todayExpensesAgg?.total || 0;
    const profit = sales - expenses;

    const prevSales = yesterdaySalesAgg?.total || 0;
    const prevExpenses = yesterdayExpensesAgg?.total || 0;
    const prevProfit = prevSales - prevExpenses;

    // Calculate percentage changes compared to yesterday
    // If yesterday has data, calculate normal percentage
    // If yesterday is 0 but today has data, show as 0 (new sales/expenses)
    // This prevents showing misleading 100% increase
    const salesTrend =
      prevSales > 0 ? ((sales - prevSales) / prevSales) * 100 : 0;
    const expensesTrend =
      prevExpenses > 0 ? ((expenses - prevExpenses) / prevExpenses) * 100 : 0;
    const profitTrend =
      prevProfit !== 0
        ? ((profit - prevProfit) / Math.abs(prevProfit)) * 100
        : 0;

    // Debts summary from Debt model
    const [outstandingDebtsAgg] = await Debt.aggregate([
      { $match: { userId, status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Also get debts from Transaction model (type: 'debt')
    const [transactionDebtsAgg] = await Transaction.aggregate([
      { $match: { userId, type: "debt", status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const outstandingDebts =
      (outstandingDebtsAgg?.total || 0) + (transactionDebtsAgg?.total || 0);
    const outstandingDebtsCount =
      (outstandingDebtsAgg?.count || 0) + (transactionDebtsAgg?.count || 0);

    const inSevenDays = new Date();
    inSevenDays.setDate(inSevenDays.getDate() + 7);

    const [dueSoonAgg] = await Debt.aggregate([
      {
        $match: {
          userId,
          status: "unpaid",
          dueDate: { $exists: true, $lte: inSevenDays },
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const dueSoonTotal = dueSoonAgg?.total || 0;
    const dueSoonCount = dueSoonAgg?.count || 0;

    // Get monthly aggregated data for charts (last 6 months)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    sixMonthsAgo.setDate(1);
    sixMonthsAgo.setHours(0, 0, 0, 0);

    const monthlySales = await Transaction.aggregate([
      {
        $match: { userId, type: "income", occurredAt: { $gte: sixMonthsAgo } },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$occurredAt" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const monthlyExpenses = await Transaction.aggregate([
      {
        $match: { userId, type: "expense", occurredAt: { $gte: sixMonthsAgo } },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m", date: "$occurredAt" } },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    // Recent transactions from today only (to match dashboard stats)
    const recentTransactions = await Transaction.find({
      userId,
      occurredAt: { $gte: todayStart, $lte: todayEnd },
    })
      .sort({ occurredAt: -1 })
      .limit(50)
      .lean();

    // Sales by period for reports (supports range: daily, weekly, monthly)
    const { range } = req.query;
    let salesByDay = [];

    if (!range || range === "daily") {
      // last 7 days
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - 6);
      daysAgo.setHours(0, 0, 0, 0);

      salesByDay = await Transaction.aggregate([
        { $match: { userId, type: "income", occurredAt: { $gte: daysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    } else if (range === "weekly") {
      // last 28 days grouped by day (4 weeks)
      const daysAgo = new Date();
      daysAgo.setDate(daysAgo.getDate() - 27);
      daysAgo.setHours(0, 0, 0, 0);

      salesByDay = await Transaction.aggregate([
        { $match: { userId, type: "income", occurredAt: { $gte: daysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    } else if (range === "monthly") {
      // last 6 months grouped by month
      const monthsAgo = new Date();
      monthsAgo.setMonth(monthsAgo.getMonth() - 5);
      monthsAgo.setHours(0, 0, 0, 0);

      salesByDay = await Transaction.aggregate([
        { $match: { userId, type: "income", occurredAt: { $gte: monthsAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m", date: "$occurredAt" } },
            total: { $sum: "$amount" },
          },
        },
        { $sort: { _id: 1 } },
      ]);
    }

    // Top selling items
    const topItems = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "income",
          items: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
          unit: { $first: "$items.unit" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Top customers by sales (try to lookup Customer name)
    const topCustomers = await Transaction.aggregate([
      { $match: { userId, type: "income" } },
      {
        $group: {
          _id: "$customerId",
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "customers",
          localField: "_id",
          foreignField: "_id",
          as: "customer",
        },
      },
      { $unwind: { path: "$customer", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          customerId: "$_id",
          name: { $ifNull: ["$customer.name", "Walk-in Customer"] },
          total: 1,
          count: 1,
        },
      },
    ]);

    res.json({
      sales,
      expenses,
      profit,
      trends: {
        sales: Math.round(salesTrend * 10) / 10, // Round to 1 decimal
        expenses: Math.round(expensesTrend * 10) / 10,
        profit: Math.round(profitTrend * 10) / 10,
      },
      debts: {
        outstandingTotal: outstandingDebts,
        outstandingCount: outstandingDebtsCount,
        dueSoonTotal,
        dueSoonCount,
      },
      recentTransactions,
      monthlyData: {
        sales: monthlySales,
        expenses: monthlyExpenses,
      },
      salesByDay,
      topCustomers,
      topItems: topItems.map((item) => ({
        name: item._id,
        quantity: item.quantity,
        revenue: item.revenue,
        unit: item.unit,
      })),
    });
  } catch (e) {
    next(e);
  }
});

// ============ NEW ANALYTICS ENDPOINTS ============

// Get report stats with date range filtering
router.get("/stats/report", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { startDate, endDate, period = "all" } = req.query;

    let dateFilter = { userId };
    let start, end;

    if (period === "month" && startDate) {
      // Specific month
      start = new Date(startDate);
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end = new Date(start);
      end.setMonth(end.getMonth() + 1);
      end.setMilliseconds(-1);
      dateFilter.occurredAt = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      // Custom range
      start = new Date(startDate);
      end = new Date(endDate);
      dateFilter.occurredAt = { $gte: start, $lte: end };
    }
    // else: all-time (no date filter)

    // Sales and expenses for selected period
    const [salesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "income" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const [expensesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "expense" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const sales = salesAgg?.total || 0;
    const expenses = expensesAgg?.total || 0;
    const profit = sales - expenses;

    // Debts summary
    const [outstandingDebtsAgg] = await Debt.aggregate([
      { $match: { userId, status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const [transactionDebtsAgg] = await Transaction.aggregate([
      { $match: { userId, type: "debt", status: "unpaid" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const outstandingDebts =
      (outstandingDebtsAgg?.total || 0) + (transactionDebtsAgg?.total || 0);
    const outstandingDebtsCount =
      (outstandingDebtsAgg?.count || 0) + (transactionDebtsAgg?.count || 0);

    // Recent transactions for the period
    const recentTransactions = await Transaction.find(dateFilter)
      .sort({ occurredAt: -1 })
      .limit(100)
      .lean();

    res.json({
      sales,
      expenses,
      profit,
      period:
        period === "month" && start
          ? `${start.toLocaleDateString("en-US", { year: "numeric", month: "long" })}`
          : period === "all"
            ? "All Time"
            : "Custom Range",
      dateRange:
        start && end
          ? { start: start.toISOString(), end: end.toISOString() }
          : null,
      debts: {
        outstandingTotal: outstandingDebts,
        outstandingCount: outstandingDebtsCount,
      },
      recentTransactions,
    });
  } catch (e) {
    next(e);
  }
});

// Get top selling items
router.get("/analytics/top-items", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { limit = 10, period = "all" } = req.query;

    const matchStage = {
      userId,
      type: "income",
      items: { $exists: true, $ne: [] },
    };

    // Add time filter if period specified
    if (period !== "all") {
      const now = new Date();
      let startDate = new Date();

      if (period === "today") {
        startDate.setHours(0, 0, 0, 0);
      } else if (period === "week") {
        startDate.setDate(now.getDate() - 7);
      } else if (period === "month") {
        startDate.setMonth(now.getMonth() - 1);
      }

      matchStage.occurredAt = { $gte: startDate };
    }

    const topItems = await Transaction.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: { $sum: "$items.totalPrice" },
          transactionCount: { $sum: 1 },
          avgPrice: { $avg: "$items.unitPrice" },
          unit: { $first: "$items.unit" },
        },
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          itemName: "$_id",
          totalQuantity: 1,
          totalRevenue: 1,
          transactionCount: 1,
          avgPrice: { $round: ["$avgPrice", 2] },
          unit: 1,
          _id: 0,
        },
      },
    ]);

    res.json({ items: topItems, period });
  } catch (e) {
    next(e);
  }
});

// Get least selling items
router.get("/analytics/least-items", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { limit = 10, period = 30 } = req.query;

    const matchStage = {
      userId,
      type: "income",
      items: { $exists: true, $ne: [] },
    };

    // Time filter based on period (days)
    const now = new Date();
    const startDate = new Date();
    const periodDays = parseInt(period);

    if (periodDays > 0) {
      startDate.setDate(now.getDate() - periodDays);
      startDate.setHours(0, 0, 0, 0);
      matchStage.occurredAt = { $gte: startDate };
    }

    const leastItems = await Transaction.aggregate([
      { $match: matchStage },
      { $unwind: "$items" },
      {
        $group: {
          _id: { $toLower: { $trim: { input: "$items.name" } } },
          originalName: { $first: "$items.name" },
          totalQuantity: { $sum: "$items.quantity" },
          totalRevenue: {
            $sum: {
              $ifNull: [
                "$items.totalPrice",
                { $multiply: ["$items.unitPrice", "$items.quantity"] },
              ],
            },
          },
          transactionCount: { $sum: 1 },
          avgPrice: { $avg: { $ifNull: ["$items.unitPrice", "$items.price"] } },
          unit: { $first: "$items.unit" },
        },
      },
      { $sort: { totalQuantity: 1 } },
      { $limit: parseInt(limit) },
      {
        $project: {
          itemName: "$originalName",
          totalQuantity: 1,
          totalRevenue: 1,
          transactionCount: 1,
          avgPrice: { $round: ["$avgPrice", 2] },
          unit: 1,
          _id: 0,
        },
      },
    ]);

    res.json({
      items: leastItems,
      period: periodDays > 0 ? `${periodDays} days` : "all time",
      message: leastItems.length === 0 ? "No sales data available" : null,
    });
  } catch (e) {
    next(e);
  }
});

// Get inventory insights (items sold vs stock)
router.get(
  "/analytics/inventory-insights",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = toObjectId(req.userId);

      // Get sales by item
      const salesByItem = await Transaction.aggregate([
        {
          $match: { userId, type: "income", items: { $exists: true, $ne: [] } },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            soldQuantity: { $sum: "$items.quantity" },
            revenue: { $sum: "$items.totalPrice" },
            unit: { $first: "$items.unit" },
          },
        },
        { $sort: { soldQuantity: -1 } },
      ]);

      // Get purchases by item
      const purchasesByItem = await Transaction.aggregate([
        {
          $match: {
            userId,
            type: "expense",
            items: { $exists: true, $ne: [] },
          },
        },
        { $unwind: "$items" },
        {
          $group: {
            _id: "$items.name",
            purchasedQuantity: { $sum: "$items.quantity" },
            cost: { $sum: "$items.totalPrice" },
          },
        },
      ]);

      // Merge sales and purchases
      const inventory = salesByItem.map((sale) => {
        const purchase = purchasesByItem.find((p) => p._id === sale._id);
        return {
          itemName: sale._id,
          soldQuantity: sale.soldQuantity,
          purchasedQuantity: purchase?.purchasedQuantity || 0,
          revenue: sale.revenue,
          cost: purchase?.cost || 0,
          profit: sale.revenue - (purchase?.cost || 0),
          unit: sale.unit,
        };
      });

      res.json({ inventory });
    } catch (e) {
      next(e);
    }
  },
);

// Get sales trends by item over time
router.get("/analytics/item-trends", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { itemName, days = 30 } = req.query;

    if (!itemName) {
      return res
        .status(400)
        .json({ error: "itemName query parameter required" });
    }

    const daysAgo = new Date();
    daysAgo.setDate(daysAgo.getDate() - parseInt(days));
    daysAgo.setHours(0, 0, 0, 0);

    const trends = await Transaction.aggregate([
      {
        $match: {
          userId,
          type: "income",
          occurredAt: { $gte: daysAgo },
          "items.name": itemName.toLowerCase(),
        },
      },
      { $unwind: "$items" },
      { $match: { "items.name": itemName.toLowerCase() } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" } },
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          date: "$_id",
          quantity: 1,
          revenue: 1,
          _id: 0,
        },
      },
    ]);

    res.json({ itemName, trends, period: `${days} days` });
  } catch (e) {
    next(e);
  }
});

// Generate comprehensive report
router.get("/reports/comprehensive", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { startDate, endDate, format = "json" } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const dateFilter = { userId, occurredAt: { $gte: start, $lte: end } };

    // Financial summary
    const [salesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "income" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const [expensesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "expense" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Top items
    const topItems = await Transaction.aggregate([
      {
        $match: {
          ...dateFilter,
          type: "income",
          items: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
          unit: { $first: "$items.unit" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Daily breakdown
    const dailyBreakdown = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" },
            },
            type: "$type",
          },
          total: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    const report = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
      },
      summary: {
        totalSales: salesAgg?.total || 0,
        totalExpenses: expensesAgg?.total || 0,
        netProfit: (salesAgg?.total || 0) - (expensesAgg?.total || 0),
        salesCount: salesAgg?.count || 0,
        expensesCount: expensesAgg?.count || 0,
      },
      topItems: topItems.map((item) => ({
        name: item._id,
        quantity: item.quantity,
        revenue: item.revenue,
        unit: item.unit,
      })),
      dailyBreakdown,
    };

    res.json(report);
  } catch (e) {
    next(e);
  }
});

// AI-generated formatted report (Markdown, HTML, or PDF)
router.get("/reports/ai", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { startDate, endDate, format = "md", download = "1" } = req.query;

    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();

    const dateFilter = { userId, occurredAt: { $gte: start, $lte: end } };

    // Previous period for comparison (same duration)
    const periodDays = Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    const previousStart = new Date(start);
    previousStart.setDate(previousStart.getDate() - periodDays);
    const previousEnd = new Date(start);
    previousEnd.setMilliseconds(-1);
    const previousDateFilter = {
      userId,
      occurredAt: { $gte: previousStart, $lte: previousEnd },
    };

    // Core aggregates - Current Period
    const [salesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "income" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const [expensesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "expense" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    // Previous period for growth calculation
    const [prevSalesAgg] = await Transaction.aggregate([
      { $match: { ...previousDateFilter, type: "income" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const [prevExpensesAgg] = await Transaction.aggregate([
      { $match: { ...previousDateFilter, type: "expense" } },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    // Calculate growth percentages
    const salesGrowth =
      prevSalesAgg?.total > 0
        ? (
            (((salesAgg?.total || 0) - prevSalesAgg.total) /
              prevSalesAgg.total) *
            100
          ).toFixed(1)
        : 0;
    const expensesGrowth =
      prevExpensesAgg?.total > 0
        ? (
            (((expensesAgg?.total || 0) - prevExpensesAgg.total) /
              prevExpensesAgg.total) *
            100
          ).toFixed(1)
        : 0;

    // Top Items
    const topItems = await Transaction.aggregate([
      {
        $match: {
          ...dateFilter,
          type: "income",
          items: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
          unit: { $first: "$items.unit" },
          avgPrice: { $avg: "$items.price" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 10 },
    ]);

    // Top Customers
    const topCustomers = await Transaction.aggregate([
      {
        $match: {
          ...dateFilter,
          type: { $in: ["income", "sale"] },
          customer: { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$customer",
          totalSpent: { $sum: "$amount" },
          transactionCount: { $sum: 1 },
        },
      },
      { $sort: { totalSpent: -1 } },
      { $limit: 5 },
    ]);

    // Expense Breakdown by Category
    const expenseBreakdown = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "expense" } },
      {
        $group: {
          _id: { $ifNull: ["$notes", "$category", "Other"] },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 8 },
    ]);

    // Daily Breakdown
    const dailyBreakdown = await Transaction.aggregate([
      { $match: dateFilter },
      {
        $group: {
          _id: {
            date: {
              $dateToString: { format: "%Y-%m-%d", date: "$occurredAt" },
            },
            type: "$type",
          },
          total: { $sum: "$amount" },
          count: { $sum: 1 },
        },
      },
      { $sort: { "_id.date": 1 } },
    ]);

    // Inventory Status
    const inventoryItems = await Item.find({ userId }).lean();
    const inventoryStats = {
      totalItems: inventoryItems.length,
      totalValue: inventoryItems.reduce(
        (sum, item) => sum + (item.quantity || 0) * (item.unitPrice || 0),
        0,
      ),
      lowStock: inventoryItems.filter(
        (item) => (item.quantity || 0) < (item.lowStockThreshold || 5),
      ).length,
      outOfStock: inventoryItems.filter((item) => (item.quantity || 0) === 0)
        .length,
    };

    // Outstanding Debts
    const debts = await Debt.find({ userId, status: { $ne: "paid" } })
      .populate("customerId", "name")
      .lean();
    const debtsStats = {
      totalOutstanding: debts.reduce(
        (sum, debt) => sum + (debt.amount || 0),
        0,
      ),
      count: debts.length,
      topDebtors: debts
        .sort((a, b) => (b.amount || 0) - (a.amount || 0))
        .slice(0, 5)
        .map((d) => ({
          customer: d.customerId?.name || "Unknown",
          amount: d.amount,
          dueDate: d.dueDate,
          status: d.status,
        })),
    };

    // Calculate averages
    const avgSaleValue =
      salesAgg?.count > 0 ? salesAgg.total / salesAgg.count : 0;
    const avgExpenseValue =
      expensesAgg?.count > 0 ? expensesAgg.total / expensesAgg.count : 0;

    const summary = {
      period: {
        start: start.toISOString(),
        end: end.toISOString(),
        days: periodDays,
      },
      totals: {
        sales: salesAgg?.total || 0,
        expenses: expensesAgg?.total || 0,
        profit: (salesAgg?.total || 0) - (expensesAgg?.total || 0),
        profitMargin:
          salesAgg?.total > 0
            ? (
                (((salesAgg?.total || 0) - (expensesAgg?.total || 0)) /
                  (salesAgg?.total || 0)) *
                100
              ).toFixed(1)
            : 0,
      },
      growth: {
        sales: salesGrowth,
        expenses: expensesGrowth,
        previousPeriodSales: prevSalesAgg?.total || 0,
        previousPeriodExpenses: prevExpensesAgg?.total || 0,
      },
      counts: {
        sales: salesAgg?.count || 0,
        expenses: expensesAgg?.count || 0,
        totalTransactions: (salesAgg?.count || 0) + (expensesAgg?.count || 0),
      },
      averages: {
        saleValue: avgSaleValue,
        expenseValue: avgExpenseValue,
        dailySales: salesAgg?.total > 0 ? salesAgg.total / periodDays : 0,
        dailyExpenses:
          expensesAgg?.total > 0 ? expensesAgg.total / periodDays : 0,
      },
      topItems: topItems.map((t) => ({
        name: t._id,
        quantity: t.quantity,
        revenue: t.revenue,
        unit: t.unit,
        avgPrice: t.avgPrice,
      })),
      topCustomers: topCustomers.map((c) => ({
        name: c._id,
        totalSpent: c.totalSpent,
        transactionCount: c.transactionCount,
        avgTransactionValue:
          c.transactionCount > 0 ? c.totalSpent / c.transactionCount : 0,
      })),
      expenseBreakdown: expenseBreakdown.map((e) => ({
        category: e._id,
        total: e.total,
        count: e.count,
        percentage:
          expensesAgg?.total > 0
            ? ((e.total / expensesAgg.total) * 100).toFixed(1)
            : 0,
      })),
      inventory: inventoryStats,
      debts: debtsStats,
      daily: dailyBreakdown,
    };

    // Compose prompt
    const systemPrompt =
      "You are a business analyst creating a detailed, insightful report for a small shop owner. Analyze the data thoroughly and provide actionable recommendations based on the actual numbers. Be specific and reference the real data in your insights.";
    const userMessage = `Create a comprehensive formatted ${format === "html" ? "HTML" : format === "pdf" ? "plain text" : "Markdown"} business report titled "SokoTally AI Business Report" for the following period.

Business Data (JSON):
${JSON.stringify(summary, null, 2)}

Requirements:
- Start with an Executive Summary highlighting the most important findings
- Sections: Executive Summary, Financial Performance, Sales Analysis, Top Products, Customer Insights, Expense Analysis, Inventory Status, Outstanding Debts, Key Insights & Actionable Recommendations
- Use real numbers from the data - reference specific growth percentages, profit margins, top items by name
- Currency is KSh. Use thousands separators (e.g., KSh 125,000)
- Identify trends, concerns (like low stock items, overdue debts), and opportunities
- Make recommendations specific to the data (e.g., "Stock more [item name] as it generated KSh X")
- Keep language clear, professional but friendly
- For PDF format, use plain text with clear section headings, bullet points, and no markdown syntax
- Highlight both positive achievements and areas needing attention`;

    let body = "";
    let aiGenerated = false;
    try {
      const ai = await getLLMResponse(userMessage, systemPrompt, []);
      body = ai.reply || "";
      aiGenerated = true;
    } catch (e) {
      // Fallback deterministic content if no LLM configured
      const lines = [];
      lines.push("# SokoTally Business Report");
      lines.push("");
      lines.push(
        `**Period:** ${new Date(summary.period.start).toLocaleDateString()} - ${new Date(summary.period.end).toLocaleDateString()} (${summary.period.days} days)`,
      );
      lines.push("");

      lines.push("## Executive Summary");
      lines.push("");
      lines.push(
        `Your business generated **KSh ${summary.totals.sales.toLocaleString()}** in sales with a profit margin of **${summary.totals.profitMargin}%**. `,
      );
      if (parseFloat(summary.growth.sales) > 0) {
        lines.push(
          `Sales grew by **${summary.growth.sales}%** compared to the previous period.`,
        );
      } else if (parseFloat(summary.growth.sales) < 0) {
        lines.push(
          `⚠️ Sales declined by **${Math.abs(summary.growth.sales)}%** compared to the previous period.`,
        );
      }
      lines.push("");

      lines.push("## Financial Performance");
      lines.push("");
      lines.push(
        `- **Total Sales:** KSh ${summary.totals.sales.toLocaleString()}`,
      );
      lines.push(
        `- **Total Expenses:** KSh ${summary.totals.expenses.toLocaleString()}`,
      );
      lines.push(
        `- **Net Profit:** KSh ${summary.totals.profit.toLocaleString()}`,
      );
      lines.push(`- **Profit Margin:** ${summary.totals.profitMargin}%`);
      lines.push(`- **Sales Growth:** ${summary.growth.sales}%`);
      lines.push(
        `- **Average Daily Sales:** KSh ${summary.averages.dailySales.toLocaleString()}`,
      );
      lines.push(
        `- **Average Sale Value:** KSh ${summary.averages.saleValue.toLocaleString()}`,
      );
      lines.push("");

      lines.push("## Top Selling Products");
      if (summary.topItems.length) {
        lines.push("");
        lines.push("| Rank | Item | Quantity | Revenue | Avg Price |");
        lines.push("|---:|---|---:|---:|---:|");
        summary.topItems.forEach((it, idx) =>
          lines.push(
            `| ${idx + 1} | ${it.name} | ${it.quantity} ${it.unit || ""} | KSh ${it.revenue.toLocaleString()} | KSh ${(it.avgPrice || 0).toLocaleString()} |`,
          ),
        );
      } else {
        lines.push("_No product sales recorded for this period._");
      }
      lines.push("");

      lines.push("## Top Customers");
      if (summary.topCustomers.length) {
        lines.push("");
        summary.topCustomers.forEach((cust, idx) => {
          lines.push(
            `${idx + 1}. **${cust.name}** - KSh ${cust.totalSpent.toLocaleString()} (${cust.transactionCount} transactions, avg: KSh ${cust.avgTransactionValue.toLocaleString()})`,
          );
        });
      } else {
        lines.push("_No customer data available for this period._");
      }
      lines.push("");

      lines.push("## Expense Breakdown");
      if (summary.expenseBreakdown.length) {
        lines.push("");
        lines.push("| Category | Amount | % of Total | Transactions |");
        lines.push("|---|---:|---:|---:|");
        summary.expenseBreakdown.forEach((exp) =>
          lines.push(
            `| ${exp.category} | KSh ${exp.total.toLocaleString()} | ${exp.percentage}% | ${exp.count} |`,
          ),
        );
      } else {
        lines.push("_No expenses recorded for this period._");
      }
      lines.push("");

      lines.push("## Inventory Status");
      lines.push("");
      lines.push(`- **Total Items:** ${summary.inventory.totalItems}`);
      lines.push(
        `- **Total Inventory Value:** KSh ${summary.inventory.totalValue.toLocaleString()}`,
      );
      if (summary.inventory.lowStock > 0) {
        lines.push(`- ⚠️ **Low Stock Items:** ${summary.inventory.lowStock}`);
      }
      if (summary.inventory.outOfStock > 0) {
        lines.push(
          `- 🔴 **Out of Stock Items:** ${summary.inventory.outOfStock}`,
        );
      }
      lines.push("");

      lines.push("## Outstanding Debts");
      lines.push("");
      lines.push(
        `- **Total Outstanding:** KSh ${summary.debts.totalOutstanding.toLocaleString()}`,
      );
      lines.push(`- **Number of Debtors:** ${summary.debts.count}`);
      if (summary.debts.topDebtors.length) {
        lines.push("");
        lines.push("**Top Debtors:**");
        summary.debts.topDebtors.forEach((debtor, idx) => {
          lines.push(
            `${idx + 1}. ${debtor.customer} - KSh ${debtor.amount.toLocaleString()} (${debtor.status})`,
          );
        });
      }
      lines.push("");

      lines.push("## Key Insights & Recommendations");
      lines.push("");

      // Data-driven insights
      if (parseFloat(summary.totals.profitMargin) < 20) {
        lines.push(
          "- ⚠️ **Profit Margin Alert:** Your profit margin is below 20%. Consider reviewing pricing or reducing expenses.",
        );
      }
      if (parseFloat(summary.growth.sales) < 0) {
        lines.push(
          "- 📉 **Sales Decline:** Sales decreased compared to last period. Focus on customer retention and marketing.",
        );
      }
      if (summary.inventory.lowStock > 0) {
        lines.push(
          `- 📦 **Stock Alert:** ${summary.inventory.lowStock} items are running low. Restock soon to avoid lost sales.`,
        );
      }
      if (summary.debts.totalOutstanding > summary.totals.profit) {
        lines.push(
          "- 💰 **Debt Collection:** Outstanding debts exceed your profit. Prioritize debt collection.",
        );
      }
      if (summary.topItems.length > 0) {
        const topItem = summary.topItems[0];
        lines.push(
          `- ⭐ **Best Performer:** ${topItem.name} generated KSh ${topItem.revenue.toLocaleString()}. Ensure adequate stock.`,
        );
      }
      if (summary.topCustomers.length > 0) {
        lines.push(
          `- 👥 **Customer Focus:** Your top customer spent KSh ${summary.topCustomers[0].totalSpent.toLocaleString()}. Consider loyalty rewards.`,
        );
      }

      lines.push(
        "- 📊 Keep recording all transactions daily for accurate insights.",
      );
      lines.push(
        "- 💡 Review your expense breakdown to identify cost-saving opportunities.",
      );

      body = lines.join("\n");
    }

    // PDF format handling
    if (format === "pdf") {
      const PDFDocument = (await import("pdfkit")).default;
      const doc = new PDFDocument({ size: "A4", margin: 50 });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename=sokotally-ai-report-${new Date().toISOString().split("T")[0]}.pdf`,
      );

      // Header
      doc
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("SokoTally AI Business Report", { align: "center" });
      doc.moveDown();
      doc
        .fontSize(10)
        .font("Helvetica")
        .text(
          `Period: ${new Date(summary.period.start).toLocaleDateString()} - ${new Date(summary.period.end).toLocaleDateString()} (${summary.period.days} days)`,
          { align: "center" },
        );
      doc.moveDown(2);

      // Executive Summary
      doc.fontSize(14).font("Helvetica-Bold").text("Executive Summary");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.text(
        `Your business generated KSh ${summary.totals.sales.toLocaleString()} in sales with a profit margin of ${summary.totals.profitMargin}%. `,
        { continued: false },
      );
      if (parseFloat(summary.growth.sales) !== 0) {
        const direction =
          parseFloat(summary.growth.sales) > 0 ? "grew" : "declined";
        doc.text(
          `Sales ${direction} by ${Math.abs(summary.growth.sales)}% compared to the previous period.`,
        );
      }
      doc.moveDown();

      // Financial Performance
      doc.fontSize(14).font("Helvetica-Bold").text("Financial Performance");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.list([
        `Total Sales: KSh ${summary.totals.sales.toLocaleString()} (${summary.counts.sales} transactions)`,
        `Total Expenses: KSh ${summary.totals.expenses.toLocaleString()} (${summary.counts.expenses} transactions)`,
        `Net Profit: KSh ${summary.totals.profit.toLocaleString()}`,
        `Profit Margin: ${summary.totals.profitMargin}%`,
        `Sales Growth: ${summary.growth.sales}%`,
        `Average Daily Sales: KSh ${Math.round(summary.averages.dailySales).toLocaleString()}`,
        `Average Sale Value: KSh ${Math.round(summary.averages.saleValue).toLocaleString()}`,
      ]);
      doc.moveDown();

      // Top Selling Items
      doc.fontSize(14).font("Helvetica-Bold").text("Top Selling Items");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      if (summary.topItems.length > 0) {
        summary.topItems.slice(0, 5).forEach((item, idx) => {
          doc.text(
            `${idx + 1}. ${item.name} - Qty: ${item.quantity} ${item.unit || ""} - Revenue: KSh ${item.revenue.toLocaleString()} (Avg Price: KSh ${Math.round(item.avgPrice || 0).toLocaleString()})`,
          );
        });
      } else {
        doc.text("No product sales for this period.");
      }
      doc.moveDown();

      // Top Customers
      if (summary.topCustomers.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Top Customers");
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica");
        summary.topCustomers.forEach((cust, idx) => {
          doc.text(
            `${idx + 1}. ${cust.name} - KSh ${cust.totalSpent.toLocaleString()} (${cust.transactionCount} purchases, avg: KSh ${Math.round(cust.avgTransactionValue).toLocaleString()})`,
          );
        });
        doc.moveDown();
      }

      // Expense Breakdown
      if (summary.expenseBreakdown.length > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Expense Breakdown");
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica");
        summary.expenseBreakdown.forEach((exp) => {
          doc.text(
            `${exp.category}: KSh ${exp.total.toLocaleString()} (${exp.percentage}% of total expenses)`,
          );
        });
        doc.moveDown();
      }

      // Inventory Status
      doc.fontSize(14).font("Helvetica-Bold").text("Inventory Status");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");
      doc.list([
        `Total Items in Stock: ${summary.inventory.totalItems}`,
        `Total Inventory Value: KSh ${summary.inventory.totalValue.toLocaleString()}`,
        ...(summary.inventory.lowStock > 0
          ? [
              `LOW STOCK ALERT: ${summary.inventory.lowStock} items need restocking`,
            ]
          : []),
        ...(summary.inventory.outOfStock > 0
          ? [`OUT OF STOCK: ${summary.inventory.outOfStock} items unavailable`]
          : []),
      ]);
      doc.moveDown();

      // Outstanding Debts
      if (summary.debts.count > 0) {
        doc.fontSize(14).font("Helvetica-Bold").text("Outstanding Debts");
        doc.moveDown(0.5);
        doc.fontSize(10).font("Helvetica");
        doc.text(
          `Total Outstanding: KSh ${summary.debts.totalOutstanding.toLocaleString()} from ${summary.debts.count} debtors`,
        );
        if (summary.debts.topDebtors.length > 0) {
          doc.moveDown(0.3);
          doc.text("Top Debtors:");
          summary.debts.topDebtors.forEach((debtor, idx) => {
            doc.text(
              `  ${idx + 1}. ${debtor.customer} - KSh ${debtor.amount.toLocaleString()} (${debtor.status})`,
            );
          });
        }
        doc.moveDown();
      }

      // AI Insights & Recommendations
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Key Insights & Recommendations");
      doc.moveDown(0.5);
      doc.fontSize(10).font("Helvetica");

      if (aiGenerated) {
        // Parse AI-generated text for insights (remove markdown/HTML formatting)
        const cleanText = body
          .replace(/#+ /g, "")
          .replace(/\*\*/g, "")
          .replace(/\*/g, "")
          .replace(/\|/g, "")
          .replace(/<[^>]*>/g, "")
          .replace(/\n{3,}/g, "\n\n");

        // Extract insights section if present
        const insightsMatch = cleanText.match(
          /insights?[\s&]*recommendations?[:\n]+([\s\S]+)/i,
        );
        if (insightsMatch) {
          doc.text(insightsMatch[1].trim(), { align: "left" });
        } else {
          // Show relevant parts of AI response
          const sections = cleanText.split(/\n(?=[A-Z])/);
          const relevantSection = sections.find(
            (s) =>
              s.toLowerCase().includes("insight") ||
              s.toLowerCase().includes("recommendation") ||
              s.toLowerCase().includes("action"),
          );
          if (relevantSection) {
            doc.text(relevantSection.trim(), { align: "left" });
          } else {
            doc.text(cleanText.substring(0, 1000), { align: "left" });
          }
        }
      } else {
        // Fallback data-driven insights
        const insights = [];
        if (parseFloat(summary.totals.profitMargin) < 20) {
          insights.push(
            "- Profit margin is below 20%. Consider reviewing pricing or reducing expenses.",
          );
        }
        if (parseFloat(summary.growth.sales) < 0) {
          insights.push(
            "- Sales declined compared to last period. Focus on customer retention and marketing.",
          );
        }
        if (summary.inventory.lowStock > 0) {
          insights.push(
            `- ${summary.inventory.lowStock} items are running low. Restock soon to avoid lost sales.`,
          );
        }
        if (summary.debts.totalOutstanding > summary.totals.profit) {
          insights.push(
            "- Outstanding debts exceed your profit. Prioritize debt collection.",
          );
        }
        if (summary.topItems.length > 0) {
          insights.push(
            `- Best performer: ${summary.topItems[0].name} generated KSh ${summary.topItems[0].revenue.toLocaleString()}. Ensure adequate stock.`,
          );
        }
        if (summary.topCustomers.length > 0) {
          insights.push(
            `- Your top customer spent KSh ${summary.topCustomers[0].totalSpent.toLocaleString()}. Consider loyalty rewards.`,
          );
        }
        insights.push(
          "- Keep recording all transactions daily for accurate insights.",
        );
        insights.push(
          "- Review your expense breakdown to identify cost-saving opportunities.",
        );

        doc.list(insights);
      }

      doc.end();
      doc.pipe(res);
      return;
    }

    if (format === "html") {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      if (download === "1") {
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="sokotally-ai-report-${new Date().toISOString().split("T")[0]}.html"`,
        );
      }
      return res.send(body);
    }

    // default markdown
    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    if (download === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="sokotally-ai-report-${new Date().toISOString().split("T")[0]}.md"`,
      );
    }
    return res.send(body);
  } catch (e) {
    next(e);
  }
});

// Export report as PDF (simple layout)
router.get("/reports/pdf", authMiddleware, async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const userId = toObjectId(req.userId);
    const start = startDate
      ? new Date(startDate)
      : new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate ? new Date(endDate) : new Date();
    const dateFilter = { userId, occurredAt: { $gte: start, $lte: end } };

    const [salesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "income" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);
    const [expensesAgg] = await Transaction.aggregate([
      { $match: { ...dateFilter, type: "expense" } },
      { $group: { _id: null, total: { $sum: "$amount" }, count: { $sum: 1 } } },
    ]);

    const topItems = await Transaction.aggregate([
      {
        $match: {
          ...dateFilter,
          type: "income",
          items: { $exists: true, $ne: [] },
        },
      },
      { $unwind: "$items" },
      {
        $group: {
          _id: "$items.name",
          quantity: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.totalPrice" },
        },
      },
      { $sort: { revenue: -1 } },
      { $limit: 8 },
    ]);

    const PDFDocument = (await import("pdfkit")).default;
    const doc = new PDFDocument({ size: "A4", margin: 40 });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=sokotally-report-${new Date().toISOString().split("T")[0]}.pdf`,
    );

    doc.fontSize(18).text("SokoTally Business Report", { align: "center" });
    doc.moveDown();
    doc
      .fontSize(10)
      .text(
        `Period: ${start.toLocaleDateString()} - ${end.toLocaleDateString()}`,
      );
    doc.moveDown();

    doc.fontSize(12).text("Key Metrics");
    doc
      .fontSize(10)
      .list([
        `Total Sales: KSh ${(salesAgg?.total || 0).toLocaleString()}`,
        `Total Expenses: KSh ${(expensesAgg?.total || 0).toLocaleString()}`,
        `Net Profit: KSh ${((salesAgg?.total || 0) - (expensesAgg?.total || 0)).toLocaleString()}`,
      ]);
    doc.moveDown();

    doc.fontSize(12).text("Top Items");
    if (topItems.length === 0) {
      doc.fontSize(10).text("No top items for this period.");
    } else {
      topItems.forEach((it) => {
        doc
          .fontSize(10)
          .text(
            `${it._id} - Qty: ${it.quantity} - Revenue: KSh ${it.revenue.toLocaleString()}`,
          );
      });
    }

    doc.end();
    doc.pipe(res);
  } catch (e) {
    next(e);
  }
});

// Export transactions as CSV
router.get("/export", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { from, to, type } = req.query;
    const query = { userId };
    if (type) query.type = type;
    if (from || to) {
      query.occurredAt = {};
      if (from) query.occurredAt.$gte = new Date(from);
      if (to) query.occurredAt.$lte = new Date(to);
    }
    const transactions = await Transaction.find(query)
      .sort({ occurredAt: -1 })
      .limit(5000);

    // Create CSV content
    let csv = "Date,Type,Description,Amount,Customer,Status\n";

    transactions.forEach((t) => {
      const date = new Date(t.occurredAt).toLocaleDateString();
      const type = t.type || "";
      const description = (t.notes || "").replace(/,/g, ";");
      const amount = t.amount || 0;
      const customer = (t.customerName || "").replace(/,/g, ";");
      const status = t.status || "";

      csv += `${date},${type},${description},${amount},${customer},${status}\n`;
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions-${new Date().toISOString().split("T")[0]}.csv`,
    );
    res.send(csv);
  } catch (e) {
    next(e);
  }
});

// Export transactions as Excel (.xlsx)
router.get("/export/xlsx", authMiddleware, async (req, res, next) => {
  try {
    const userId = toObjectId(req.userId);
    const { from, to, type } = req.query;
    const query = { userId };
    if (type) query.type = type;
    if (from || to) {
      query.occurredAt = {};
      if (from) query.occurredAt.$gte = new Date(from);
      if (to) query.occurredAt.$lte = new Date(to);
    }

    const transactions = await Transaction.find(query)
      .sort({ occurredAt: -1 })
      .limit(5000);
    const ExcelJS = (await import("exceljs")).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Transactions");

    ws.columns = [
      { header: "Date", key: "date", width: 14 },
      { header: "Type", key: "type", width: 12 },
      { header: "Description", key: "desc", width: 40 },
      { header: "Amount", key: "amount", width: 12 },
      { header: "Customer", key: "customer", width: 20 },
      { header: "Status", key: "status", width: 12 },
    ];

    transactions.forEach((t) =>
      ws.addRow({
        date: new Date(t.occurredAt).toLocaleDateString(),
        type: t.type || "",
        desc: (t.notes || "").replace(/\n/g, " "),
        amount: t.amount || 0,
        customer: t.customerName || "",
        status: t.status || "",
      }),
    );

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=transactions-${new Date().toISOString().split("T")[0]}.xlsx`,
    );

    await wb.xlsx.write(res);
    res.end();
  } catch (e) {
    next(e);
  }
});

export default router;

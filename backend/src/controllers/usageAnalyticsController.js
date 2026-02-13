import { User } from "../models/User.js";
import Transaction from "../models/Transaction.js";
import ChatMessage from "../models/ChatMessage.js";
import { AIUsage } from "../models/AIUsage.js";

/**
 * Usage Analytics Controller
 * Track user engagement and app usage patterns
 */

/**
 * Get comprehensive usage analytics
 */
export async function getUsageAnalytics(req, res) {
  try {
    const { timeRange = "30d" } = req.query;
    const timeFilter = getTimeFilter(timeRange);

    // User activity
    const activeUsers = await User.countDocuments({
      updatedAt: { $gte: timeFilter },
    });
    const totalUsers = await User.countDocuments();

    // Transaction activity
    const [transactionMetrics, debtMetrics, chatMetrics, aiMetrics] =
      await Promise.all([
        Transaction.aggregate([
          { $match: { createdAt: { $gte: timeFilter } } },
          {
            $group: {
              _id: "$type",
              count: { $sum: 1 },
              totalAmount: { $sum: "$amount" },
            },
          },
        ]),
        // Query debts from Transaction model (type=debt, status=unpaid/partial)
        Transaction.aggregate([
          { $match: { createdAt: { $gte: timeFilter }, type: "debt" } },
          {
            $group: {
              _id: null,
              totalDebts: { $sum: 1 },
              totalOwed: {
                $sum: {
                  $cond: [
                    { $in: ["$status", ["unpaid", "partial"]] },
                    "$amount",
                    0,
                  ],
                },
              },
              totalPaid: {
                $sum: {
                  $cond: [{ $eq: ["$status", "paid"] }, "$amount", 0],
                },
              },
            },
          },
        ]),
        // Chat engagement
        ChatMessage.countDocuments({ createdAt: { $gte: timeFilter } }),
        // AI usage
        AIUsage.countDocuments({ timestamp: { $gte: timeFilter } }),
      ]);

    // Daily active users
    const dauStats = await User.aggregate([
      { $match: { updatedAt: { $gte: timeFilter } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$updatedAt" } },
          users: { $addToSet: "$_id" },
        },
      },
      {
        $project: {
          date: "$_id",
          count: { $size: "$users" },
        },
      },
      { $sort: { date: 1 } },
    ]);

    // User retention
    const retentionData = await calculateRetention(timeFilter);

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        activePercentage:
          totalUsers > 0 ? ((activeUsers / totalUsers) * 100).toFixed(2) : 0,
        totalChatMessages: chatMetrics,
        totalAIRequests: aiMetrics,
      },
      transactions: transactionMetrics,
      debts: debtMetrics[0] || { totalDebts: 0, totalOwed: 0, totalPaid: 0 },
      dailyActiveUsers: dauStats,
      retention: retentionData,
      timeRange,
    });
  } catch (error) {
    console.error("Get usage analytics error:", error);
    res.status(500).json({ error: "Failed to fetch usage analytics" });
  }
}

/**
 * Get user engagement metrics
 */
export async function getEngagementMetrics(req, res) {
  try {
    const { timeRange = "30d" } = req.query;
    const timeFilter = getTimeFilter(timeRange);

    // Features usage
    const usageByFeature = await Transaction.aggregate([
      { $match: { createdAt: { $gte: timeFilter } } },
      {
        $group: {
          _id: "$userId",
          transactionCount: { $sum: 1 },
        },
      },
      {
        $bucket: {
          groupBy: "$transactionCount",
          boundaries: [0, 1, 5, 10, 50, 100, 1000],
          default: "100+",
          output: {
            userCount: { $sum: 1 },
            avgTransactions: { $avg: "$transactionCount" },
          },
        },
      },
    ]);

    // Session duration (estimated from updatedAt - createdAt)
    const sessionStats = await User.aggregate([
      { $match: { createdAt: { $gte: timeFilter } } },
      {
        $project: {
          sessionDuration: {
            $divide: [
              { $subtract: ["$updatedAt", "$createdAt"] },
              1000 * 60 * 60, // Convert to hours
            ],
          },
        },
      },
      {
        $group: {
          _id: null,
          avgSessionHours: { $avg: "$sessionDuration" },
          maxSessionHours: { $max: "$sessionDuration" },
        },
      },
    ]);

    res.json({
      usageByFeature,
      sessionStats: sessionStats[0] || {
        avgSessionHours: 0,
        maxSessionHours: 0,
      },
    });
  } catch (error) {
    console.error("Get engagement metrics error:", error);
    res.status(500).json({ error: "Failed to fetch engagement metrics" });
  }
}

// Helper functions
function getTimeFilter(timeRange) {
  const now = Date.now();
  switch (timeRange) {
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    case "90d":
      return new Date(now - 90 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
  }
}

async function calculateRetention(timeFilter) {
  try {
    const cohorts = await User.aggregate([
      { $match: { createdAt: { $gte: timeFilter } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          users: { $addToSet: "$_id" },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return cohorts.map((c) => ({
      cohortDate: c._id,
      userCount: c.count,
    }));
  } catch (error) {
    console.error("Calculate retention error:", error);
    return [];
  }
}

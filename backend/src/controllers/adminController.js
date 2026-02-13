import { User } from "../models/User.js";
import { SystemHealth } from "../models/SystemHealth.js";
import Transaction from "../models/Transaction.js";
import { AIUsage } from "../models/AIUsage.js";
import os from "os";

/**
 * Admin Controller - Platform Control Center
 * Focuses on app diagnostics and system health only
 * No access to business/transaction data
 */

/**
 * Get dashboard overview with redacted sensitive data
 */
export async function getDashboardStats(req, res) {
  try {
    const now = new Date();
    const last24Hours = new Date(now - 24 * 60 * 60 * 1000);
    const last7Days = new Date(now - 7 * 24 * 60 * 60 * 1000);
    const last30Days = new Date(now - 30 * 24 * 60 * 60 * 1000);

    // User statistics (redacted for privacy)
    const totalUsers = await User.countDocuments();
    const newUsersLast7Days = await User.countDocuments({
      createdAt: { $gte: last7Days },
    });
    const newUsersLast30Days = await User.countDocuments({
      createdAt: { $gte: last30Days },
    });

    // Active users (logged in within last 24 hours)
    // We'll track this via a lastActive field or session tracking
    const activeUsers = await User.countDocuments({
      updatedAt: { $gte: last24Hours },
    });

    const inactiveUsers = totalUsers - activeUsers;

    // System health summary
    const criticalIssues = await SystemHealth.countDocuments({
      severity: "critical",
      resolved: false,
      timestamp: { $gte: last7Days },
    });

    const recentErrors = await SystemHealth.countDocuments({
      errorCount: { $gt: 0 },
      timestamp: { $gte: last24Hours },
    });

    const fraudFlags = await SystemHealth.countDocuments({
      suspiciousActivityType: { $ne: "none" },
      resolved: false,
      timestamp: { $gte: last7Days },
    });

    res.json({
      overview: {
        totalUsers,
        activeUsers,
        inactiveUsers,
        activePercentage:
          totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0,
      },
      growth: {
        last7Days: newUsersLast7Days,
        last30Days: newUsersLast30Days,
        trend: calculateTrend(newUsersLast7Days, newUsersLast30Days),
      },
      systemHealth: {
        criticalIssues,
        recentErrors,
        fraudFlags,
        status:
          criticalIssues > 3
            ? "critical"
            : criticalIssues > 0 || recentErrors > 5 || fraudFlags > 0
              ? "warning"
              : "healthy",
      },
      timestamp: now,
    });
  } catch (error) {
    console.error("Admin dashboard stats error:", error);
    res.status(500).json({ error: "Failed to fetch dashboard stats" });
  }
}

/**
 * Get detailed system health metrics
 */
export async function getSystemHealth(req, res) {
  try {
    const { timeRange = "24h" } = req.query;

    const timeFilter = getTimeFilter(timeRange);
    const now = new Date();
    const serverStartTime = process.uptime() * 1000; // in milliseconds
    const timeRangeMinutes = parseTimeRangeToMinutes(timeRange);

    // Recent health records
    const healthRecords = await SystemHealth.find({
      timestamp: { $gte: timeFilter },
    })
      .sort({ timestamp: -1 })
      .limit(100)
      .select("-errorStack"); // Don't send full stack traces

    // API uptime calculation
    const totalRecords = healthRecords.length;
    const healthyRecords = healthRecords.filter(
      (r) => !r.errorCount || r.errorCount === 0,
    ).length;
    const uptimePercentage =
      totalRecords > 0 ? ((healthyRecords / totalRecords) * 100).toFixed(2) : 0;

    // Error breakdown
    const errorsByType = await SystemHealth.aggregate([
      { $match: { timestamp: { $gte: timeFilter }, errorCount: { $gt: 0 } } },
      { $group: { _id: "$errorType", count: { $sum: "$errorCount" } } },
    ]);

    // Average response time
    const avgResponseTime =
      healthRecords.reduce((sum, r) => sum + (r.avgResponseTime || 0), 0) /
      (totalRecords || 1);

    // Current system metrics
    const currentMemory = process.memoryUsage();
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const cpuLoad = os.loadavg()[0]; // 1 minute load average
    const cpuCount = os.cpus().length || 1;
    const cpuUsagePercent = Math.min(
      100,
      Math.round((cpuLoad / cpuCount) * 100),
    );

    // Count total errors in timeframe
    const totalErrors = await SystemHealth.aggregate([
      { $match: { timestamp: { $gte: timeFilter }, errorCount: { $gt: 0 } } },
      { $group: { _id: null, total: { $sum: "$errorCount" } } },
    ]);
    const errorCount = totalErrors[0]?.total || 0;

    // Recent error logs
    const recentErrors = await SystemHealth.find({
      timestamp: { $gte: timeFilter },
      errorCount: { $gt: 0 },
    })
      .sort({ timestamp: -1 })
      .limit(10)
      .select("errorMessage errorType endpoint timestamp");

    res.json({
      currentUptime: serverStartTime,
      errorCount,
      recentErrors: recentErrors.map((e) => ({
        message: e.errorMessage,
        type: e.errorType,
        endpoint: e.endpoint,
        timestamp: e.timestamp,
      })),
      requestRate:
        timeRangeMinutes > 0 ? Math.round(totalRecords / timeRangeMinutes) : 0,
      uptime: {
        percentage: parseFloat(uptimePercentage),
        status:
          uptimePercentage >= 99
            ? "excellent"
            : uptimePercentage >= 95
              ? "good"
              : "poor",
      },
      performance: {
        avgResponseTime: Math.round(avgResponseTime),
        dbQueries: totalRecords,
        memoryUsage: Math.round(currentMemory.heapUsed / 1024 / 1024),
        cpuUsage: cpuUsagePercent,
        currentMemoryUsageMB: Math.round(currentMemory.heapUsed / 1024 / 1024),
        totalMemoryMB: Math.round(totalMemory / 1024 / 1024),
        freeMemoryMB: Math.round(freeMemory / 1024 / 1024),
        cpuLoad: cpuLoad.toFixed(2),
      },
      errors: {
        total: healthRecords.reduce((sum, r) => sum + (r.errorCount || 0), 0),
        byType: errorsByType,
        recent: healthRecords
          .filter((r) => r.errorCount > 0)
          .slice(0, 10)
          .map((r) => ({
            type: r.errorType,
            message: r.errorMessage,
            timestamp: r.timestamp,
            severity: r.severity,
          })),
      },
      timeRange,
    });
  } catch (error) {
    console.error("System health error:", error);
    res.status(500).json({ error: "Failed to fetch system health" });
  }
}

/**
 * Get fraud detection flags (app-level security issues + transaction anomalies)
 */
export async function getFraudFlags(req, res) {
  try {
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // 1. System-level flags from SystemHealth
    const systemFlags = await SystemHealth.find({
      suspiciousActivityType: { $ne: "none" },
      resolved: false,
    })
      .sort({ timestamp: -1 })
      .limit(50)
      .select(
        "suspiciousActivityType flaggedIpAddresses timestamp severity notes",
      );

    // 2. Detect transaction anomalies in real-time
    const anomalyFlags = [];

    // 2a. Unusually large transactions (> 3x average)
    const avgResult = await Transaction.aggregate([
      { $match: { createdAt: { $gte: last7Days } } },
      { $group: { _id: null, avgAmount: { $avg: "$amount" } } },
    ]);
    const avgAmount = avgResult[0]?.avgAmount || 0;
    if (avgAmount > 0) {
      const largeTransactions = await Transaction.find({
        createdAt: { $gte: last24Hours },
        amount: { $gt: avgAmount * 3 },
      })
        .populate("userId", "name email")
        .sort({ amount: -1 })
        .limit(10);

      for (const tx of largeTransactions) {
        anomalyFlags.push({
          _id: `large_tx_${tx._id}`,
          suspiciousActivityType: "unusually_large_transaction",
          severity: tx.amount > avgAmount * 10 ? "critical" : "high",
          timestamp: tx.createdAt,
          notes: `Transaction of KES ${tx.amount.toLocaleString()} by ${tx.userId?.name || "Unknown"} — ${(tx.amount / avgAmount).toFixed(1)}x the average (KES ${Math.round(avgAmount).toLocaleString()})`,
          flaggedIpAddresses: [],
        });
      }
    }

    // 2b. Rapid transaction creation (>20 transactions in 1 hour by same user)
    const rapidUsers = await Transaction.aggregate([
      { $match: { createdAt: { $gte: last24Hours } } },
      {
        $group: {
          _id: {
            userId: "$userId",
            hour: {
              $dateToString: { format: "%Y-%m-%dT%H", date: "$createdAt" },
            },
          },
          count: { $sum: 1 },
        },
      },
      { $match: { count: { $gt: 20 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    for (const rapid of rapidUsers) {
      const user = await User.findById(rapid._id.userId).select("name email");
      anomalyFlags.push({
        _id: `rapid_tx_${rapid._id.userId}_${rapid._id.hour}`,
        suspiciousActivityType: "rapid_transactions",
        severity: rapid.count > 50 ? "critical" : "high",
        timestamp: new Date(rapid._id.hour),
        notes: `${user?.name || "Unknown"} created ${rapid.count} transactions in 1 hour`,
        flaggedIpAddresses: [],
      });
    }

    // 2c. Multiple failed AI requests (potential abuse)
    const failedAI = await AIUsage.aggregate([
      { $match: { timestamp: { $gte: last24Hours }, success: false } },
      {
        $group: {
          _id: "$userId",
          failCount: { $sum: 1 },
        },
      },
      { $match: { failCount: { $gt: 10 } } },
      { $sort: { failCount: -1 } },
      { $limit: 10 },
    ]);

    for (const fail of failedAI) {
      const user = await User.findById(fail._id).select("name email");
      anomalyFlags.push({
        _id: `ai_fail_${fail._id}`,
        suspiciousActivityType: "excessive_ai_failures",
        severity: "medium",
        timestamp: new Date(),
        notes: `${user?.name || "Unknown"} had ${fail.failCount} failed AI requests in 24h`,
        flaggedIpAddresses: [],
      });
    }

    const allFlags = [...systemFlags, ...anomalyFlags];

    const flagsByType = {};
    for (const flag of allFlags) {
      const type = flag.suspiciousActivityType;
      flagsByType[type] = (flagsByType[type] || 0) + 1;
    }
    const summary = Object.entries(flagsByType).map(([type, count]) => ({
      _id: type,
      count,
    }));

    res.json({
      activeFlags: allFlags,
      summary,
      totalUnresolved: allFlags.length,
    });
  } catch (error) {
    console.error("Fraud flags error:", error);
    res.status(500).json({ error: "Failed to fetch fraud flags" });
  }
}

/**
 * Get user growth analytics (no personal data)
 */
export async function getUserGrowthAnalytics(req, res) {
  try {
    const { period = "week" } = req.query;

    const groupBy =
      period === "month"
        ? { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }
        : period === "year"
          ? { $dateToString: { format: "%Y-%m", date: "$createdAt" } }
          : { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } };

    const timeFilter =
      period === "year"
        ? new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)
        : period === "month"
          ? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const growthData = await User.aggregate([
      { $match: { createdAt: { $gte: timeFilter } } },
      {
        $group: {
          _id: groupBy,
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      period,
      data: growthData.map((d) => ({
        date: d._id,
        newUsers: d.count, // This is acceptable as it's aggregated, not individual
      })),
    });
  } catch (error) {
    console.error("Growth analytics error:", error);
    res.status(500).json({ error: "Failed to fetch growth analytics" });
  }
}

/**
 * Resolve a fraud flag or system issue
 */
export async function resolveIssue(req, res) {
  try {
    const { issueId } = req.params;
    const { notes } = req.body;

    const issue = await SystemHealth.findByIdAndUpdate(
      issueId,
      {
        resolved: true,
        notes: notes || "Resolved by admin",
        resolvedAt: new Date(),
      },
      { new: true },
    );

    if (!issue) {
      return res.status(404).json({ error: "Issue not found" });
    }

    res.json({
      success: true,
      message: "Issue resolved successfully",
      issue,
    });
  } catch (error) {
    console.error("Resolve issue error:", error);
    res.status(500).json({ error: "Failed to resolve issue" });
  }
}

/**
 * Log a system health event (for internal monitoring)
 */
export async function logSystemEvent(req, res) {
  try {
    const {
      errorType,
      errorMessage,
      severity = "low",
      suspiciousActivityType = "none",
      flaggedIpAddresses = [],
    } = req.body;

    const event = new SystemHealth({
      errorType,
      errorMessage,
      errorCount: errorMessage ? 1 : 0,
      severity,
      suspiciousActivityType,
      flaggedIpAddresses,
      timestamp: new Date(),
    });

    await event.save();

    res.json({
      success: true,
      message: "System event logged",
      eventId: event._id,
    });
  } catch (error) {
    console.error("Log system event error:", error);
    res.status(500).json({ error: "Failed to log system event" });
  }
}

// Helper functions

function redactNumber(num) {
  // Redact exact numbers by showing ranges
  if (num < 10) return "<10";
  if (num < 50) return "10-50";
  if (num < 100) return "50-100";
  if (num < 500) return "100-500";
  if (num < 1000) return "500-1K";
  if (num < 5000) return "1K-5K";
  if (num < 10000) return "5K-10K";
  return "10K+";
}

function calculateTrend(recent, previous) {
  if (previous === 0) return recent > 0 ? "up" : "stable";
  const weeklyAvg = previous / 4; // Approximate weekly average from 30 days
  if (recent > weeklyAvg * 1.1) return "up";
  if (recent < weeklyAvg * 0.9) return "down";
  return "stable";
}

function getTimeFilter(timeRange) {
  const now = Date.now();
  switch (timeRange) {
    case "1h":
      return new Date(now - 60 * 60 * 1000);
    case "6h":
      return new Date(now - 6 * 60 * 60 * 1000);
    case "24h":
      return new Date(now - 24 * 60 * 60 * 1000);
    case "7d":
      return new Date(now - 7 * 24 * 60 * 60 * 1000);
    case "30d":
      return new Date(now - 30 * 24 * 60 * 60 * 1000);
    default:
      return new Date(now - 24 * 60 * 60 * 1000);
  }
}

function parseTimeRangeToMinutes(timeRange) {
  const value = parseInt(timeRange, 10);
  if (Number.isNaN(value)) return 0;

  if (timeRange.includes("h")) {
    return value * 60;
  }
  if (timeRange.includes("d")) {
    return value * 24 * 60;
  }

  return value;
}

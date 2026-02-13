import { Router } from "express";
import { authMiddleware } from "../middleware/auth.js";
import { voiceUpload } from "../middleware/upload.js";
import ChatMessage from "../models/ChatMessage.js";
import Transaction from "../models/Transaction.js";
import Item from "../models/Item.js";
import Inventory from "../models/Inventory.js";
import StockMovement from "../models/StockMovement.js";
import Debt from "../models/Debt.js";
import Customer from "../models/Customer.js";
import { AIUsage } from "../models/AIUsage.js";
import { extractKeywords } from "../services/keywordExtractor.js";
import {
  getLLMResponse,
  transcribeAudio,
  synthesizeSpeech,
} from "../services/llmService.js";
import { extractTransactionData } from "../services/transactionExtractor.js";
import {
  extractStockData,
  classifyMessage,
} from "../services/stockExtractor.js";
import { processFinancialQuery } from "../services/queryService.js";
import { findInventoryByNormalizedName } from "../services/itemNormalizer.js";
import {
  generateReport,
  parseTimePeriod,
  formatReportAsCSV,
} from "../services/reportService.js";
import { v4 as uuidv4 } from "uuid";

const router = Router();

// Text message endpoint
router.post("/message", authMiddleware, async (req, res, next) => {
  const startTime = Date.now();

  try {
    const { text, conversationId } = req.body || {};

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Message text is required" });
    }

    const userMessage = text.trim();
    const convId = conversationId || uuidv4();
    const userId = req.userId;

    // Check if user is requesting a report
    const lowerMessage = userMessage.toLowerCase();
    const isReportRequest =
      lowerMessage.includes("report") ||
      lowerMessage.includes("ripoti") ||
      (lowerMessage.includes("generate") && lowerMessage.includes("report")) ||
      (lowerMessage.includes("download") && lowerMessage.includes("report")) ||
      lowerMessage.includes("tengeneza ripoti") ||
      lowerMessage.includes("nataka ripoti");

    if (isReportRequest) {
      // Try to extract time period from message
      let timePeriod = "last 30 days"; // default

      if (lowerMessage.includes("today") || lowerMessage.includes("leo")) {
        timePeriod = "today";
      } else if (
        lowerMessage.includes("yesterday") ||
        lowerMessage.includes("jana")
      ) {
        timePeriod = "yesterday";
      } else if (
        lowerMessage.includes("this week") ||
        lowerMessage.includes("wiki hii")
      ) {
        timePeriod = "this week";
      } else if (
        lowerMessage.includes("last week") ||
        lowerMessage.includes("wiki iliyopita")
      ) {
        timePeriod = "last week";
      } else if (
        lowerMessage.includes("this month") ||
        lowerMessage.includes("mwezi huu")
      ) {
        timePeriod = "this month";
      } else if (
        lowerMessage.includes("last month") ||
        lowerMessage.includes("mwezi uliopita")
      ) {
        timePeriod = "last month";
      } else if (
        lowerMessage.includes("this year") ||
        lowerMessage.includes("mwaka huu")
      ) {
        timePeriod = "this year";
      } else if (
        lowerMessage.match(/last (\\d+) days?/) ||
        lowerMessage.match(/siku (\\d+) zilizopita/)
      ) {
        const match =
          lowerMessage.match(/last (\\d+) days?/) ||
          lowerMessage.match(/siku (\\d+) zilizopita/);
        timePeriod = `last ${match[1]} days`;
      }

      try {
        // Generate the report
        const dateRange = parseTimePeriod(timePeriod);
        const reportData = await generateReport(userId, dateRange);

        // Create download URL
        const downloadUrl = `${process.env.API_BASE_URL || "http://localhost:4000"}/chat/download-report?period=${encodeURIComponent(timePeriod)}`;

        // Save user message
        const userChatMessage = new ChatMessage({
          userId,
          conversationId: convId,
          message: userMessage,
          sender: "user",
          messageType: "text",
        });
        await userChatMessage.save();

        // Create AI response with report summary
        const reportSummary = `I've generated your business report for **${dateRange.label}**!\n\n📊 **Summary:**\n• Total Income: KES ${reportData.summary.totalIncome.toLocaleString()}\n• Total Expenses: KES ${reportData.summary.totalExpenses.toLocaleString()}\n• Net Profit: KES ${reportData.summary.netProfit.toLocaleString()} (${reportData.summary.profitMargin}% margin)\n• Transactions: ${reportData.summary.transactionCount}\n\n🏆 **Top Selling Items:**\n${reportData.sales.topSellingItems
          .slice(0, 3)
          .map(
            (item, i) =>
              `${i + 1}. ${item.name} - ${item.quantity} units, KES ${item.revenue.toLocaleString()}`,
          )
          .join(
            "\n",
          )}\n\n👥 **Top Customers:**\n${reportData.customers.topCustomers
          .slice(0, 3)
          .map(
            (c, i) =>
              `${i + 1}. ${c.name} - KES ${c.totalSpent.toLocaleString()}`,
          )
          .join(
            "\n",
          )}\n\n📦 **Inventory:**\n• Stock Value: KES ${reportData.inventory.totalStockValue.toLocaleString()}\n• Low Stock Items: ${reportData.inventory.lowStockCount}\n\nClick here to download the full CSV report: ${downloadUrl}`;

        const aiChatMessage = new ChatMessage({
          userId,
          conversationId: convId,
          message: reportSummary,
          sender: "ai",
          messageType: "text",
          metadata: {
            reportGenerated: true,
            timePeriod,
            downloadUrl,
          },
        });
        await aiChatMessage.save();

        return res.json({
          reply: reportSummary,
          conversationId: convId,
          reportData,
          downloadUrl,
          timestamp: new Date().toISOString(),
        });
      } catch (reportError) {
        console.error("Report generation error:", reportError);
        // Continue with normal chat flow if report generation fails
      }
    }

    // Fetch business analytics if user is asking about sales/business data
    let businessContext = "";
    // lowerMessage already declared above for report detection
    const isBusinessQuery =
      lowerMessage.includes("top") ||
      lowerMessage.includes("selling") ||
      lowerMessage.includes("least") ||
      lowerMessage.includes("sales") ||
      lowerMessage.includes("profit") ||
      lowerMessage.includes("expense") ||
      lowerMessage.includes("debt") ||
      lowerMessage.includes("mauzo") ||
      lowerMessage.includes("faida") ||
      lowerMessage.includes("matumizi") ||
      lowerMessage.includes("deni") ||
      lowerMessage.includes("bidhaa") ||
      lowerMessage.includes("item") ||
      lowerMessage.includes("product");

    if (isBusinessQuery) {
      try {
        // Fetch analytics data
        const [topItemsData, leastItemsData, statsData] = await Promise.all([
          Transaction.aggregate([
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
                avgPrice: {
                  $avg: { $ifNull: ["$items.unitPrice", "$items.price"] },
                },
              },
            },
            { $sort: { totalQuantity: -1 } },
            { $limit: 10 },
          ]),
          Transaction.aggregate([
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
                avgPrice: {
                  $avg: { $ifNull: ["$items.unitPrice", "$items.price"] },
                },
              },
            },
            { $sort: { totalQuantity: 1 } },
            { $limit: 10 },
          ]),
          Transaction.aggregate([
            { $match: { userId } },
            {
              $group: {
                _id: "$type",
                total: { $sum: "$amount" },
                count: { $sum: 1 },
              },
            },
          ]),
        ]);

        // Format business context
        const sales = statsData.find((s) => s._id === "income")?.total || 0;
        const expenses = statsData.find((s) => s._id === "expense")?.total || 0;
        const profit = sales - expenses;

        businessContext = `\n\nBUSINESS ANALYTICS DATA (use this to answer business questions):
Total Sales: KSh ${sales.toLocaleString()}
Total Expenses: KSh ${expenses.toLocaleString()}
Net Profit: KSh ${profit.toLocaleString()}

Top Selling Items (by quantity):
${topItemsData
  .slice(0, 5)
  .map(
    (item, i) =>
      `${i + 1}. ${item.originalName} - ${item.totalQuantity} units sold, KSh ${item.totalRevenue?.toLocaleString() || 0} revenue, avg price KSh ${item.avgPrice?.toFixed(2) || 0}`,
  )
  .join("\n")}

Least Selling Items (by quantity):
${leastItemsData
  .slice(0, 5)
  .map(
    (item, i) =>
      `${i + 1}. ${item.originalName} - ${item.totalQuantity} units sold, KSh ${item.totalRevenue?.toLocaleString() || 0} revenue, avg price KSh ${item.avgPrice?.toFixed(2) || 0}`,
  )
  .join("\n")}

Use this data to provide accurate, helpful answers about the business performance.`;
      } catch (error) {
        console.error("Error fetching business context:", error);
      }
    }

    // Get conversation history for context
    const recentMessages = await ChatMessage.find({
      userId,
      conversationId: convId,
    })
      .sort({ createdAt: -1 })
      .limit(4)
      .lean();

    // Use compact conversational prompt to save tokens
    // Detect user language for prompt reinforcement
    const swahiliWords =
      /\b(habari|asante|karibu|ndio|hapana|sawa|nimeuza|niliuza|nilinunua|nimenunua|nunua|uza|deni|mkopo|gharama|matumizi|lipa|nimelipa|bei|shilingi|ksh|duka|bidhaa|mauzo|faida|nadai|anadai|wadeni|nililipia|stoki|nimepata)\b/i;
    const userSpeaksSwahili = swahiliWords.test(userMessage);

    const conversationalPrompt = `You are SokoTally, a friendly AI assistant for small shop owners in Kenya.

LANGUAGE RULE (MUST follow — this is the #1 priority):
- ALWAYS respond in the EXACT same language the user writes in
- If they write in Swahili, reply ENTIRELY in Swahili
- If they write in English, reply ENTIRELY in English
- If they mix languages, match their mixing style
- NEVER switch languages unless the user does first

RULES:
- Be brief, friendly, conversational
- When a user reports a sale/expense/purchase/debt, just briefly acknowledge it (e.g. "Got it!" / "Sawa!"). A confirmation card appears automatically — do NOT ask them to confirm.
- Do NOT list past transactions unless specifically asked
- When asked about business data, use the real numbers below
- Keep responses under 3 sentences for simple messages
- ONLY discuss business-related topics: sales, inventory, expenses, debts, stock, reports, analytics, customers, suppliers
- If asked about non-business topics (sports, politics, entertainment, personal advice, etc.), politely decline and redirect: "I'm here to help with your business. How can I assist with your shop today?" (or in Swahili: "Niko hapa kusaidia na biashara yako. Nawezaje kukusaidia na duka lako leo?")${businessContext}`;

    const llmStartTime = Date.now();
    const llmResult = await getLLMResponse(
      userMessage,
      conversationalPrompt,
      recentMessages.reverse(),
    );
    const aiReply = llmResult.reply;
    const llmResponseTime = Date.now() - llmStartTime;

    // Track AI usage for monitoring
    try {
      await AIUsage.create({
        userId,
        messageType: "text",
        tokensUsed: llmResult.tokensUsed || 0,
        model: llmResult.model || process.env.LLM_PROVIDER || "groq",
        responseTime: llmResponseTime,
        success: true,
        timestamp: new Date(),
      });
    } catch (trackingError) {
      console.error("AI usage tracking error:", trackingError);
      // Don't fail the request if tracking fails
    }

    // Extract keywords and try transaction extraction - no language needed for extraction
    const keywords = extractKeywords(userMessage);
    const extractedData = await extractTransactionData(userMessage);

    // Handle stock commands (add/remove/update) from chat input
    let pendingStock = null;
    try {
      const stockIntent = await classifyMessage(userMessage);
      if (stockIntent === "stock") {
        const stockData = await extractStockData(userMessage);
        if (stockData?.actionType && stockData?.itemName) {
          pendingStock = {
            actionType: stockData.actionType,
            itemName: stockData.itemName,
            quantity: stockData.quantity,
            unit: stockData.unit || "pieces",
            buyingPricePerUnit: stockData.buyingPricePerUnit || 0,
            sellingPrice: stockData.sellingPrice || 0,
            supplierName: stockData.supplierName || null,
          };
        }
      }
    } catch (stockError) {
      console.error("Stock processing error:", stockError);
    }

    // Check if transaction was detected - but DON'T save yet, wait for user confirmation
    let pendingTransaction = null;
    // Normalize confidence to a number (fallback returns string like "high")
    const rawConf = extractedData.confidence;
    const numericConfidence =
      typeof rawConf === "number"
        ? rawConf
        : rawConf === "high"
          ? 0.9
          : rawConf === "medium"
            ? 0.7
            : rawConf === "low"
              ? 0.4
              : 0;
    const hasStrongTransactionIntent =
      extractedData.transactionType &&
      extractedData.totalAmount > 0 &&
      (numericConfidence > 0.4 ||
        // English keywords
        lowerMessage.includes("sold") ||
        lowerMessage.includes("bought") ||
        lowerMessage.includes("paid") ||
        lowerMessage.includes("received") ||
        lowerMessage.includes("expense") ||
        lowerMessage.includes("spent") ||
        lowerMessage.includes("debt") ||
        lowerMessage.includes("loan") ||
        lowerMessage.includes("owe") ||
        // Swahili keywords — sales
        lowerMessage.includes("nimeuza") ||
        lowerMessage.includes("niliuza") ||
        lowerMessage.includes("uza") ||
        lowerMessage.includes("mauzo") ||
        // Swahili keywords — purchases
        lowerMessage.includes("nilinunua") ||
        lowerMessage.includes("nimenunua") ||
        lowerMessage.includes("nunua") ||
        lowerMessage.includes("numenua") ||
        // Swahili keywords — expenses
        lowerMessage.includes("gharama") ||
        lowerMessage.includes("matumizi") ||
        lowerMessage.includes("nililipia") ||
        lowerMessage.includes("nimelipa") ||
        lowerMessage.includes("lipa") ||
        // Swahili keywords — debts/loans
        lowerMessage.includes("deni") ||
        lowerMessage.includes("mkopo") ||
        lowerMessage.includes("anadai") ||
        lowerMessage.includes("nadai") ||
        lowerMessage.includes("wadeni"));

    if (hasStrongTransactionIntent) {
      // Prepare transaction data but DON'T save yet
      pendingTransaction = {
        type:
          extractedData.transactionType === "sale"
            ? "income"
            : extractedData.transactionType === "purchase"
              ? "expense"
              : extractedData.transactionType,
        amount: extractedData.totalAmount,
        items: extractedData.items,
        customerName: extractedData.customerName,
        date: extractedData.date,
        notes: extractedData.notes,
        extractedData: extractedData,
      };
    }

    // 6. Save user message to database
    const createdRecord = null; // Initialize for response
    const userChatMessage = new ChatMessage({
      userId,
      conversationId: convId,
      message: userMessage,
      sender: "user",
      messageType: "text",
      extractedKeywords: keywords.categories.map((cat) => ({
        keyword: cat,
        category: cat,
        value: null,
      })),
      processedData: extractedData,
    });
    await userChatMessage.save();

    // 7. Save AI response to database
    const aiChatMessage = new ChatMessage({
      userId,
      conversationId: convId,
      message: aiReply,
      sender: "ai",
      messageType: "text",
      processedData: extractedData,
      createdRecord,
      metadata: {
        model: process.env.LLM_PROVIDER || "groq",
        processingTime: Date.now() - startTime,
        confidence: extractedData.confidence,
      },
    });
    await aiChatMessage.save();

    res.json({
      reply: aiReply,
      conversationId: convId,
      pendingTransaction,
      pendingStock,
      extractedData,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
});

// NEW: Confirm and save transaction endpoint
router.post("/confirm-transaction", authMiddleware, async (req, res, next) => {
  try {
    const { transactionData, conversationId } = req.body;
    const userId = req.userId;

    if (!transactionData) {
      return res.status(400).json({ error: "Transaction data is required" });
    }

    // Deduplication: reject if an identical transaction was saved in the last 30 seconds
    const thirtySecsAgo = new Date(Date.now() - 30000);
    const duplicate = await Transaction.findOne({
      userId,
      type: transactionData.type,
      amount: transactionData.amount,
      createdAt: { $gte: thirtySecsAgo },
    }).lean();

    if (duplicate) {
      return res.json({
        success: true,
        duplicate: true,
        message: "Transaction already recorded.",
        transaction: duplicate,
      });
    }

    // Build complete transaction data
    const fullTransactionData = {
      userId,
      type: transactionData.type,
      amount: transactionData.amount,
      items: transactionData.items,
      conversationText: transactionData.conversationText || "",
      extractedData: transactionData.extractedData,
      occurredAt: transactionData.date
        ? new Date(transactionData.date)
        : new Date(),
      status:
        transactionData.type === "debt" || transactionData.type === "loan"
          ? "unpaid"
          : "paid",
    };

    // Handle customer if mentioned
    if (transactionData.customerName) {
      let customer = await Customer.findOne({
        userId,
        name: transactionData.customerName,
      });

      if (!customer) {
        customer = await Customer.create({
          userId,
          name: transactionData.customerName,
        });
      }

      fullTransactionData.customerId = customer._id;
      fullTransactionData.customerName = transactionData.customerName;
    }

    // Create or update items in inventory
    for (const item of transactionData.items) {
      let inventoryItem = await Item.findOne({
        userId,
        name: item.name,
      });

      if (!inventoryItem) {
        inventoryItem = await Item.create({
          userId,
          name: item.name,
          unit: item.unit,
          price: item.unitPrice,
        });
      }

      // Link item to transaction
      const itemIndex = fullTransactionData.items.findIndex(
        (i) => i.name === item.name,
      );
      if (itemIndex >= 0) {
        fullTransactionData.items[itemIndex].itemId = inventoryItem._id;
      }
    }

    // Save transaction
    const transaction = await Transaction.create(fullTransactionData);

    // If this is a sale (income), reduce inventory for sold items
    if (
      transactionData.type === "income" &&
      transactionData.items &&
      transactionData.items.length > 0
    ) {
      for (const item of transactionData.items) {
        const quantitySold = item.quantity || 0;
        if (quantitySold <= 0) continue;

        // Find matching inventory item using normalized name
        const inventoryItem = await findInventoryByNormalizedName(
          item.name,
          Inventory,
          userId,
        );

        if (inventoryItem && inventoryItem.currentQuantity >= quantitySold) {
          // Reduce stock
          const previousQuantity = inventoryItem.currentQuantity;
          inventoryItem.currentQuantity -= quantitySold;
          await inventoryItem.save();

          // Create stock movement record
          await StockMovement.create({
            inventoryId: inventoryItem._id,
            userId,
            type: "sale",
            quantity: -quantitySold,
            previousQuantity,
            newQuantity: inventoryItem.currentQuantity,
            unitPrice: item.unitPrice || 0,
            reason: `Sold via transaction ${transaction._id}`,
            rawInput: "transaction",
          });
        }
      }
    }

    const createdRecord = {
      type: "transaction",
      recordType: fullTransactionData.type,
      recordId: transaction._id,
    };

    // Emit socket event
    const io = req.app.get("io");
    if (io) {
      io.to(`user:${userId}`).emit("transaction:created", {
        transaction,
        items: transactionData.items,
        type: fullTransactionData.type,
      });
    }

    res.json({
      success: true,
      transaction,
      createdRecord,
    });
  } catch (error) {
    next(error);
  }
});

// NEW: Confirm and save stock update endpoint
router.post("/confirm-stock", authMiddleware, async (req, res, next) => {
  try {
    const { stockData, conversationId } = req.body;
    const userId = req.userId;

    if (!stockData) {
      return res.status(400).json({ error: "Stock data is required" });
    }

    // Deduplication: reject if an identical stock movement was saved in the last 30 seconds
    const thirtySecsAgo = new Date(Date.now() - 30000);
    const dupMovement = await StockMovement.findOne({
      userId,
      quantity: Number(stockData.quantity) || 0,
      reason: { $regex: /assistant/i },
      createdAt: { $gte: thirtySecsAgo },
    }).lean();

    if (dupMovement) {
      return res.json({
        success: true,
        duplicate: true,
        message: "Stock update already recorded.",
      });
    }

    // Use normalized name for matching
    const inputName = stockData.itemName.trim();
    const unit = stockData.unit || "pieces";
    const quantity = Number(stockData.quantity) || 0;
    const buyingPricePerUnit = Number(stockData.buyingPricePerUnit) || 0;
    const sellingPrice = Number(stockData.sellingPrice) || 0;

    if (quantity <= 0) {
      return res.status(400).json({ error: "Quantity must be greater than 0" });
    }

    // Find existing inventory item using normalized name matching
    let inventoryItem = await findInventoryByNormalizedName(
      inputName,
      Inventory,
      userId,
    );

    if (!inventoryItem) {
      // Create new item with normalized name
      const { normalizeItemName } =
        await import("../services/itemNormalizer.js");
      const normalizedName = normalizeItemName(inputName);

      inventoryItem = await Inventory.create({
        userId,
        itemName: normalizedName,
        currentQuantity: 0,
        unit,
        buyingPrice: buyingPricePerUnit,
        sellingPrice,
        supplierName: stockData.supplierName || null,
        rawInput: "assistant",
      });
    }

    const previousQuantity = inventoryItem.currentQuantity;

    if (stockData.actionType === "add_stock") {
      inventoryItem.currentQuantity += quantity;
      inventoryItem.unit = unit;
      if (buyingPricePerUnit >= 0)
        inventoryItem.buyingPrice = buyingPricePerUnit;
      if (sellingPrice >= 0) inventoryItem.sellingPrice = sellingPrice;
      if (stockData.supplierName)
        inventoryItem.supplierName = stockData.supplierName;
      inventoryItem.lastRestockedDate = new Date();
      await inventoryItem.save();

      await StockMovement.create({
        inventoryId: inventoryItem._id,
        userId,
        type: "restock",
        quantity,
        previousQuantity,
        newQuantity: inventoryItem.currentQuantity,
        unitPrice: buyingPricePerUnit,
        reason: "Stock added via assistant",
        rawInput: "assistant",
        supplierName: stockData.supplierName || null,
      });
    } else if (stockData.actionType === "remove_stock") {
      const newQuantity = Math.max(0, inventoryItem.currentQuantity - quantity);
      inventoryItem.currentQuantity = newQuantity;
      await inventoryItem.save();

      await StockMovement.create({
        inventoryId: inventoryItem._id,
        userId,
        type: "spoilage",
        quantity: -quantity,
        previousQuantity,
        newQuantity: inventoryItem.currentQuantity,
        unitPrice: inventoryItem.buyingPrice || 0,
        reason: "Stock removed via assistant",
        rawInput: "assistant",
      });
    } else if (stockData.actionType === "update_stock") {
      inventoryItem.currentQuantity = quantity;
      inventoryItem.unit = unit;
      if (buyingPricePerUnit >= 0)
        inventoryItem.buyingPrice = buyingPricePerUnit;
      if (sellingPrice >= 0) inventoryItem.sellingPrice = sellingPrice;
      await inventoryItem.save();

      await StockMovement.create({
        inventoryId: inventoryItem._id,
        userId,
        type: "adjustment",
        quantity: quantity - previousQuantity,
        previousQuantity,
        newQuantity: inventoryItem.currentQuantity,
        unitPrice: inventoryItem.buyingPrice || 0,
        reason: "Stock updated via assistant",
        rawInput: "assistant",
      });
    }

    res.json({
      success: true,
      inventoryItem,
      conversationId,
    });
  } catch (error) {
    next(error);
  }
});

// Voice message endpoint
router.post(
  "/voice",
  authMiddleware,
  voiceUpload.single("audio"),
  async (req, res, next) => {
    const startTime = Date.now();

    try {
      if (!req.file) {
        return res.status(400).json({ error: "Audio file is required" });
      }

      const { conversationId } = req.body || {};
      const convId = conversationId || uuidv4();
      const userId = req.userId;

      // Cloudinary returns the secure URL in req.file.path
      const audioUrl = req.file.path;

      // 1. Transcribe audio to text (Cloudinary URL can be used directly)
      const transcriptionResult = await transcribeAudio(audioUrl);
      const transcribedText = transcriptionResult.text;

      // Extract structured transaction data from transcribed text
      const extractedData = await extractTransactionData(transcribedText);

      // Get conversation history for context
      const recentMessages = await ChatMessage.find({
        userId,
        conversationId: convId,
      })
        .sort({ createdAt: -1 })
        .limit(4)
        .lean();

      // 5. Generate AI confirmation message
      let aiReply = "";
      let createdRecord = null;

      // Process transaction if data was extracted
      let pendingTransaction = null;
      const rawConfV = extractedData.confidence;
      const numericConfV =
        typeof rawConfV === "number"
          ? rawConfV
          : rawConfV === "high"
            ? 0.9
            : rawConfV === "medium"
              ? 0.7
              : rawConfV === "low"
                ? 0.4
                : 0;
      const lowerTxt = transcribedText.toLowerCase();
      const hasStrongTransactionIntent =
        extractedData.transactionType &&
        extractedData.totalAmount > 0 &&
        (numericConfV > 0.4 ||
          lowerTxt.includes("sold") ||
          lowerTxt.includes("bought") ||
          lowerTxt.includes("paid") ||
          lowerTxt.includes("received") ||
          lowerTxt.includes("expense") ||
          lowerTxt.includes("spent") ||
          lowerTxt.includes("debt") ||
          lowerTxt.includes("loan") ||
          lowerTxt.includes("owe") ||
          lowerTxt.includes("nimeuza") ||
          lowerTxt.includes("niliuza") ||
          lowerTxt.includes("uza") ||
          lowerTxt.includes("mauzo") ||
          lowerTxt.includes("nilinunua") ||
          lowerTxt.includes("nimenunua") ||
          lowerTxt.includes("nunua") ||
          lowerTxt.includes("numenua") ||
          lowerTxt.includes("gharama") ||
          lowerTxt.includes("matumizi") ||
          lowerTxt.includes("nililipia") ||
          lowerTxt.includes("nimelipa") ||
          lowerTxt.includes("lipa") ||
          lowerTxt.includes("deni") ||
          lowerTxt.includes("mkopo") ||
          lowerTxt.includes("anadai") ||
          lowerTxt.includes("nadai") ||
          lowerTxt.includes("wadeni"));

      if (hasStrongTransactionIntent) {
        // Prepare transaction data but DON'T save yet - wait for user confirmation
        pendingTransaction = {
          type:
            extractedData.transactionType === "sale"
              ? "income"
              : extractedData.transactionType === "purchase"
                ? "expense"
                : extractedData.transactionType,
          amount: extractedData.totalAmount,
          items: extractedData.items,
          customerName: extractedData.customerName,
          date: extractedData.date,
          notes: transcribedText,
          extractedData: extractedData,
        };
      }

      // Generate AI response using compact prompt
      const swWordsV =
        /\b(habari|asante|karibu|ndio|hapana|sawa|nimeuza|niliuza|nilinunua|nimenunua|nunua|uza|deni|mkopo|gharama|matumizi|lipa|nimelipa|bei|shilingi|ksh|duka|bidhaa|mauzo|faida|nadai|anadai|wadeni|nililipia|stoki|nimepata)\b/i;
      const userSpeaksSwV = swWordsV.test(transcribedText);

      const conversationalPrompt = `You are SokoTally, a friendly AI assistant for small shop owners in Kenya.

LANGUAGE RULE (MUST follow — this is the #1 priority):
- ALWAYS respond in the EXACT same language the user speaks
- If they speak in Swahili, reply ENTIRELY in Swahili
- If they speak in English, reply ENTIRELY in English
- If they mix languages, match their mixing style
- NEVER switch languages unless the user does first

RULES:
- Be brief, friendly, conversational
- When a user reports a sale/expense/purchase/debt, just briefly acknowledge it. A confirmation card appears automatically — do NOT ask them to confirm.
- Do NOT list past transactions unless specifically asked
- Keep responses under 3 sentences for simple messages
- ONLY discuss business-related topics: sales, inventory, expenses, debts, stock, reports, analytics, customers, suppliers
- If asked about non-business topics (sports, politics, entertainment, personal advice, etc.), politely decline and redirect: "I'm here to help with your business. How can I assist with your shop today?" (or in Swahili: "Niko hapa kusaidia na biashara yako. Nawezaje kukusaidia na duka lako leo?")`;

      const llmResult = await getLLMResponse(
        transcribedText,
        conversationalPrompt,
        recentMessages.reverse(),
      );
      aiReply = llmResult.reply;

      // Save user voice message
      const userChatMessage = new ChatMessage({
        userId,
        conversationId: convId,
        message: transcribedText,
        sender: "user",
        messageType: "voice",
        audioUrl,
        transcription: transcribedText,
        extractedKeywords:
          extractedData.items?.map((item) => ({
            keyword: item.name,
            category: extractedData.transactionType,
            value: item.totalPrice,
          })) || [],
      });
      await userChatMessage.save();

      // Save AI response
      const aiChatMessage = new ChatMessage({
        userId,
        conversationId: convId,
        message: aiReply,
        sender: "ai",
        messageType: "text",
        processedData: extractedData,
        metadata: {
          processingTime: Date.now() - startTime,
        },
      });
      await aiChatMessage.save();

      res.json({
        reply: aiReply,
        transcription: transcribedText,
        conversationId: convId,
        pendingTransaction,
        extractedData,
        audioUrl,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      next(error);
    }
  },
);

// Get chat history
router.get("/history", authMiddleware, async (req, res, next) => {
  try {
    const { conversationId, limit = 50 } = req.query;
    const userId = req.userId;

    const query = { userId };
    if (conversationId) {
      query.conversationId = conversationId;
    }

    const messages = await ChatMessage.find(query)
      .sort({ createdAt: -1 })
      .limit(parseInt(limit))
      .lean();

    res.json({
      messages: messages.reverse(),
      total: messages.length,
    });
  } catch (error) {
    next(error);
  }
});

// Get all conversations
router.get("/conversations", authMiddleware, async (req, res, next) => {
  try {
    const userId = req.userId;
    const mongoose = await import("mongoose");

    // Get unique conversations with latest message
    const conversations = await ChatMessage.aggregate([
      {
        $match: {
          userId: mongoose.default.Types.ObjectId.isValid(userId)
            ? new mongoose.default.Types.ObjectId(userId)
            : userId,
        },
      },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: "$conversationId",
          lastMessageAt: { $first: "$createdAt" },
          firstMessage: { $last: "$message" },
          messageCount: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 1,
          title: { $substr: ["$firstMessage", 0, 50] },
          lastMessageAt: 1,
          messageCount: 1,
          createdAt: "$lastMessageAt",
        },
      },
      { $sort: { lastMessageAt: -1 } },
      { $limit: 50 },
    ]);

    res.json({ conversations });
  } catch (error) {
    console.error("Error fetching conversations:", error);
    next(error);
  }
});

// Get messages for a specific conversation
router.get(
  "/conversations/:conversationId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const { conversationId } = req.params;

      const messages = await ChatMessage.find({
        userId,
        conversationId,
      })
        .sort({ createdAt: 1 })
        .lean();

      res.json({ messages, conversationId });
    } catch (error) {
      next(error);
    }
  },
);

// Delete a conversation
router.delete(
  "/conversations/:conversationId",
  authMiddleware,
  async (req, res, next) => {
    try {
      const userId = req.userId;
      const { conversationId } = req.params;

      await ChatMessage.deleteMany({
        userId,
        conversationId,
      });

      res.json({ success: true, message: "Conversation deleted" });
    } catch (error) {
      next(error);
    }
  },
);

// TTS endpoint - Convert text to speech
router.post("/tts", authMiddleware, async (req, res, next) => {
  try {
    const { text, voice } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Text is required for TTS" });
    }

    // Limit text length for TTS
    const textToSpeak = text.trim().slice(0, 4096);

    const { audio, contentType } = await synthesizeSpeech(
      textToSpeak,
      voice || "alloy",
    );

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Length", audio.length);
    res.send(audio);
  } catch (error) {
    console.error("TTS endpoint error:", error);
    if (
      error.message.includes("requires") ||
      error.message.includes("not yet available")
    ) {
      res.status(501).json({
        error: "TTS not configured",
        message: error.message,
        fallback: "client-side",
      });
    } else {
      next(error);
    }
  }
});

// Financial query endpoint using AI
router.post("/query", authMiddleware, async (req, res) => {
  try {
    const { query } = req.body;
    const userId = req.userId;

    if (!query || !query.trim()) {
      return res.status(400).json({ error: "Query is required" });
    }

    // Process the query using the query service
    const result = await processFinancialQuery(query, userId);

    // Save the query and response to chat history
    const userMsg = new ChatMessage({
      userId,
      conversationId: uuidv4(),
      sender: "user",
      text: query,
    });
    await userMsg.save();

    const botMsg = new ChatMessage({
      userId,
      conversationId: userMsg.conversationId,
      sender: "assistant",
      text: result.answer,
    });
    await botMsg.save();

    res.status(200).json({
      success: result.success,
      answer: result.answer,
      data: result.data,
      intent: result.intent,
      conversationId: userMsg.conversationId,
    });
  } catch (error) {
    console.error("Error processing query:", error);
    res.status(500).json({
      error: "Failed to process query",
      message: error.message,
    });
  }
});

// Generate business report endpoint
router.post("/generate-report", authMiddleware, async (req, res, next) => {
  try {
    const { timePeriod } = req.body;
    const userId = req.userId;

    if (!timePeriod || !timePeriod.trim()) {
      return res.status(400).json({ error: "Time period is required" });
    }

    // Parse time period
    const dateRange = parseTimePeriod(timePeriod);

    // Generate report
    const reportData = await generateReport(userId, dateRange);

    res.json({
      success: true,
      report: reportData,
      downloadUrl: `/api/chat/download-report?period=${encodeURIComponent(timePeriod)}`,
    });
  } catch (error) {
    console.error("Report generation error:", error);
    next(error);
  }
});

// Download report as CSV
router.get("/download-report", authMiddleware, async (req, res, next) => {
  try {
    const { period } = req.query;
    const userId = req.userId;

    if (!period) {
      return res.status(400).json({ error: "Time period is required" });
    }

    // Parse time period
    const dateRange = parseTimePeriod(period);

    // Generate report
    const reportData = await generateReport(userId, dateRange);

    // Format as CSV
    const csvContent = formatReportAsCSV(reportData);

    // Set headers for download
    const filename = `business-report-${dateRange.label.replace(/\\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.csv`;

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (error) {
    console.error("Report download error:", error);
    next(error);
  }
});

export default router;

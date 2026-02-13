/**
 * Advanced Transaction Extraction Service
 * Extracts structured transaction data from natural language
 */

import { getLLMResponse } from "./llmService.js";

/**
 * Extract structured transaction data from user message
 * @param {string} userMessage - Natural language input (English or Swahili)
 * @returns {Promise<Object>} Extracted transaction data
 */
export async function extractTransactionData(userMessage) {
  const systemPrompt = buildExtractionPrompt();

  try {
    const response = await getLLMResponse(userMessage, systemPrompt, []);

    // Parse the JSON response from LLM
    const jsonMatch = response.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      // Fallback to regex-based extraction
      return fallbackExtraction(userMessage);
    }

    const extracted = JSON.parse(jsonMatch[0]);
    const normalized = validateAndNormalize(extracted);
    return applyTypeHeuristics(userMessage, normalized);
  } catch (error) {
    console.error("LLM extraction failed, using fallback:", error);
    return applyTypeHeuristics(userMessage, fallbackExtraction(userMessage));
  }
}

/**
 * Build extraction prompt based on language
 */
function buildExtractionPrompt() {
  return `You are an intelligent transaction extractor. Extract business transaction data from natural language in ANY language.

Return ONLY valid JSON - no explanations, no markdown.

EXTRACT THESE FIELDS:
- transactionType: "sale", "purchase", "expense", "debt", "loan" or null
- items: array of {name, quantity, unit, unitPrice}
- totalAmount: numeric total
- customerName: name or null
- date: YYYY-MM-DD or null
- notes: string or null  
- paymentStatus: "paid" or "unpaid"
- confidence: 0.0-1.0

RULES:
1. SALE/sold/uza/nimeuza = money IN
2. PURCHASE/bought/nunua/nilinunua = money OUT
3. LOAN/mkopo/deni = LOAN type
4. Other costs = EXPENSE
5. Non-transactions return null transactionType

EXAMPLES:
"I sold 5 tomatoes for 100 each to John"
→ {"transactionType":"sale","items":[{"name":"tomatoes","quantity":5,"unit":"pieces","unitPrice":100}],"totalAmount":500,"customerName":"John","date":null,"notes":null,"paymentStatus":"paid","confidence":0.95}

"Nimeuza nyanya 5 kwa shilingi 100 kila moja"
→ {"transactionType":"sale","items":[{"name":"tomatoes","quantity":5,"unit":"pieces","unitPrice":100}],"totalAmount":500,"customerName":null,"date":null,"notes":null,"paymentStatus":"paid","confidence":0.95}

"How are you?"
→ {"transactionType":null,"items":[],"totalAmount":0,"customerName":null,"date":null,"notes":null,"paymentStatus":null,"confidence":0}

ONLY RETURN JSON, NOTHING ELSE.`;
}

/**
 * Validate and normalize extracted data
 */
function validateAndNormalize(data) {
  // Preserve numeric confidence from LLM, default to 0.9 for valid extractions
  const rawConf = parseFloat(data.confidence);
  const normalized = {
    transactionType: data.transactionType || "sale",
    items: [],
    totalAmount: parseFloat(data.totalAmount) || 0,
    customerName: data.customerName || null,
    date: data.date || null,
    notes: data.notes || null,
    paymentStatus: data.paymentStatus || null,
    confidence: !isNaN(rawConf) ? rawConf : 0.9,
  };

  // Normalize items
  if (Array.isArray(data.items) && data.items.length > 0) {
    normalized.items = data.items.map((item) => ({
      name: (item.name || "").toLowerCase().trim(),
      quantity: parseFloat(item.quantity) || 1,
      unit: (item.unit || "unit").toLowerCase(),
      unitPrice: parseFloat(item.unitPrice) || 0,
      totalPrice:
        parseFloat(item.unitPrice || 0) * parseFloat(item.quantity || 1),
    }));
  } else {
    // If no items extracted, create a generic item
    normalized.items = [
      {
        name: "unspecified item",
        quantity: 1,
        unit: "unit",
        unitPrice: normalized.totalAmount,
        totalPrice: normalized.totalAmount,
      },
    ];
    normalized.confidence = 0.4;
  }

  return normalized;
}

function applyTypeHeuristics(userMessage, normalized) {
  const text = userMessage.toLowerCase();

  const hasSale = /(sold|sale|nimeuza|niuza|uza|umeduza|niliuza)/i.test(text);
  const hasPurchase =
    /(bought|buy|purchase|nilinunua|nunua|nimenunua|stoki)/i.test(text);
  const hasExpense =
    /(expense|spent|paid|matumizi|gharama|rent|salary|umeme|maji|transport)/i.test(
      text,
    );
  const hasDebt = /(debt|deni|owe|anadai|nadai|wadeni)/i.test(text);
  const hasLoan = /(loan|mkopo|nahitaji mkopo)/i.test(text);

  if (hasLoan) {
    normalized.transactionType = "loan";
  } else if (hasDebt) {
    normalized.transactionType = "debt";
  } else if (hasSale) {
    normalized.transactionType = "sale";
  } else if (hasPurchase) {
    normalized.transactionType = "purchase";
  } else if (hasExpense) {
    normalized.transactionType = "expense";
  }

  return normalized;
}

/**
 * Fallback regex-based extraction when LLM fails
 */
function fallbackExtraction(text) {
  const lowerText = text.toLowerCase();

  // Detect transaction type
  let transactionType = "sale";
  if (
    lowerText.includes("bought") ||
    lowerText.includes("purchase") ||
    lowerText.includes("nilinunua") ||
    lowerText.includes("nimenunua") ||
    lowerText.includes("nunua") ||
    lowerText.includes("numenua")
  ) {
    transactionType = "purchase";
  } else if (
    lowerText.includes("expense") ||
    lowerText.includes("spent") ||
    lowerText.includes("matumizi") ||
    lowerText.includes("gharama") ||
    lowerText.includes("nililipia") ||
    lowerText.includes("nimelipa")
  ) {
    transactionType = "expense";
  } else if (
    lowerText.includes("debt") ||
    lowerText.includes("owe") ||
    lowerText.includes("deni") ||
    lowerText.includes("anadai") ||
    lowerText.includes("nadai") ||
    lowerText.includes("wadeni")
  ) {
    transactionType = "debt";
  } else if (
    lowerText.includes("loan") ||
    lowerText.includes("mkopo")
  ) {
    transactionType = "loan";
  } else if (
    lowerText.includes("sold") ||
    lowerText.includes("sale") ||
    lowerText.includes("nimeuza") ||
    lowerText.includes("niliuza") ||
    lowerText.includes("uza") ||
    lowerText.includes("mauzo")
  ) {
    transactionType = "sale";
  }

  // Extract amounts (including Swahili patterns like "kwa 500 bob", "shilingi 1000")
  const amountRegex = /(?:ksh|kes|shilingi|bob)?\s*(\d+(?:,\d{3})*(?:\.\d{2})?)\s*(?:bob|shillings?|shilingi|ksh|kes)?/gi;
  const amounts = [];
  let match;
  while ((match = amountRegex.exec(text)) !== null) {
    amounts.push(parseFloat(match[1].replace(/,/g, "")));
  }
  const totalAmount = amounts[0] || 0;

  // Extract quantities and units
  const quantityRegex =
    /(\d+(?:\.\d+)?)\s*(kg|kilo|pieces|pcs|liters|litres|units?|bags?)/gi;
  const items = [];
  const quantityMatches = [...text.matchAll(quantityRegex)];

  if (quantityMatches.length > 0) {
    quantityMatches.forEach((qMatch) => {
      const quantity = parseFloat(qMatch[1]);
      const unit = normalizeUnit(qMatch[2]);

      // Try to find item name before quantity
      const beforeQuantity = text
        .substring(0, qMatch.index)
        .split(/\s+/)
        .slice(-3)
        .join(" ")
        .toLowerCase();
      const itemName = extractItemName(beforeQuantity) || "item";

      items.push({
        name: itemName,
        quantity,
        unit,
        unitPrice: totalAmount / quantity || 0,
        totalPrice: totalAmount,
      });
    });
  } else {
    // No quantity found, create generic item
    items.push({
      name: extractItemName(lowerText) || "item",
      quantity: 1,
      unit: "unit",
      unitPrice: totalAmount,
      totalPrice: totalAmount,
    });
  }

  // Extract customer name (capitalized words)
  const nameRegex = /(?:to|from|for)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/;
  const nameMatch = text.match(nameRegex);
  const customerName = nameMatch ? nameMatch[1] : null;

  return {
    transactionType,
    items:
      items.length > 0
        ? items
        : [
            {
              name: "unspecified",
              quantity: 1,
              unit: "unit",
              unitPrice: totalAmount,
              totalPrice: totalAmount,
            },
          ],
    totalAmount,
    customerName,
    date: null,
    notes: null,
    confidence: "medium",
  };
}

/**
 * Normalize unit names
 */
function normalizeUnit(unit) {
  const normalized = unit.toLowerCase();
  if (normalized.includes("kilo") || normalized === "kg") return "kg";
  if (normalized.includes("piece") || normalized === "pcs") return "pieces";
  if (normalized.includes("liter") || normalized.includes("litre"))
    return "liters";
  if (normalized.includes("bag")) return "bags";
  return "unit";
}

/**
 * Extract item names from common vegetables/products
 */
function extractItemName(text) {
  const commonItems = {
    // English
    tomato: "tomatoes",
    onion: "onions",
    cabbage: "cabbage",
    carrot: "carrots",
    potato: "potatoes",
    spinach: "spinach",
    kale: "kale",
    lettuce: "lettuce",
    pepper: "peppers",

    // Kiswahili
    nyanya: "tomatoes",
    vitunguu: "onions",
    kabichi: "cabbage",
    karoti: "carrots",
    viazi: "potatoes",
    sukuma: "kale",
    pilipili: "peppers",
    kunde: "beans",
    maharagwe: "beans",
  };

  for (const [key, value] of Object.entries(commonItems)) {
    if (text.includes(key)) return value;
  }

  return null;
}

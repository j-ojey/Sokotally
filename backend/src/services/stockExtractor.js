/**
 * Stock/Inventory Extraction Service
 * Extracts structured stock data from natural language input
 */

import { getLLMResponse } from "./llmService.js";

/**
 * Extract structured stock data from user message
 * @param {string} userMessage - Natural language input (English or Swahili)
 * @returns {Promise<Object>} Extracted stock data
 */
export async function extractStockData(userMessage) {
  const systemPrompt = buildStockExtractionPrompt();

  try {
    const response = await getLLMResponse(userMessage, systemPrompt, []);

    // Parse the JSON response from LLM
    const jsonMatch = response.reply.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return fallbackStockExtraction(userMessage);
    }

    const extracted = JSON.parse(jsonMatch[0]);
    return validateAndNormalizeStock(extracted);
  } catch (error) {
    console.error("LLM stock extraction failed, using fallback:", error);
    return fallbackStockExtraction(userMessage);
  }
}

/**
 * Build stock extraction prompt for both English and Swahili
 */
function buildStockExtractionPrompt() {
  return `You are an intelligent stock/inventory extractor for SokoTally, a small business app in Kenya. Extract inventory data from natural language in ANY language (English or Swahili).

Return ONLY valid JSON - no explanations, no markdown.

EXTRACT THESE FIELDS:
- actionType: "add_stock", "remove_stock", "update_stock", "query_stock" or null
- itemName: string name of the product/item
- quantity: numeric amount
- unit: "kg", "pieces", "bundles", "bags", "sacks", "crates", "liters", "grams", "units"
- buyingPrice: total cost OR per-unit cost (if specified)
- priceType: "total" or "per_unit"
- sellingPrice: suggested/actual selling price per unit (if specified)
- supplierName: name of supplier (if mentioned)
- reorderLevel: minimum stock level (if mentioned)
- notes: additional information
- confidence: 0.0-1.0

RULES:
1. "Bought/Received/Add/Restock/Nunua/Nimepata" = add_stock
2. "Remove/Spoiled/Lost/Ondoa/Imeharibika" = remove_stock
3. "Update/Change/Badilisha" = update_stock
4. "How much/What stock/Nina stock gani" = query_stock
5. Common units: kg (kilos), pieces (vipande), bundles (vishada), bags (magunia)
6. PRICING: "at/for X each/per/kila" = per_unit, "for/kwa X" (no each/per/kila) = total
7. Auto-suggest selling price with 20-30% markup if not specified

EXAMPLES:

"I bought 30kg of tomatoes at 40 shillings per kg from John"
→ {"actionType":"add_stock","itemName":"tomatoes","quantity":30,"unit":"kg","buyingPrice":40,"priceType":"per_unit","sellingPrice":null,"supplierName":"John","reorderLevel":null,"notes":null,"confidence":0.95}

"I bought 30kg of tomatoes for 1200 shillings"
→ {"actionType":"add_stock","itemName":"tomatoes","quantity":30,"unit":"kg","buyingPrice":1200,"priceType":"total","sellingPrice":null,"supplierName":null,"reorderLevel":null,"notes":null,"confidence":0.95}

"Nimepata karoti 50kg kwa 2000 bob"
→ {"actionType":"add_stock","itemName":"carrots","quantity":50,"unit":"kg","buyingPrice":2000,"priceType":"total","sellingPrice":null,"supplierName":null,"reorderLevel":null,"notes":null,"confidence":0.9}

"Nimepata karoti 50kg kwa 40 bob kila kilo"
→ {"actionType":"add_stock","itemName":"carrots","quantity":50,"unit":"kg","buyingPrice":40,"priceType":"per_unit","sellingPrice":null,"supplierName":null,"reorderLevel":null,"notes":null,"confidence":0.95}

"Add 100 pieces of cabbage, bought at 10 per piece, sell at 15"
→ {"actionType":"add_stock","itemName":"cabbage","quantity":100,"unit":"pieces","buyingPrice":10,"priceType":"per_unit","sellingPrice":15,"supplierName":null,"reorderLevel":null,"notes":null,"confidence":0.95}

"Remove 5kg spoiled onions"
→ {"actionType":"remove_stock","itemName":"onions","quantity":5,"unit":"kg","buyingPrice":null,"priceType":null,"sellingPrice":null,"supplierName":null,"reorderLevel":null,"notes":"spoiled","confidence":0.9}

"How much stock of tomatoes do I have?"
→ {"actionType":"query_stock","itemName":"tomatoes","quantity":null,"unit":null,"buyingPrice":null,"priceType":null,"sellingPrice":null,"supplierName":null,"reorderLevel":null,"notes":null,"confidence":0.9}

"Received 20 bunches spinach for 800, minimum 5 bunches"
→ {"actionType":"add_stock","itemName":"spinach","quantity":20,"unit":"bundles","buyingPrice":800,"priceType":"total","sellingPrice":null,"supplierName":null,"reorderLevel":5,"notes":null,"confidence":0.92}

Non-stock messages return null actionType and low confidence.

ONLY RETURN JSON, NOTHING ELSE.`;
}

/**
 * Validate and normalize extracted stock data
 */
function validateAndNormalizeStock(data) {
  const normalized = {
    actionType: data.actionType || null,
    itemName: data.itemName ? data.itemName.toLowerCase().trim() : null,
    quantity: parseFloat(data.quantity) || null,
    unit: data.unit || "pieces",
    buyingPrice: parseFloat(data.buyingPrice) || null,
    priceType: data.priceType || "total",
    sellingPrice: parseFloat(data.sellingPrice) || null,
    supplierName: data.supplierName || null,
    reorderLevel: data.reorderLevel ? parseFloat(data.reorderLevel) : null,
    notes: data.notes || null,
    confidence: parseFloat(data.confidence) || 0,
  };

  // Calculate per-unit buying price if total was given
  if (
    normalized.buyingPrice &&
    normalized.priceType === "total" &&
    normalized.quantity
  ) {
    normalized.buyingPricePerUnit =
      normalized.buyingPrice / normalized.quantity;
  } else if (normalized.buyingPrice && normalized.priceType === "per_unit") {
    normalized.buyingPricePerUnit = normalized.buyingPrice;
    normalized.buyingPrice =
      normalized.buyingPrice * (normalized.quantity || 1);
  }

  // Auto-suggest selling price with 25% markup if not provided
  if (!normalized.sellingPrice && normalized.buyingPricePerUnit) {
    normalized.sellingPrice = Math.ceil(normalized.buyingPricePerUnit * 1.25);
    normalized.autoSuggestedPrice = true;
  }

  return normalized;
}

/**
 * Fallback extraction using regex patterns
 */
function fallbackStockExtraction(message) {
  const lowerMsg = message.toLowerCase();

  // Detect action type
  let actionType = null;
  if (
    /bought|received|add|restock|nunua|nimenunua|nilinunua|numenua|nimepata|pata/i.test(
      lowerMsg,
    )
  ) {
    actionType = "add_stock";
  } else if (/remove|spoiled|lost|ondoa|imeharibika|haribika/i.test(lowerMsg)) {
    actionType = "remove_stock";
  } else if (/update|change|badilisha/i.test(lowerMsg)) {
    actionType = "update_stock";
  } else if (/how much|what stock|nina stock gani|stock ya/i.test(lowerMsg)) {
    actionType = "query_stock";
  }

  // Extract quantity and unit
  const quantityMatch = lowerMsg.match(
    /(\d+(?:\.\d+)?)\s*(kg|kilo|pieces|vipande|bundles|vishada|bags|magunia|sacks|crates|liters|grams|units)?/i,
  );
  const quantity = quantityMatch ? parseFloat(quantityMatch[1]) : null;
  let unit =
    quantityMatch && quantityMatch[2]
      ? quantityMatch[2].toLowerCase()
      : "pieces";

  // Normalize units
  if (/kilo|kg/i.test(unit)) unit = "kg";
  if (/pieces|vipande/i.test(unit)) unit = "pieces";
  if (/bundles|vishada/i.test(unit)) unit = "bundles";
  if (/bags|magunia/i.test(unit)) unit = "bags";

  // Extract prices (basic)
  const priceMatch = lowerMsg.match(
    /(?:kwa|at|for)\s*(\d+(?:\.\d+)?)\s*(?:bob|shillings?|ksh)?/i,
  );
  const buyingPrice = priceMatch ? parseFloat(priceMatch[1]) : null;

  // Detect if price is per unit or total
  const perUnitIndicators = /per|kila|each|@/i;
  const priceType = perUnitIndicators.test(lowerMsg) ? "per_unit" : "total";

  // Extract item name (very basic - between start and quantity)
  let itemName = null;
  const itemMatch = message.match(/(?:of|ya)\s+([a-z]+)/i);
  if (itemMatch) {
    itemName = itemMatch[1].toLowerCase();
  }

  return {
    actionType,
    itemName,
    quantity,
    unit,
    buyingPrice,
    priceType,
    sellingPrice: null,
    supplierName: null,
    reorderLevel: null,
    notes: null,
    confidence: actionType ? 0.6 : 0.3,
  };
}

/**
 * Classify if a message is stock-related or transaction-related
 * @param {string} message - User input
 * @returns {Promise<string>} 'stock', 'transaction', 'query', or 'unknown'
 */
export async function classifyMessage(message) {
  const lowerMsg = message.toLowerCase();

  // Stock indicators
  const stockIndicators = [
    /bought.*?(\d+\s*(?:kg|kilo|pieces|bundles|bags|vipande))/i,
    /bought\s+\d+/i,
    /received.*?stock/i,
    /add.*?(?:to\s+)?stock/i,
    /restock/i,
    /remove.*?stock/i,
    /spoiled/i,
    /imeharibika/i,
    /nimepata.*?(?:kg|kilo|pieces|bundles)/i,
    /nimepata\s+\d+/i,
    /nimenunua\s+/i,
    /nilinunua\s+/i,
    /numenua\s+/i,
    /nunua\s+/i,
    /ni[lm]e?nunua/i,
    /stock\s+(?:ya|of)/i,
  ];

  // Transaction indicators
  const transactionIndicators = [
    /sold/i,
    /nimeuza/i,
    /niliuza/i,
    /uza\b/i,
    /mauzo/i,
    /sale/i,
    /paid/i,
    /lipa/i,
    /nililipia/i,
    /nimelipa/i,
    /expense/i,
    /matumizi/i,
    /gharama/i,
    /debt/i,
    /deni/i,
    /loan/i,
    /mkopo/i,
    /anadai/i,
    /nadai/i,
    /wadeni/i,
    /spent/i,
    /owe/i,
  ];

  // Query indicators
  const queryIndicators = [
    /how much/i,
    /what.*?stock/i,
    /nina stock gani/i,
    /profit/i,
    /sales/i,
  ];

  // Check for stock indicators
  if (stockIndicators.some((pattern) => pattern.test(lowerMsg))) {
    return "stock";
  }

  // Check for query indicators
  if (queryIndicators.some((pattern) => pattern.test(lowerMsg))) {
    return "query";
  }

  // Check for transaction indicators
  if (transactionIndicators.some((pattern) => pattern.test(lowerMsg))) {
    return "transaction";
  }

  return "unknown";
}

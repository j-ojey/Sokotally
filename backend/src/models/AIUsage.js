import mongoose from "mongoose";

/**
 * AI Usage Tracking
 * Monitors Soko Assistant AI interactions
 */
const aiUsageSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    sessionId: { type: String },
    messageType: {
      type: String,
      enum: [
        "chat",
        "text",
        "voice",
        "transaction_parsing",
        "keyword_extraction",
        "suggestion",
      ],
      required: true,
    },
    tokensUsed: { type: Number, default: 0 },
    model: { type: String, default: "gemini-1.5-flash" },
    responseTime: { type: Number }, // milliseconds
    success: { type: Boolean, default: true },
    errorMessage: { type: String },
    metadata: { type: Object, default: {} },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

aiUsageSchema.index({ userId: 1, timestamp: -1 });
aiUsageSchema.index({ messageType: 1, timestamp: -1 });

export const AIUsage = mongoose.model("AIUsage", aiUsageSchema);

/**
 * LLM Service - Multi-provider support
 */

export async function getLLMResponse(
  userMessage,
  systemPrompt,
  conversationHistory = [],
) {
  const provider = process.env.LLM_PROVIDER || "placeholder";

  try {
    switch (provider) {
      case "openai":
        return await getOpenAIResponse(
          userMessage,
          systemPrompt,
          conversationHistory,
        );
      case "anthropic":
        return await getAnthropicResponse(
          userMessage,
          systemPrompt,
          conversationHistory,
        );
      case "groq":
        return await getGroqResponse(
          userMessage,
          systemPrompt,
          conversationHistory,
        );
      case "ollama":
        return await getOllamaResponse(
          userMessage,
          systemPrompt,
          conversationHistory,
        );
      default:
        return getPlaceholderResponse(userMessage);
    }
  } catch (error) {
    console.error("LLM Error:", error);
    // Return the actual error message instead of hiding it
    return {
      reply: `Sorry, I'm having trouble right now. Error: ${error.message || "Unknown error"}. Please try again.`,
      model: provider,
      tokensUsed: 0,
    };
  }
}

async function getOpenAIResponse(
  userMessage,
  systemPrompt,
  conversationHistory,
) {
  const { default: OpenAI } = await import("openai");
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const messages = [{ role: "system", content: systemPrompt }];

  conversationHistory.forEach((msg) => {
    messages.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.message,
    });
  });

  messages.push({ role: "user", content: userMessage });

  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    messages,
    temperature: 0.7,
    max_tokens: 500,
  });

  return {
    reply: completion.choices[0].message.content,
    model: completion.model,
    tokensUsed: completion.usage.total_tokens,
  };
}

async function getAnthropicResponse(
  userMessage,
  systemPrompt,
  conversationHistory,
) {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages = [];
  conversationHistory.forEach((msg) => {
    messages.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.message,
    });
  });
  messages.push({ role: "user", content: userMessage });

  const response = await anthropic.messages.create({
    model: process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20241022",
    max_tokens: 500,
    system: systemPrompt,
    messages,
  });

  return {
    reply: response.content[0].text,
    model: response.model,
    tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
  };
}

async function getGroqResponse(userMessage, systemPrompt, conversationHistory) {
  const { default: Groq } = await import("groq-sdk");
  const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

  const messages = [{ role: "system", content: systemPrompt }];

  // Limit conversation history to save tokens
  const recentHistory = conversationHistory.slice(-5);
  recentHistory.forEach((msg) => {
    messages.push({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.message,
    });
  });

  messages.push({ role: "user", content: userMessage });

  const primaryModel = process.env.GROQ_MODEL || "llama-3.1-8b-instant";
  const fallbackModel = "llama-3.1-8b-instant";

  try {
    const completion = await groq.chat.completions.create({
      model: primaryModel,
      messages,
      temperature: 0.7,
      max_tokens: 300,
    });

    return {
      reply: completion.choices[0].message.content,
      model: completion.model,
      tokensUsed: completion.usage.total_tokens,
    };
  } catch (error) {
    // If rate limited on primary model, try fallback
    if (error.status === 429 && primaryModel !== fallbackModel) {
      console.log(`Rate limited on ${primaryModel}, trying ${fallbackModel}...`);
      const completion = await groq.chat.completions.create({
        model: fallbackModel,
        messages,
        temperature: 0.7,
        max_tokens: 200,
      });
      return {
        reply: completion.choices[0].message.content,
        model: completion.model,
        tokensUsed: completion.usage.total_tokens,
      };
    }
    throw error;
  }
}

async function getOllamaResponse(
  userMessage,
  systemPrompt,
  conversationHistory,
) {
  const ollamaUrl = process.env.OLLAMA_URL || "http://localhost:11434";
  const model = process.env.OLLAMA_MODEL || "llama2";

  let prompt = systemPrompt + "\n\n";
  conversationHistory.forEach((msg) => {
    prompt += `${msg.sender === "user" ? "User" : "Assistant"}: ${
      msg.message
    }\n`;
  });
  prompt += `User: ${userMessage}\nAssistant:`;

  const response = await fetch(`${ollamaUrl}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, prompt, stream: false }),
  });

  const data = await response.json();
  return {
    reply: data.response,
    model,
    tokensUsed: null,
  };
}

function getPlaceholderResponse(userMessage) {
  throw new Error(
    'LLM_PROVIDER not configured. Please set LLM_PROVIDER environment variable to "openai", "anthropic", "groq", or "ollama" and configure the corresponding API key.',
  );
}

export async function transcribeAudio(audioPath) {
  const provider = process.env.STT_PROVIDER || "groq";

  try {
    // Check if it's a URL (Cloudinary) - need to download first
    let localAudioPath = audioPath;
    let tempFile = null;

    if (audioPath.startsWith("http://") || audioPath.startsWith("https://")) {
      // Download from Cloudinary to temp file
      const axios = (await import("axios")).default;
      const fs = await import("fs");
      const path = await import("path");
      const os = await import("os");

      const tempDir = os.tmpdir();
      tempFile = path.join(tempDir, `audio-${Date.now()}.webm`);

      const response = await axios({
        method: "get",
        url: audioPath,
        responseType: "stream",
      });

      const writer = fs.createWriteStream(tempFile);
      response.data.pipe(writer);

      await new Promise((resolve, reject) => {
        writer.on("finish", resolve);
        writer.on("error", reject);
      });

      localAudioPath = tempFile;
    }

    let result;

    if (provider === "groq" && process.env.GROQ_API_KEY) {
      const { default: Groq } = await import("groq-sdk");
      const fs = await import("fs");
      const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

      const transcription = await groq.audio.transcriptions.create({
        file: fs.createReadStream(localAudioPath),
        model: "whisper-large-v3",
        temperature: 0,
        response_format: "verbose_json",
        prompt:
          "Business transaction recording in English and Kiswahili. May include product names, quantities, prices, and customer names.", // Context for better accuracy
      });

      result = {
        text: transcription.text,
        language: transcription.language,
        duration: transcription.duration,
      };
    } else if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const { default: OpenAI } = await import("openai");
      const fs = await import("fs");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const transcription = await openai.audio.transcriptions.create({
        file: fs.createReadStream(localAudioPath),
        model: "whisper-1",
        prompt: "Business transaction recording in English and Kiswahili.",
      });

      result = { text: transcription.text };
    } else {
      throw new Error(
        "Transcription requires either GROQ_API_KEY or OPENAI_API_KEY configuration",
      );
    }

    // Clean up temp file if created
    if (tempFile) {
      const fs = await import("fs");
      fs.unlinkSync(tempFile);
    }

    return result;
  } catch (error) {
    console.error("Transcription error:", error);
    throw error;
  }
}

/**
 * Text-to-Speech synthesis
 * Converts text to audio using configured TTS provider
 */
export async function synthesizeSpeech(text, voice = "alloy") {
  const provider = process.env.TTS_PROVIDER || "openai";

  try {
    if (provider === "openai" && process.env.OPENAI_API_KEY) {
      const { default: OpenAI } = await import("openai");
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const mp3 = await openai.audio.speech.create({
        model: "tts-1",
        voice: voice, // alloy, echo, fable, onyx, nova, shimmer
        input: text,
        speed: 1.0,
      });

      // Return buffer for streaming
      const buffer = Buffer.from(await mp3.arrayBuffer());
      return {
        audio: buffer,
        contentType: "audio/mpeg",
      };
    } else if (provider === "groq" && process.env.GROQ_API_KEY) {
      // Groq doesn't have native TTS yet, fallback to client-side or return error
      throw new Error(
        "Groq TTS not yet available. Use client-side TTS or configure OpenAI.",
      );
    } else {
      throw new Error(
        "TTS requires OPENAI_API_KEY configuration. Set TTS_PROVIDER=openai",
      );
    }
  } catch (error) {
    console.error("TTS error:", error);
    throw error;
  }
}

import React, { useState, useRef, useEffect, useCallback } from "react";
import { getValidToken } from "../storage/auth";
import { API_BASE } from "../config/api";

const SokoAssistant = () => {
  const [currentConversationId, setCurrentConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState(null);

  const [recordingDuration, setRecordingDuration] = useState(0);
  const [pendingTransaction, setPendingTransaction] = useState(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [pendingStock, setPendingStock] = useState(null);
  const [showStockConfirmation, setShowStockConfirmation] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const messagesEndRef = useRef(null);
  const prevMessagesCount = useRef(messages.length);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const recordingIntervalRef = useRef(null);
  const recognitionRef = useRef(null);
  const interimTranscriptRef = useRef("");
  const silenceTimerRef = useRef(null);

  // --- TTS (Google Web Speech Synthesis) ---
  const handleSpeak = useCallback(
    (text, messageId) => {
      if (!window.speechSynthesis) return;

      // If already speaking this message, stop it
      if (speakingMessageId === messageId) {
        window.speechSynthesis.cancel();
        setSpeakingMessageId(null);
        return;
      }

      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      // Detect language: if text has Swahili-common words, use sw-KE
      const swahiliPattern =
        /\b(habari|asante|karibu|ndio|hapana|sawa|duka|bidhaa|bei|shilingi|ksh|umeuz|umenunua|nimekuelewa|safi|poa|basi|kwa|na|ya|wa|ni|la|au)\b/i;
      const lang = swahiliPattern.test(text) ? "sw-KE" : "en-US";

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = lang;
      utterance.rate = 0.95;
      utterance.pitch = 1;

      // Try to pick a good voice for the language
      const voices = window.speechSynthesis.getVoices();
      const match = voices.find((v) => v.lang.startsWith(lang.split("-")[0]));
      if (match) utterance.voice = match;

      utterance.onend = () => setSpeakingMessageId(null);
      utterance.onerror = () => setSpeakingMessageId(null);

      setSpeakingMessageId(messageId);
      window.speechSynthesis.speak(utterance);
    },
    [speakingMessageId],
  );

  // Cleanup TTS on unmount
  useEffect(() => {
    return () => {
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Only auto-scroll when new messages are appended (not on initial load)
  useEffect(() => {
    if (messages.length > prevMessagesCount.current) {
      scrollToBottom();
    }
    prevMessagesCount.current = messages.length;
  }, [messages.length]);

  // Load full history on mount
  useEffect(() => {
    loadHistory();
  }, []);

  // Cleanup voice recording on unmount
  useEffect(() => {
    return () => {
      if (silenceTimerRef.current) {
        clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = null;
      }
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      if (
        mediaRecorderRef.current &&
        mediaRecorderRef.current.state !== "inactive"
      ) {
        mediaRecorderRef.current.stop();
      }
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
    };
  }, []);

  // Load complete chat history
  const loadHistory = async () => {
    try {
      const token = getValidToken();
      if (!token) return;

      const response = await fetch(`${API_BASE}/chat/history?limit=200`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });

      if (response.ok) {
        const data = await response.json();
        const loadedMessages = (data.messages || []).map((msg) => ({
          id: msg._id,
          type: msg.sender === "user" ? "user" : "ai",
          content: msg.message,
          timestamp: msg.createdAt,
          conversationId: msg.conversationId,
        }));

        setMessages(loadedMessages);
        const lastConversationId = loadedMessages.length
          ? loadedMessages[loadedMessages.length - 1].conversationId
          : null;
        setCurrentConversationId(lastConversationId || null);
      }
    } catch (error) {
      console.error("Failed to load chat history:", error);
    }
  };

  // Call backend API for chat completions
  const sendToBackend = async (userMessage) => {
    try {
      const token = getValidToken();

      if (!token) {
        throw new Error("You are not logged in. Please sign in to continue.");
      }

      const response = await fetch(`${API_BASE}/chat/message`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          text: userMessage,
          conversationId: currentConversationId,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));

        if (response.status === 401 || errorData.code === "INVALID_TOKEN") {
          throw new Error(
            "Your session has expired. Please log out and log back in.",
          );
        }

        throw new Error(errorData.error || "Failed to get response from AI");
      }

      const data = await response.json();

      // Update conversation ID if it's a new conversation
      if (data.conversationId && !currentConversationId) {
        setCurrentConversationId(data.conversationId);
      }

      // Check if there's a pending transaction that needs confirmation
      if (data.pendingTransaction) {
        setPendingTransaction({
          ...data.pendingTransaction,
          conversationId: data.conversationId,
          userMessage: userMessage,
        });
        setShowConfirmation(true);
        // Return a brief acknowledgment — the confirmation card handles the details
        const txType =
          data.pendingTransaction.type === "income"
            ? "sale"
            : data.pendingTransaction.type === "expense"
              ? "expense"
              : "transaction";
        return `I detected a ${txType} of KES ${data.pendingTransaction.amount?.toLocaleString()}. Please confirm below.`;
      }

      if (data.pendingStock) {
        setPendingStock({
          ...data.pendingStock,
          conversationId: data.conversationId,
          userMessage: userMessage,
        });
        setShowStockConfirmation(true);
        // Return a brief acknowledgment — the confirmation card handles the details
        return `I detected a stock update for ${data.pendingStock.itemName}. Please confirm below.`;
      }

      return data.reply;
    } catch (error) {
      console.error("API error:", error);
      throw error;
    }
  };

  // Core send function that accepts text directly (used by auto-send)
  const sendMessage = async (messageText) => {
    if (!messageText.trim() || isLoading) return;

    // Block new messages while a confirmation is pending
    if (showConfirmation || showStockConfirmation) return;

    const userMessage = {
      id: Date.now(),
      type: "user",
      content: messageText.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      console.log("[SEND] Sending message:", messageText);
      const aiResponseText = await sendToBackend(messageText.trim());
      const aiResponse = {
        id: Date.now() + 1,
        type: "ai",
        content: aiResponseText,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    } catch (error) {
      console.error("[SEND] Error:", error);
      const errorResponse = {
        id: Date.now() + 1,
        type: "ai",
        content:
          error.message ||
          "I'm sorry, I couldn't process your request right now. Please check your internet connection and try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorResponse]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;
    await sendMessage(inputValue);
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Confirm transaction
  const handleConfirmTransaction = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      const token = getValidToken();

      const response = await fetch(`${API_BASE}/chat/confirm-transaction`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          transactionData: {
            ...pendingTransaction,
            conversationText: pendingTransaction.userMessage,
          },
          conversationId: pendingTransaction.conversationId,
        }),
      });

      if (response.ok) {
        await response.json();
        const confirmMessage = {
          id: Date.now() + 2,
          type: "ai",
          content: `Transaction recorded successfully! ${
            pendingTransaction.type === "income"
              ? "Sale"
              : pendingTransaction.type === "expense"
                ? "Expense"
                : "Transaction"
          } of KES ${pendingTransaction.amount.toLocaleString()} saved.`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmMessage]);
      } else {
        throw new Error("Failed to save transaction");
      }
    } catch {
      const errorMessage = {
        id: Date.now() + 2,
        type: "ai",
        content: "Sorry, I couldn't save the transaction. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setShowConfirmation(false);
      setPendingTransaction(null);
      setIsConfirming(false);
    }
  };

  const handleConfirmStock = async () => {
    if (isConfirming) return;
    setIsConfirming(true);
    try {
      const token = getValidToken();

      const response = await fetch(`${API_BASE}/chat/confirm-stock`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          stockData: pendingStock,
          conversationId: pendingStock.conversationId,
        }),
      });

      if (response.ok) {
        const confirmMessage = {
          id: Date.now() + 3,
          type: "ai",
          content: `Stock updated successfully! ${pendingStock.actionType.replace("_", " ")} for ${pendingStock.itemName} (${pendingStock.quantity} ${pendingStock.unit}).`,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, confirmMessage]);
      } else {
        throw new Error("Failed to save stock update");
      }
    } catch {
      const errorMessage = {
        id: Date.now() + 3,
        type: "ai",
        content: "Sorry, I couldn't save the stock update. Please try again.",
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
    } finally {
      setShowStockConfirmation(false);
      setPendingStock(null);
      setIsConfirming(false);
    }
  };

  const handleCancelStock = () => {
    const cancelMessage = {
      id: Date.now() + 3,
      type: "ai",
      content:
        "No problem! Stock update not saved. Let me know if you need anything else.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);
    setShowStockConfirmation(false);
    setPendingStock(null);
  };

  // Cancel transaction
  const handleCancelTransaction = () => {
    const cancelMessage = {
      id: Date.now() + 2,
      type: "ai",
      content:
        "No problem! Transaction not saved. Let me know if you need anything else.",
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, cancelMessage]);
    setShowConfirmation(false);
    setPendingTransaction(null);
  };

  // Voice recording functionality (MediaRecorder + backend transcription)
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const startVoiceRecording = async () => {
    if (isRecording) return;

    // Check for Web Speech API support
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert(
        "Speech recognition is not supported in your browser. Please use Chrome, Brave, Edge, or Safari.",
      );
      return;
    }

    try {
      const recognition = new SpeechRecognition();

      // Configure for Kiswahili with English fallback
      recognition.lang = "sw-KE"; // Primary: Kiswahili (Kenya)
      recognition.continuous = true; // Keep listening
      recognition.interimResults = true; // Get partial results
      recognition.maxAlternatives = 3; // Get multiple alternatives

      interimTranscriptRef.current = "";
      const SILENCE_DELAY = 1500; // Stop after 1.5 seconds of silence

      recognition.onstart = () => {
        setIsRecording(true);
        setRecordingDuration(0);
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
        }
        recordingIntervalRef.current = setInterval(() => {
          setRecordingDuration((prev) => prev + 1);
        }, 1000);
      };

      recognition.onresult = (event) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript + " ";
          } else {
            interimTranscript += transcript;
          }
        }

        // Update input with interim results (show what's being recognized)
        if (interimTranscript) {
          setInputValue(interimTranscriptRef.current + interimTranscript);

          // Reset silence timer on new speech
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
        }

        // Add final transcript to accumulated text
        if (finalTranscript) {
          interimTranscriptRef.current += finalTranscript;
          setInputValue(interimTranscriptRef.current);

          // Start silence detection timer
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
          }
          silenceTimerRef.current = setTimeout(() => {
            // User stopped speaking - automatically send message
            if (interimTranscriptRef.current.trim()) {
              recognition.stop();
            }
          }, SILENCE_DELAY);
        }
      };

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error);

        // Handle different error types
        if (event.error === "network") {
          console.warn(
            "Network error - Speech recognition requires internet connection",
          );
          // Don't show alert for network errors, just stop recording
          setIsRecording(false);
          // Show message in the input instead
          if (!inputValue) {
            setInputValue(
              "(Network error - please check your internet connection and try again)",
            );
            setTimeout(() => setInputValue(""), 3000);
          }
        } else if (
          event.error === "not-allowed" ||
          event.error === "service-not-allowed"
        ) {
          alert(
            "Microphone access denied. Please allow microphone permissions in your browser settings.",
          );
          setIsRecording(false);
        } else if (event.error === "language-not-supported") {
          // Try falling back to English
          recognition.lang = "en-US";
          console.log("Kiswahili not supported, falling back to English");
        } else if (event.error === "no-speech") {
          console.log("No speech detected");
          setIsRecording(false);
        } else if (event.error !== "aborted") {
          console.error("Unhandled speech recognition error:", event.error);
          setIsRecording(false);
        }
      };

      recognition.onend = () => {
        if (recordingIntervalRef.current) {
          clearInterval(recordingIntervalRef.current);
          recordingIntervalRef.current = null;
        }
        setIsRecording(false);

        // Auto-send using the transcript from the ref directly
        const finalText = interimTranscriptRef.current.trim();
        interimTranscriptRef.current = "";
        if (finalText) {
          console.log("[VOICE] Auto-sending transcript:", finalText);
          sendMessage(finalText);
        }
      };

      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      console.error("Voice recognition setup error:", err);
      alert(
        "Failed to start voice recognition. Please check microphone permissions.",
      );
    }
  };

  const stopVoiceRecording = () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    if (recognitionRef.current && isRecording) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    // Clear the accumulated transcript
    interimTranscriptRef.current = "";
  };

  const handleVoiceButton = () => {
    if (isRecording) {
      stopVoiceRecording();
    } else {
      startVoiceRecording();
    }
  };

  const formatTimestamp = (value) => {
    if (!value) return "";
    const date = new Date(value);
    return date.toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Format message content to make URLs clickable
  const formatMessageContent = (content) => {
    if (!content) return "";

    // Regular expression to match URLs
    const urlRegex = /(https?:\/\/[^\s]+|http:\/\/localhost:\d+\/[^\s]+)/g;

    // Split content by URLs
    const parts = content.split(urlRegex);

    return parts.map((part, index) => {
      // If this part is a URL, make it a clickable link
      if (part && part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 underline hover:text-blue-800 dark:hover:text-blue-300"
          >
            {part.includes("download-report")
              ? "📥 Download CSV Report"
              : "Open Link"}
          </a>
        );
      }
      // Otherwise, return the text as-is
      return part;
    });
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-slate-900 overflow-hidden">
      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="bg-white dark:bg-slate-900 border-b border-gray-200 dark:border-slate-800 px-4 md:px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-lg md:text-xl font-semibold text-gray-900 dark:text-white">
              Assistant
            </h1>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Your full chat history is saved here
            </p>
          </div>
        </div>

        {/* Chat Content */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full flex flex-col w-full relative">
            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 md:px-8 py-8 space-y-5 max-w-5xl mx-auto w-full">
              {messages.map((message) => (
                <div key={message.id} className="space-y-2">
                  {message.type === "user" ? (
                    <div className="flex justify-end">
                      <div className="bg-gray-900 text-white px-5 py-3 rounded-2xl rounded-tr-sm max-w-[85%] md:max-w-[70%] shadow-sm">
                        <p className="text-sm md:text-base leading-relaxed">
                          {message.content}
                        </p>
                        <p className="text-[11px] text-gray-300 mt-2 text-right">
                          {formatTimestamp(message.timestamp)}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-start gap-3">
                        <div className="w-9 h-9 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center shrink-0">
                          <span className="text-gray-700 dark:text-gray-300 text-sm font-semibold">
                            A
                          </span>
                        </div>
                        <div className="flex-1 max-w-[85%] md:max-w-[75%]">
                          <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 px-5 py-3 rounded-2xl rounded-tl-sm shadow-sm">
                            <div className="text-sm md:text-base text-gray-900 dark:text-slate-100 whitespace-pre-wrap leading-relaxed">
                              {formatMessageContent(message.content)}
                            </div>
                            <div className="flex items-center justify-between mt-2">
                              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                                {formatTimestamp(message.timestamp)}
                              </p>
                              <button
                                onClick={() =>
                                  handleSpeak(message.content, message.id)
                                }
                                className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
                                title={
                                  speakingMessageId === message.id
                                    ? "Stop"
                                    : "Listen"
                                }
                              >
                                {speakingMessageId === message.id ? (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                    className="text-blue-500"
                                  >
                                    <rect
                                      x="6"
                                      y="5"
                                      width="4"
                                      height="14"
                                      rx="1"
                                    />
                                    <rect
                                      x="14"
                                      y="5"
                                      width="4"
                                      height="14"
                                      rx="1"
                                    />
                                  </svg>
                                ) : (
                                  <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    width="14"
                                    height="14"
                                    viewBox="0 0 24 24"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
                                  >
                                    <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
                                    <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
                                    <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
                                  </svg>
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {isLoading && (
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-gray-100 dark:bg-slate-800 border border-gray-200 dark:border-slate-700 flex items-center justify-center">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                      className="text-gray-600 dark:text-gray-300"
                    >
                      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                    </svg>
                  </div>
                  <div className="bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 px-4 py-3 rounded-2xl rounded-tl-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 animate-bounce"></div>
                      <div
                        className="w-2 h-2 bg-gray-400 animate-bounce"
                        style={{ animationDelay: "0.2s" }}
                      ></div>
                      <div
                        className="w-2 h-2 bg-gray-400 animate-bounce"
                        style={{ animationDelay: "0.4s" }}
                      ></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="border-t border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 sm:p-6">
              <div className="max-w-5xl mx-auto">
                {/* Recording Status */}
                {isRecording && (
                  <div className="text-center mb-3">
                    <p className="text-red-400 text-sm font-medium animate-pulse">
                      🎤 Listening... (Kiswahili/English) •{" "}
                      {formatDuration(recordingDuration)}. Tap mic to stop.
                    </p>
                  </div>
                )}
                {!isRecording && isLoading && (
                  <div className="text-center mb-3">
                    <p className="text-blue-400 text-sm font-medium">
                      Thinking...
                    </p>
                  </div>
                )}
                <div className="flex items-end gap-2 sm:gap-3">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Ask me anything about your business..."
                      className="w-full bg-white dark:bg-slate-900 border border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 rounded-xl px-5 sm:px-6 py-3.5 sm:py-4 text-sm sm:text-base text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-gray-900/10 focus:border-gray-900 dark:focus:border-white transition"
                    />
                  </div>

                  {/* Voice Button */}
                  <button
                    onClick={handleVoiceButton}
                    disabled={isLoading}
                    className={`p-3 sm:p-4 border border-gray-300 dark:border-slate-700 hover:border-gray-400 dark:hover:border-slate-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white transition flex items-center justify-center shrink-0 ${
                      isRecording
                        ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                        : "bg-white dark:bg-slate-900 hover:bg-gray-50 dark:hover:bg-slate-800"
                    }`}
                    title={
                      isRecording
                        ? "Stop listening"
                        : "Start voice input (Kiswahili/English) - Requires internet"
                    }
                  >
                    <svg
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                      {isRecording && (
                        <>
                          <circle
                            cx="12"
                            cy="12"
                            r="8"
                            fill="currentColor"
                            opacity="0.2"
                          />
                          <circle
                            cx="12"
                            cy="12"
                            r="4"
                            fill="currentColor"
                            opacity="0.4"
                          />
                        </>
                      )}
                    </svg>
                  </button>

                  <button
                    onClick={handleSendMessage}
                    disabled={isLoading || !inputValue.trim()}
                    className="px-5 sm:px-7 py-3.5 sm:py-4 bg-gray-900 hover:bg-gray-800 disabled:bg-gray-400 dark:disabled:bg-slate-700 disabled:cursor-not-allowed rounded-xl text-white font-semibold text-sm sm:text-base transition flex items-center gap-2 shrink-0"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="hidden sm:block"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="sm:hidden"
                    >
                      <line x1="22" y1="2" x2="11" y2="13" />
                      <polygon points="22 2 15 22 11 13 2 9 22 2" />
                    </svg>
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
                <p className="text-center text-slate-500 text-xs sm:text-sm mt-4">
                  <span>
                    Ask specific questions or tell me about your sales • Voice
                    input (Kiswahili/English) requires internet connection
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Transaction Confirmation Modal */}
      {showConfirmation && pendingTransaction && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-slate-700 overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
              <h3 className="text-xl font-bold text-white">
                Confirm Transaction
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                Please verify the details below
              </p>
            </div>

            {/* Transaction Details */}
            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                    Type:
                  </span>
                  <span className="text-gray-900 dark:text-white font-bold capitalize">
                    {pendingTransaction.type === "income"
                      ? "Sale"
                      : pendingTransaction.type === "expense"
                        ? "Expense"
                        : pendingTransaction.type}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                    Amount:
                  </span>
                  <span className="text-2xl font-bold text-gray-900 dark:text-white">
                    KES {pendingTransaction.amount.toLocaleString()}
                  </span>
                </div>

                {pendingTransaction.items &&
                  pendingTransaction.items.length > 0 && (
                    <div className="border-t border-gray-200 dark:border-slate-700 pt-3 mt-3">
                      <span className="text-gray-600 dark:text-slate-400 text-sm font-medium block mb-2">
                        Items:
                      </span>
                      <div className="space-y-2">
                        {pendingTransaction.items.map((item, index) => (
                          <div
                            key={index}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-700 dark:text-slate-300">
                              {item.quantity} {item.unit} {item.name}
                            </span>
                            <span className="text-gray-900 dark:text-white font-medium">
                              @ {item.unitPrice.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                {pendingTransaction.customerName && (
                  <div className="flex justify-between items-center border-t border-gray-200 dark:border-slate-700 pt-3">
                    <span className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                      Customer:
                    </span>
                    <span className="text-gray-900 dark:text-white font-medium">
                      {pendingTransaction.customerName}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelTransaction}
                  className="flex-1 px-6 py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-xl font-bold transition-all"
                >
                  No, Cancel
                </button>
                <button
                  onClick={handleConfirmTransaction}
                  disabled={isConfirming}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? "Saving..." : "Yes, Save It"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stock Confirmation Modal */}
      {showStockConfirmation && pendingStock && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full border border-gray-200 dark:border-slate-700 overflow-hidden">
            <div className="bg-gradient-to-r from-green-600 to-blue-600 p-6">
              <h3 className="text-xl font-bold text-white">
                Confirm Stock Update
              </h3>
              <p className="text-blue-100 text-sm mt-1">
                Please verify the stock details below
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                    Action:
                  </span>
                  <span className="text-gray-900 dark:text-white font-bold capitalize">
                    {pendingStock.actionType.replace("_", " ")}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                    Item:
                  </span>
                  <span className="text-gray-900 dark:text-white font-bold">
                    {pendingStock.itemName}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                    Quantity:
                  </span>
                  <span className="text-gray-900 dark:text-white font-bold">
                    {pendingStock.quantity} {pendingStock.unit}
                  </span>
                </div>
                {pendingStock.supplierName && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600 dark:text-slate-400 text-sm font-medium">
                      Supplier:
                    </span>
                    <span className="text-gray-900 dark:text-white font-bold">
                      {pendingStock.supplierName}
                    </span>
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelStock}
                  className="flex-1 px-6 py-3 bg-gray-200 dark:bg-slate-700 hover:bg-gray-300 dark:hover:bg-slate-600 text-gray-900 dark:text-white rounded-xl font-bold transition-all"
                >
                  No, Cancel
                </button>
                <button
                  onClick={handleConfirmStock}
                  disabled={isConfirming}
                  className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white rounded-xl font-bold shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isConfirming ? "Saving..." : "Yes, Save It"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SokoAssistant;

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles, Check, Trash2 } from "lucide-react";
import type { ChatMessage, AgentCommand, DayPlan } from "../../types";
import ConfirmModal from "./ConfirmModal";

interface ChatAssistantProps {
  itinerary: DayPlan[] | null;
  selectedDates: string[];
  region: string[];
  audience: string;
  budget: string;
  onExecuteCommand: (command: AgentCommand) => void;
}

export default function ChatAssistant({
  itinerary,
  selectedDates,
  region,
  audience,
  budget,
  onExecuteCommand
}: ChatAssistantProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load messages from localStorage on mount
  useEffect(() => {
    const saved = localStorage.getItem("chat_messages");
    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load chat messages", e);
      }
    }
  }, []);

  // Save capped messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      // Cap at 50 messages to save space
      const capped = messages.slice(-50);
      localStorage.setItem("chat_messages", JSON.stringify(capped));
    }
  }, [messages]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Keyboard accessibility: Escape to close chat drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClearChat = () => {
    setShowClearConfirm(true);
  };

  const handleConfirmClear = () => {
    setMessages([]);
    localStorage.removeItem("chat_messages");
    setShowClearConfirm(false);
  };

  const handleChipClick = (suggestion: string) => {
    setInputValue(suggestion);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessageText = inputValue.trim();
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: userMessageText,
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}/api/v2/agent`
        : "/api/v2/agent";

      // Token-saving N-turn history transmission (last 5 rounds / 10 messages)
      // Stripping heavy commands metadata to minimize payload and save LLM token usage
      const historyToClean = messages.slice(-10);
      const chatHistory = historyToClean.map(m => ({
        role: m.role,
        content: m.content
      }));

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: userMessageText,
          currentItinerary: itinerary,
          selectedDates,
          region,
          audience,
          budget,
          chatHistory // Send the cleaned conversation history
        })
      });

      // Special Rate Limit UI Handling
      if (response.status === 429) {
        throw new Error("You have reached the daily limit of 40 requests. Please try again tomorrow!");
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `API error: ${response.status}`);
      }

      const data = await response.json();

      if (data.success) {
        const agentMessage: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "agent",
          content: data.message,
          timestamp: Date.now(),
          commands: data.commands || [],
          provider: data.provider,
          model: data.model
        };

        setMessages(prev => [...prev, agentMessage]);

        // Execute commands if any
        if (data.commands && data.commands.length > 0) {
          for (const command of data.commands) {
            onExecuteCommand(command);
            showNotification(getCommandNotificationText(command));
          }
        }
      } else {
        throw new Error(data.message || "Failed to get response");
      }
    } catch (error) {
      console.error("Chat error:", error);
      const errorMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "agent",
        content: error instanceof Error ? error.message : "Sorry, I encountered an error. Please try again.",
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const showNotification = (text: string) => {
    setNotification(text);
    setTimeout(() => setNotification(null), 4000);
  };

  const getCommandNotificationText = (command: AgentCommand): string => {
    switch (command.type) {
      case "ADD":
        return "✨ Activity added to your itinerary";
      case "REMOVE":
        return "🗑️ Activity removed from your itinerary";
      case "SWAP":
        return "🔄 Activity swapped in your itinerary";
      default:
        return "✅ Itinerary updated";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <motion.button
        className="chat-button"
        onClick={() => setIsOpen(!isOpen)}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.5, type: "spring", stiffness: 260, damping: 20 }}
        aria-label="Toggle planner assistant chat"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div
              key="close"
              initial={{ rotate: -90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: 90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <X size={28} strokeWidth={2.5} />
            </motion.div>
          ) : (
            <motion.div
              key="open"
              initial={{ rotate: 90, opacity: 0 }}
              animate={{ rotate: 0, opacity: 1 }}
              exit={{ rotate: -90, opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <MessageCircle size={28} strokeWidth={2.5} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.button>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="chat-panel"
            role="dialog"
            aria-label="AI Planner Assistant"
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="chat-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 dark:text-white">AI Assistant</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Itinerary Copilot</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {messages.length > 0 && (
                  <button
                    onClick={handleClearChat}
                    className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
                    title="Clear conversation"
                  >
                    <Trash2 size={18} className="text-gray-500 hover:text-red-500 dark:text-gray-400 dark:hover:text-red-400" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/5 flex items-center justify-center transition-colors"
                  aria-label="Close assistant panel"
                >
                  <X size={20} className="text-gray-600 dark:text-gray-400" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 dark:text-gray-400 text-sm py-6">
                  <Sparkles size={32} className="mx-auto mb-3 text-blue-400" />
                  <p className="font-semibold mb-1 text-gray-800 dark:text-white">Hi! I'm your interactive AI Copilot</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 px-4 mb-4">
                    I can modify your itinerary in real-time. Try asking me to add, remove, or swap items!
                  </p>
                  
                  {/* Empty state suggested action chips */}
                  <div className="flex flex-wrap gap-2 justify-center px-4">
                    <button
                      onClick={() => handleChipClick("Add a morning outdoor activity")}
                      className="chat-empty-state-chip"
                    >
                      🏞️ Add outdoor morning plan
                    </button>
                    <button
                      onClick={() => handleChipClick("Suggest a popular lunch spot")}
                      className="chat-empty-state-chip"
                    >
                      🍽️ Suggest a lunch spot
                    </button>
                    <button
                      onClick={() => handleChipClick("Remove evening activities")}
                      className="chat-empty-state-chip"
                    >
                      🗑️ Clear evening plans
                    </button>
                  </div>
                </div>
              )}

              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`chat-message ${message.role === "user" ? "chat-message-user" : ""}`}
                >
                  <div className={`chat-avatar ${message.role === "user" ? "chat-avatar-user" : "chat-avatar-agent"}`}>
                    {message.role === "user" ? "👤" : "🤖"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`chat-bubble ${message.role === "user" ? "chat-bubble-user" : "chat-bubble-agent"}`}>
                      {message.content}
                    </div>
                    {message.role === "agent" && message.provider && (
                      <div className="chat-bubble-meta">
                        <span>
                          {message.model?.includes("flash-lite")
                            ? "⚡ Flash Lite"
                            : message.model?.includes("flash")
                            ? "⚡ Flash"
                            : "🧠 Claude"}
                        </span>
                        {message.commands && message.commands.length > 0 && (
                          <span>• {message.commands.length} action{message.commands.length > 1 ? "s" : ""} applied</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="chat-message">
                  <div className="chat-avatar chat-avatar-agent">🤖</div>
                  <div className="chat-bubble chat-bubble-agent">
                    <div className="typing-indicator">
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                      <div className="typing-dot"></div>
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="chat-input-container">
              <div className="chat-input-wrapper">
                <textarea
                  ref={inputRef}
                  className="chat-input"
                  placeholder="Ask me to modify your itinerary..."
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  disabled={isLoading}
                />
                <button
                  className="chat-send-button"
                  onClick={handleSendMessage}
                  disabled={!inputValue.trim() || isLoading}
                  aria-label="Send message"
                >
                  <Send size={20} />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Command Notification */}
      <AnimatePresence>
        {notification && (
          <motion.div
            className="command-notification"
            initial={{ x: "100%", opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            <div className="command-notification-icon">
              <Check size={18} />
            </div>
            <div className="command-notification-text">{notification}</div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Confirm Clear Conversation Modal */}
      <ConfirmModal
        isOpen={showClearConfirm}
        title="Clear Conversation"
        message="Are you sure you want to clear your entire chat history? This action is permanent and cannot be undone."
        confirmText="Clear History"
        cancelText="Keep Chat"
        variant="danger"
        onConfirm={handleConfirmClear}
        onCancel={() => setShowClearConfirm(false)}
      />
    </>
  );
}

"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Sparkles, Check } from "lucide-react";
import type { ChatMessage, AgentCommand, DayPlan, EventData } from "../../types";

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

  // Save messages to localStorage when they change
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem("chat_messages", JSON.stringify(messages));
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

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsLoading(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL 
        ? `${process.env.NEXT_PUBLIC_API_URL.replace(/\/+$/, '')}/api/v2/agent`
        : "/api/v2/agent";

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userMessage: inputValue.trim(),
          currentItinerary: itinerary,
          selectedDates,
          region,
          audience,
          budget
        })
      });

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
        content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : "Unknown error"}. Please try again.`,
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
            initial={{ y: "100%", opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
          >
            {/* Header */}
            <div className="chat-header">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                  <Sparkles size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900">AI Assistant</h3>
                  <p className="text-xs text-gray-500">Powered by Gemini 2.5</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-black/5 flex items-center justify-center transition-colors"
              >
                <X size={20} className="text-gray-600" />
              </button>
            </div>

            {/* Messages */}
            <div className="chat-messages">
              {messages.length === 0 && (
                <div className="text-center text-gray-500 text-sm py-8">
                  <Sparkles size={32} className="mx-auto mb-3 text-blue-400" />
                  <p className="font-semibold mb-1">Hi! I'm your AI planning assistant</p>
                  <p className="text-xs">Ask me to add, remove, or modify activities in your itinerary!</p>
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
                  <div>
                    <div className={`chat-bubble ${message.role === "user" ? "chat-bubble-user" : "chat-bubble-agent"}`}>
                      {message.content}
                    </div>
                    {message.role === "agent" && message.provider && (
                      <div className="chat-bubble-meta">
                        <span>{message.model?.includes("flash-lite") ? "⚡ Flash Lite" : message.model?.includes("flash") ? "⚡ Flash" : "🧠 Claude"}</span>
                        {message.commands && message.commands.length > 0 && (
                          <span>• {message.commands.length} action{message.commands.length > 1 ? "s" : ""}</span>
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
    </>
  );
}

// Made with Bob

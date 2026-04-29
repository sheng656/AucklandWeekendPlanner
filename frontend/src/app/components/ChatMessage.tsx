import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Sparkles, User } from "lucide-react";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: ChatMessageProps) {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} mb-6`}
    >
      <div className={`flex gap-3 max-w-[85%] ${isUser ? "flex-row-reverse" : "flex-row"}`}>
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm ${isUser ? "bg-blue-600" : "bg-gradient-to-br from-dopamine-mint to-cyan-400"}`}>
          {isUser ? <User className="w-5 h-5 text-white" /> : <Sparkles className="w-4 h-4 text-zinc-900" />}
        </div>
        
        {/* Message Bubble */}
        <div className={`relative px-5 py-4 rounded-2xl ${
          isUser 
            ? "bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-tr-sm shadow-md" 
            : "glass-panel bg-white/70 text-zinc-800 rounded-tl-sm border border-white/60 shadow-sm"
        }`}>
          {isUser ? (
            <p className="text-sm leading-relaxed">{content}</p>
          ) : (
            <div className="prose prose-sm max-w-none prose-p:leading-relaxed prose-headings:text-zinc-800 prose-a:text-blue-600 prose-strong:text-zinc-900">
              <ReactMarkdown
                components={{
                  code: ({node, inline, ...props}: any) => 
                    inline ? (
                      <code className="bg-zinc-100 px-1 py-0.5 rounded text-xs font-mono text-zinc-800" {...props} />
                    ) : (
                      <code className="block bg-zinc-100/50 p-3 rounded-lg mb-2 text-xs font-mono text-zinc-800 overflow-x-auto" {...props} />
                    ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

import React, { useState, useEffect, useRef } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";
import { QuizApiService } from "../../../services/quizApi";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AiSocraticChatProps {
  questionId: number;
  currentCode: string;
  language: string;
  lastError?: string;
}

export const AiSocraticChat: React.FC<AiSocraticChatProps> = ({
  questionId,
  currentCode,
  language,
  lastError,
}) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "Hi! I'm your coding tutor. I can't give you the answer, but I can help you find it. What are you stuck on?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      const response = await QuizApiService.getAIHint(questionId, {
        code: currentCode,
        language,
        chatHistory: messages.concat(userMessage),
        lastError,
      });

      if (response.success) {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: response.data.hint },
        ]);
      }
    } catch (error) {
      console.error("AI Chat Error:", error);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I'm having trouble connecting right now. Try again in a bit!",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 border-l border-slate-700 text-slate-200">
      <div className="p-4 border-b border-slate-700 flex items-center gap-2 bg-slate-800">
        <Bot size={20} className="text-blue-400" />
        <h3 className="font-semibold">AI Socratic Tutor</h3>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] p-3 rounded-lg text-sm ${
                m.role === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-slate-800 border border-slate-700 rounded-bl-none"
              }`}
            >
              <div className="flex items-center gap-2 mb-1 opacity-70">
                {m.role === "user" ? <User size={12} /> : <Bot size={12} />}
                <span className="text-[10px] uppercase tracking-wider font-bold">
                  {m.role === "user" ? "You" : "Tutor"}
                </span>
              </div>
              <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg rounded-bl-none animate-pulse">
              <Loader2 size={16} className="animate-spin text-blue-400" />
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-700 bg-slate-800">
        <div className="relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder="Ask for a hint..."
            className="w-full bg-slate-900 border border-slate-700 rounded-lg py-2 pl-3 pr-10 text-sm focus:outline-none focus:border-blue-500 resize-none min-h-[44px] max-h-32"
            rows={1}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            className="absolute right-2 bottom-2 p-1.5 text-blue-400 hover:text-blue-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-slate-500 mt-2 text-center italic">
          AI may provide helpful prompts but will not give the final answer.
        </p>
      </div>
    </div>
  );
};

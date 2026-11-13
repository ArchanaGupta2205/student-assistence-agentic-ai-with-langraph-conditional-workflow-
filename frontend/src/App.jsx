import React, { useState, useRef, useEffect } from "react";

const PROGRAMMES = [
  { id: "BCA", label: "BCA (Bachelor of Computer Applications)" },
  { id: "BBA", label: "BBA (Bachelor of Business Admin)" },
  { id: "B.Com (H)", label: "B.Com (Honours)" },
  { id: "Computer Science & AI", label: "B.Tech in Computer Science & AI" },
];

const SUGGESTED_QUERIES = [
  "What is the minimum attendance required to appear for semester exams?",
  "How much is the annual tuition fee for my program?",
  "What are the scholarship rules and how much fee waiver can I get?",
  "What is the passing grade and minimum CGPA required for graduation?",
  "Hi, can you explain how this college assistant works?",
];

export default function App() {
  const [programme, setProgramme] = useState("BCA");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeRoute, setActiveRoute] = useState(null);
  const [expandedContextIndex, setExpandedContextIndex] = useState(null);

  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleSend = async (queryText) => {
    const textToSend = queryText || input;
    if (!textToSend.trim() || loading) return;

    const userMessage = {
      sender: "user",
      text: textToSend,
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);
    setActiveRoute(null);

    try {
      const response = await fetch("/api/student-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          programme,
          message: textToSend,
        }),
      });

      const resData = await response.json();

      if (!response.ok || !resData.success) {
        throw new Error(resData.error || "Failed to get response from server");
      }

      const { reply, query_type, retrieved_context } = resData.data;

      setActiveRoute(query_type);

      const assistantMessage = {
        sender: "assistant",
        text: reply,
        route: query_type,
        context: retrieved_context,
        time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (err) {
      console.error("API error:", err);
      setMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          text: `⚠️ Error: ${err.message}. Make sure your Express backend is running on port 5000.`,
          route: "error",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const toggleContext = (index) => {
    setExpandedContextIndex(expandedContextIndex === index ? null : index);
  };

  return (
    <div className="app-container">
      {/* Top Header */}
      <header className="app-header">
        <div className="brand">
          <div className="brand-icon">🎓</div>
          <div className="brand-text">
            <h1>Apex Institute Student Assistant</h1>
            <p>LangGraph Conditional RAG with MongoDB Vector Storage & Gemini</p>
          </div>
        </div>

        {/* Programme Dropdown */}
        <div className="programme-picker">
          <label>Programme:</label>
          <select value={programme} onChange={(e) => setProgramme(e.target.value)}>
            {PROGRAMMES.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Dynamic Workflow Route Indicator */}
      <div className="workflow-visualizer">
        <span className="step-pill">START</span>
        <span className="arrow">→</span>
        <span className={`step-pill ${loading ? "active" : ""}`}>Classifier Node</span>
        <span className="arrow">→</span>
        <span className={`step-pill ${activeRoute === "academic" ? "active" : ""}`}>
          Academic RAG (Handbook)
        </span>
        <span className="step-pill">/</span>
        <span className={`step-pill ${activeRoute === "fee" ? "active" : ""}`}>
          Fee RAG (Fee Structure)
        </span>
        <span className="step-pill">/</span>
        <span className={`step-pill ${activeRoute === "general" ? "active" : ""}`}>General</span>
        <span className="arrow">→</span>
        <span className="step-pill">Response Node</span>
      </div>

      {/* Chat Conversation Area */}
      <main className="chat-window">
        {messages.length === 0 ? (
          <div className="empty-chat">
            <div className="empty-icon">🏛️</div>
            <h3>Welcome to College Assistant</h3>
            <p>
              You are currently asking questions as a <strong>{programme}</strong> student. Your
              queries are routed conditionally to either the <em>Academic Handbook</em> or the{" "}
              <em>Fee Structure</em> database.
            </p>

            <div className="quick-questions">
              {SUGGESTED_QUERIES.map((q, idx) => (
                <button
                  key={idx}
                  className="quick-btn"
                  onClick={() => handleSend(q)}
                  disabled={loading}
                >
                  "{q}"
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div key={idx} className={`message-row ${msg.sender}`}>
              <div className="message-meta">
                <span className="sender-name">
                  {msg.sender === "user" ? `You (${programme})` : "College Assistant"}
                </span>

                {msg.route && msg.route !== "error" && (
                  <span className={`route-badge ${msg.route}`}>
                    Route: {msg.route}
                  </span>
                )}

                <span style={{ color: "var(--text-muted)", fontSize: "10px" }}>{msg.time}</span>
              </div>

              <div className="message-bubble">{msg.text}</div>

              {/* Collapsible MongoDB Context Accordion */}
              {msg.context && msg.context !== "NO_RETRIEVAL_NEEDED" && (
                <div className="context-accordion">
                  <button className="context-toggle" onClick={() => toggleContext(idx)}>
                    <span>📄 View Grounded PDF Context from MongoDB Vector Store</span>
                    <span>{expandedContextIndex === idx ? "▲" : "▼"}</span>
                  </button>
                  {expandedContextIndex === idx && (
                    <div className="context-body">{msg.context}</div>
                  )}
                </div>
              )}
            </div>
          ))
        )}

        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
            <span>Classifying query & searching MongoDB vector embeddings...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Form */}
      <form
        className="chat-input-area"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={`Ask about attendance, grading, credits, scholarships, or tuition fees for ${programme}...`}
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send Question
        </button>
      </form>
    </div>
  );
}


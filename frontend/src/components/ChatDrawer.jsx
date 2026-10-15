import React, { useState, useEffect, useRef } from "react";
import { apiRequest } from "../api/client";
import { MessageSquare, Send, X, Video, ExternalLink, User } from "lucide-react";

export const ChatDrawer = ({ targetUser, onClose }) => {
  const [messages, setMessages] = useState([]);
  const [inputVal, setInputVal] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  const fetchMessages = async () => {
    if (!targetUser) return;
    try {
      const data = await apiRequest(`/api/networking/messages/${targetUser.id}`);
      setMessages(data);
    } catch (err) {
      console.warn("Could not load messages:", err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMessages();
    const interval = setInterval(fetchMessages, 3000); // 3-second live refresh
    return () => clearInterval(interval);
  }, [targetUser?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!inputVal.trim() || sending) return;

    try {
      setSending(true);
      const newMsg = await apiRequest("/api/networking/messages", {
        method: "POST",
        body: JSON.stringify({
          recipient_id: targetUser.id,
          content: inputVal.trim()
        })
      });
      setMessages([...messages, newMsg]);
      setInputVal("");
    } catch (err) {
      alert("Failed to send message: " + err.message);
    } finally {
      setSending(false);
    }
  };

  if (!targetUser) return null;

  return (
    <div className="chat-drawer">
      <div className="chat-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{
            width: "28px", height: "28px", borderRadius: "50%",
            background: "var(--primary)", display: "flex", alignItems: "center",
            justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: "0.8rem"
          }}>
            {targetUser.full_name?.[0] || "U"}
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: "0.85rem", lineHeight: 1.2 }}>
              {targetUser.full_name}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#94a3b8" }}>
              {targetUser.role?.toUpperCase()} • Direct Chat
            </div>
          </div>
        </div>

        <button onClick={onClose} style={{ color: "#94a3b8" }}>
          <X size={18} />
        </button>
      </div>

      {/* External Interview Resource Banner */}
      <div style={{
        background: "#eff6ff",
        borderBottom: "1px solid #bfdbfe",
        padding: "0.5rem 0.75rem",
        fontSize: "0.75rem",
        color: "#1e40af",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between"
      }}>
        <span>Conduct interview via outside resource:</span>
        <a 
          href="https://meet.google.com/new" 
          target="_blank" 
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm"
          style={{ fontSize: "0.7rem", padding: "0.2rem 0.5rem", textDecoration: "none" }}
        >
          <Video size={11} /> Google Meet <ExternalLink size={10} />
        </a>
      </div>

      {/* Messages Feed */}
      <div className="chat-messages">
        {loading ? (
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center" }}>
            Loading chat...
          </p>
        ) : messages.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.8rem", margin: "auto 0" }}>
            <MessageSquare size={24} style={{ margin: "0 auto 0.4rem", opacity: 0.5 }} />
            <p>No messages yet. Send a message to coordinate your interview details!</p>
          </div>
        ) : (
          messages.map((m) => {
            const isMine = m.sender_id !== targetUser.id;
            return (
              <div 
                key={m.id}
                className={`chat-bubble ${isMine ? "bubble-mine" : "bubble-theirs"}`}
              >
                <div>{m.content}</div>
                <div style={{
                  fontSize: "0.65rem",
                  marginTop: "0.2rem",
                  opacity: 0.75,
                  textAlign: isMine ? "right" : "left"
                }}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Text-only message composer FR-NET-03 */}
      <form className="chat-input-row" onSubmit={handleSend}>
        <input 
          type="text"
          placeholder="Type a message (text-only)..."
          className="form-input"
          style={{ fontSize: "0.85rem", padding: "0.45rem 0.65rem" }}
          value={inputVal}
          onChange={(e) => setInputVal(e.target.value)}
        />
        <button 
          type="submit" 
          className="btn btn-primary btn-sm"
          disabled={sending || !inputVal.trim()}
        >
          <Send size={14} />
        </button>
      </form>
    </div>
  );
};

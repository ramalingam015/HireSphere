import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { 
  Users, MessageSquare, ThumbsUp, MessageCircle, Send, 
  Trash2, EyeOff, Shield, PlusCircle, Check, UserPlus, Search 
} from "lucide-react";

export const NetworkPage = ({ onOpenChatWith }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [connections, setConnections] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [suggestionSearch, setSuggestionSearch] = useState("");
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [newPostContent, setNewPostContent] = useState("");
  const [commentInputs, setCommentInputs] = useState({});
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);

  const fetchFeed = async () => {
    try {
      const data = await apiRequest("/api/networking/feed");
      setPosts(data);
    } catch (err) {
      console.error("Error loading feed:", err);
    }
  };

  const fetchConnections = async () => {
    try {
      const data = await apiRequest("/api/networking/connections");
      setConnections(data);
    } catch (err) {
      console.error("Error loading connections:", err);
    }
  };

  const fetchSuggestions = async () => {
    try {
      setSuggestionsLoading(true);
      const data = await apiRequest("/api/networking/suggestions");
      setSuggestions(Array.isArray(data) ? data : []);
    } catch (err) {
      console.warn("Could not load connection suggestions:", err);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const connectionWith = (userId) =>
    connections.find((c) => c.other_user?.id === userId);

  const handleConnect = async (userId) => {
    try {
      await apiRequest(`/api/networking/connect/${userId}`, { method: "POST" });
      await Promise.all([fetchConnections(), fetchSuggestions()]);
    } catch (err) {
      alert("Could not send connection request: " + err.message);
    }
  };

  const respondToRequest = async (connId, action) => {
    try {
      await apiRequest(`/api/networking/connections/${connId}/${action}`, { method: "POST" });
      await Promise.all([fetchConnections(), fetchSuggestions()]);
    } catch (err) {
      alert(`Could not ${action} request: ` + err.message);
    }
  };

  const removeConnection = async (connId) => {
    try {
      await apiRequest(`/api/networking/connections/${connId}`, { method: "DELETE" });
      await Promise.all([fetchConnections(), fetchSuggestions()]);
    } catch (err) {
      alert("Could not remove connection: " + err.message);
    }
  };

  const incoming = connections.filter((c) => c.status === "PENDING" && c.receiver_id === user?.id);
  const outgoing = connections.filter((c) => c.status === "PENDING" && c.requester_id === user?.id);
  const accepted = connections.filter((c) => c.status === "ACCEPTED");

  useEffect(() => {
    Promise.all([fetchFeed(), fetchConnections(), fetchSuggestions()]).finally(() => setLoading(false));
  }, []);

  const handleCreatePost = async (e) => {
    e.preventDefault();
    if (!newPostContent.trim() || posting) return;

    try {
      setPosting(true);
      await apiRequest("/api/networking/posts", {
        method: "POST",
        body: JSON.stringify({ content: newPostContent.trim() })
      });
      setNewPostContent("");
      fetchFeed();
    } catch (err) {
      alert("Failed to publish post: " + err.message);
    } finally {
      setPosting(false);
    }
  };

  const handleToggleLike = async (postId) => {
    try {
      await apiRequest(`/api/networking/posts/${postId}/like`, { method: "POST" });
      fetchFeed();
    } catch (err) {
      console.error(err);
    }
  };

  const handleAddComment = async (postId) => {
    const text = commentInputs[postId]?.trim();
    if (!text) return;

    try {
      await apiRequest(`/api/networking/posts/${postId}/comments`, {
        method: "POST",
        body: JSON.stringify({ content: text })
      });
      setCommentInputs({ ...commentInputs, [postId]: "" });
      fetchFeed();
    } catch (err) {
      alert("Failed to add comment: " + err.message);
    }
  };

  const handleModeratePost = async (postId, action) => {
    try {
      await apiRequest(`/api/admin/posts/${postId}/moderate?action=${action}`, { method: "POST" });
      fetchFeed();
    } catch (err) {
      alert("Moderation failed: " + err.message);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.5rem" }}>
      {/* Left Column: Professional Feed (FR-NET-04) */}
      <div>
        {/* Post Composer */}
        <div className="card" style={{ marginBottom: "1.5rem" }}>
          <h3 style={{ fontSize: "1.05rem", fontWeight: 700, marginBottom: "0.75rem" }}>
            Share an Insight or Career Update
          </h3>
          <form onSubmit={handleCreatePost}>
            <textarea 
              className="form-textarea"
              rows={3}
              placeholder="What are you learning, building, or hiring for today? (Text only per FR-NET-03/04)"
              value={newPostContent}
              onChange={(e) => setNewPostContent(e.target.value)}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "0.75rem" }}>
              <button 
                type="submit" 
                className="btn btn-primary btn-sm"
                disabled={posting || !newPostContent.trim()}
              >
                <Send size={14} /> {posting ? "Posting..." : "Publish Post"}
              </button>
            </div>
          </form>
        </div>

        {/* Feed Posts */}
        {loading ? (
          <p style={{ textAlign: "center", color: "var(--text-muted)" }}>Loading feed...</p>
        ) : posts.length === 0 ? (
          <div className="card" style={{ textAlign: "center", padding: "2.5rem" }}>
            <p style={{ color: "var(--text-muted)" }}>No posts in the professional feed yet. Be the first to share!</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
            {posts.map((post) => (
              <div key={post.id} className="card">
                <div className="card-header" style={{ marginBottom: "0.75rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{
                      width: "36px", height: "36px", borderRadius: "50%",
                      background: "var(--primary-light)", color: "var(--primary)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontWeight: 700, fontSize: "0.95rem"
                    }}>
                      {post.author?.full_name?.[0] || "U"}
                    </div>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: "0.95rem" }}>
                        {post.author?.full_name}
                      </div>
                      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                        {post.author?.headline || post.author?.role?.toUpperCase()} • {new Date(post.created_at).toLocaleDateString()}
                      </div>
                    </div>
                    {post.author && post.author.id !== user?.id && (() => {
                      const conn = connectionWith(post.author.id);
                      if (!conn) {
                        return (
                          <button className="btn btn-secondary btn-sm" style={{ marginLeft: "0.5rem", fontSize: "0.7rem" }}
                            onClick={() => handleConnect(post.author.id)}>
                            + Connect
                          </button>
                        );
                      }
                      const label = conn.status === "ACCEPTED" ? "Connected"
                        : conn.status === "PENDING" ? "Pending" : "Declined";
                      return <span style={{ marginLeft: "0.5rem", fontSize: "0.7rem", color: "var(--text-muted)" }}>{label}</span>;
                    })()}
                  </div>

                  {/* Admin Moderation Action (FR-ADM-08) */}
                  {user?.role === "admin" && (
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <button 
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleModeratePost(post.id, "hide")}
                        title="Hide post from public feed"
                      >
                        <EyeOff size={12} /> Hide
                      </button>
                      <button 
                        className="btn btn-danger btn-sm"
                        onClick={() => handleModeratePost(post.id, "delete")}
                        title="Delete post permanently"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
                </div>

                <p style={{ fontSize: "0.95rem", color: "var(--text-main)", marginBottom: "1rem", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {post.content}
                </p>

                {/* Like & Comment Bar */}
                <div style={{ display: "flex", alignItems: "center", gap: "1rem", borderTop: "1px solid var(--border)", paddingTop: "0.6rem", paddingBottom: "0.6rem" }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    style={{ color: post.is_liked_by_me ? "var(--primary)" : "inherit", fontWeight: post.is_liked_by_me ? 700 : 500 }}
                    onClick={() => handleToggleLike(post.id)}
                  >
                    <ThumbsUp size={14} /> Like ({post.likes_count})
                  </button>
                  <span style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
                    <MessageCircle size={14} style={{ verticalAlign: "middle", marginRight: "0.3rem" }} />
                    {post.comments?.length || 0} Comments
                  </span>
                </div>

                {/* Comments List */}
                {post.comments?.length > 0 && (
                  <div style={{ background: "#f8fafc", borderRadius: "8px", padding: "0.75rem", margin: "0.6rem 0", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {post.comments.map((c) => (
                      <div key={c.id} style={{ fontSize: "0.85rem" }}>
                        <strong>{c.author?.full_name}: </strong>
                        <span style={{ color: "#334155" }}>{c.content}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment Input */}
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
                  <input 
                    type="text" 
                    placeholder="Write a comment..."
                    className="form-input"
                    style={{ fontSize: "0.85rem", padding: "0.4rem 0.65rem" }}
                    value={commentInputs[post.id] || ""}
                    onChange={(e) => setCommentInputs({ ...commentInputs, [post.id]: e.target.value })}
                    onKeyDown={(e) => { if (e.key === "Enter") handleAddComment(post.id); }}
                  />
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => handleAddComment(post.id)}
                  >
                    Reply
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Right Column: Connections (FR-NET-01 / FR-NET-02) */}
      <div>
        <div className="card">
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <Users size={16} /> My Professional Network
          </h3>

          {incoming.length > 0 && (
            <div style={{ marginBottom: "1rem" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                PENDING REQUESTS ({incoming.length})
              </div>
              {incoming.map((c) => (
                <div key={c.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.5rem", border: "1px solid var(--border)", borderRadius: "8px", marginBottom: "0.4rem" }}>
                  <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{c.other_user?.full_name}</span>
                  <span style={{ display: "flex", gap: "0.3rem" }}>
                    <button className="btn btn-primary btn-sm" style={{ fontSize: "0.7rem" }} onClick={() => respondToRequest(c.id, "accept")}>Accept</button>
                    <button className="btn btn-secondary btn-sm" style={{ fontSize: "0.7rem" }} onClick={() => respondToRequest(c.id, "reject")}>Reject</button>
                  </span>
                </div>
              ))}
            </div>
          )}
          {outgoing.length > 0 && (
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              Waiting for a response from: {outgoing.map((c) => c.other_user?.full_name).join(", ")}
            </p>
          )}

          {accepted.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              No connections yet. Use "+ Connect" on a post; once the other person accepts you can message each other.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {accepted.map((c) => (
                <div 
                  key={c.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.6rem",
                    borderRadius: "8px",
                    background: "#f8fafc",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem" }}>
                      {c.other_user?.full_name}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {c.other_user?.role?.toUpperCase()} • {c.other_user?.company || "Student"}
                    </div>
                  </div>

                  <button 
                    className="btn btn-primary btn-sm"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem" }}
                    onClick={() => onOpenChatWith(c.other_user)}
                    title="Direct text chat (FR-NET-02)"
                  >
                    <MessageSquare size={12} /> Chat
                  </button>
                  <button
                    className="btn btn-secondary btn-sm"
                    style={{ padding: "0.25rem 0.5rem", fontSize: "0.75rem", marginLeft: "0.3rem" }}
                    onClick={() => removeConnection(c.id)}
                    title="Remove connection"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discover & Connect with Others (FR-NET-01) */}
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <h3 style={{ fontSize: "1rem", fontWeight: 700, marginBottom: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
            <UserPlus size={16} color="var(--primary)" /> Connect with Others
          </h3>

          <div style={{ position: "relative", marginBottom: "0.75rem" }}>
            <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)" }} />
            <input 
              type="text"
              placeholder="Search people by name, company..."
              className="form-input"
              style={{ paddingLeft: "30px", fontSize: "0.82rem", padding: "0.4rem 0.6rem 0.4rem 30px" }}
              value={suggestionSearch}
              onChange={(e) => setSuggestionSearch(e.target.value)}
            />
          </div>

          {suggestionsLoading ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "1rem" }}>
              Loading suggestions...
            </p>
          ) : suggestions.filter(p => {
              if (!suggestionSearch.trim()) return true;
              const q = suggestionSearch.toLowerCase();
              return (
                p.full_name?.toLowerCase().includes(q) ||
                p.company?.toLowerCase().includes(q) ||
                p.headline?.toLowerCase().includes(q) ||
                p.role?.toLowerCase().includes(q)
              );
            }).length === 0 ? (
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", textAlign: "center", padding: "0.75rem" }}>
              {suggestionSearch ? "No profiles matching your search." : "No other users available right now."}
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem", maxHeight: "300px", overflowY: "auto" }}>
              {suggestions.filter(p => {
                if (!suggestionSearch.trim()) return true;
                const q = suggestionSearch.toLowerCase();
                return (
                  p.full_name?.toLowerCase().includes(q) ||
                  p.company?.toLowerCase().includes(q) ||
                  p.headline?.toLowerCase().includes(q) ||
                  p.role?.toLowerCase().includes(q)
                );
              }).map((person) => (
                <div 
                  key={person.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.55rem 0.65rem",
                    borderRadius: "8px",
                    background: "#f8fafc",
                    border: "1px solid var(--border)"
                  }}
                >
                  <div style={{ minWidth: 0, flex: 1, marginRight: "0.5rem" }}>
                    <div style={{ fontWeight: 600, fontSize: "0.85rem", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {person.full_name}
                    </div>
                    <div style={{ fontSize: "0.73rem", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      <span style={{ textTransform: "capitalize", fontWeight: 600 }}>{person.role}</span>
                      {person.company && ` • ${person.company}`}
                      {person.headline && ` • ${person.headline}`}
                    </div>
                  </div>

                  <div>
                    {person.connection_status === "ACCEPTED" ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--success)", fontWeight: 600 }}>
                        Connected
                      </span>
                    ) : person.connection_status === "PENDING_SENT" ? (
                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Pending
                      </span>
                    ) : person.connection_status === "PENDING_RECEIVED" ? (
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        <button 
                          className="btn btn-primary btn-sm"
                          style={{ fontSize: "0.7rem", padding: "0.2rem 0.45rem" }}
                          onClick={() => respondToRequest(person.connection_id, "accept")}
                        >
                          Accept
                        </button>
                        <button 
                          className="btn btn-secondary btn-sm"
                          style={{ fontSize: "0.7rem", padding: "0.2rem 0.45rem" }}
                          onClick={() => respondToRequest(person.connection_id, "reject")}
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      <button 
                        className="btn btn-primary btn-sm"
                        style={{ fontSize: "0.72rem", padding: "0.25rem 0.6rem", whiteSpace: "nowrap" }}
                        onClick={() => handleConnect(person.id)}
                      >
                        + Connect
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

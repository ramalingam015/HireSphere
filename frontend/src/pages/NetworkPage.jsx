import React, { useState, useEffect } from "react";
import { apiRequest } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { 
  Users, MessageSquare, ThumbsUp, MessageCircle, Send, 
  Trash2, EyeOff, Shield, PlusCircle, Check 
} from "lucide-react";

export const NetworkPage = ({ onOpenChatWith }) => {
  const { user } = useAuth();
  const [posts, setPosts] = useState([]);
  const [connections, setConnections] = useState([]);
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

  useEffect(() => {
    Promise.all([fetchFeed(), fetchConnections()]).finally(() => setLoading(false));
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

          {connections.length === 0 ? (
            <p style={{ fontSize: "0.85rem", color: "var(--text-muted)" }}>
              No connections established yet. Connect with recruiters and peers to unlock direct messaging.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {connections.map((c) => (
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
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

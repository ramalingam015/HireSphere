from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import or_, and_

from app.database import get_db
from app.models import (
    Connection, Message, Post, PostLike, PostComment, User, Application, InterviewSlot
)
from app.schemas import (
    ConnectionOut, MessageCreate, MessageOut,
    PostCreate, PostOut, CommentCreate, PostCommentOut, UserOut
)
from app.auth import get_current_user

router = APIRouter(prefix="/api/networking", tags=["Networking & Chat"])

# --- Connections (FR-NET-01) ---

@router.get("/connections", response_model=List[ConnectionOut])
def get_my_connections(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FR-NET-01: List accepted connections and pending requests."""
    conns = db.query(Connection).filter(
        or_(
            Connection.requester_id == current_user.id,
            Connection.receiver_id == current_user.id
        )
    ).all()
    
    results = []
    for c in conns:
        other_id = c.receiver_id if c.requester_id == current_user.id else c.requester_id
        other_user = db.query(User).filter(User.id == other_id).first()
        results.append({
            "id": c.id,
            "requester_id": c.requester_id,
            "receiver_id": c.receiver_id,
            "status": c.status,
            "created_at": c.created_at,
            "other_user": other_user
        })
    return results

@router.post("/connect/{user_id}", response_model=ConnectionOut)
def request_connection(
    user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Send connection request."""
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot connect to yourself")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(Connection).filter(
        or_(
            and_(Connection.requester_id == current_user.id, Connection.receiver_id == user_id),
            and_(Connection.requester_id == user_id, Connection.receiver_id == current_user.id)
        )
    ).first()

    if existing:
        return {
            "id": existing.id,
            "requester_id": existing.requester_id,
            "receiver_id": existing.receiver_id,
            "status": existing.status,
            "created_at": existing.created_at,
            "other_user": target
        }

    conn = Connection(
        requester_id=current_user.id,
        receiver_id=user_id,
        status="ACCEPTED"  # Auto-accept for smooth demo/recruiting connectivity
    )
    db.add(conn)
    db.commit()
    db.refresh(conn)
    return {
        "id": conn.id,
        "requester_id": conn.requester_id,
        "receiver_id": conn.receiver_id,
        "status": conn.status,
        "created_at": conn.created_at,
        "other_user": target
    }

@router.delete("/connections/{conn_id}")
def remove_connection(
    conn_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    conn = db.query(Connection).filter(Connection.id == conn_id).first()
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")
    if conn.requester_id != current_user.id and conn.receiver_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    db.delete(conn)
    db.commit()
    return {"message": "Connection removed"}

# --- Direct Messaging (FR-NET-02 / FR-NET-03) ---

@router.get("/messages/{other_user_id}", response_model=List[MessageOut])
def get_chat_history(
    other_user_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FR-NET-02 / FR-NET-03: View 1-on-1 chat history."""
    messages = db.query(Message).filter(
        or_(
            and_(Message.sender_id == current_user.id, Message.recipient_id == other_user_id),
            and_(Message.sender_id == other_user_id, Message.recipient_id == current_user.id)
        )
    ).order_by(Message.created_at.asc()).all()

    # Mark unread as read
    for m in messages:
        if m.recipient_id == current_user.id and not m.is_read:
            m.is_read = True
    db.commit()

    return messages

@router.post("/messages", response_model=MessageOut, status_code=status.HTTP_201_CREATED)
def send_message(
    msg_in: MessageCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    FR-NET-02: Direct messaging between connections or recruiter & candidate.
    FR-NET-03: Text-only messaging.
    """
    if msg_in.recipient_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot message yourself")

    target = db.query(User).filter(User.id == msg_in.recipient_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="Recipient not found")

    # Verify connection OR recruiter-applicant relationship
    is_connected = db.query(Connection).filter(
        or_(
            and_(Connection.requester_id == current_user.id, Connection.receiver_id == target.id),
            and_(Connection.requester_id == target.id, Connection.receiver_id == current_user.id)
        ),
        Connection.status == "ACCEPTED"
    ).first() is not None

    # Check if they are recruiter & applicant for an interview
    is_recruiter_applicant = db.query(Application).filter(
        or_(
            and_(Application.candidate_id == current_user.id, Application.job.has(recruiter_id=target.id)),
            and_(Application.candidate_id == target.id, Application.job.has(recruiter_id=current_user.id))
        )
    ).first() is not None

    if not is_connected and not is_recruiter_applicant and current_user.role != "admin":
        # Allow sending message and auto-create connection so candidates & recruiters can chat
        conn = Connection(
            requester_id=current_user.id,
            receiver_id=target.id,
            status="ACCEPTED"
        )
        db.add(conn)

    clean_content = msg_in.content.strip()
    if not clean_content:
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    new_msg = Message(
        sender_id=current_user.id,
        recipient_id=msg_in.recipient_id,
        content=clean_content
    )
    db.add(new_msg)
    db.commit()
    db.refresh(new_msg)
    return new_msg

# --- Professional Posts & Feed (FR-NET-04) ---

@router.get("/feed", response_model=List[PostOut])
def get_feed(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FR-NET-04: View professional posts feed."""
    posts = db.query(Post).filter(Post.is_hidden == False).order_by(Post.created_at.desc()).all()
    
    results = []
    for p in posts:
        likes_count = len(p.likes)
        is_liked = any(l.user_id == current_user.id for l in p.likes)
        comments = [c for c in p.comments if not c.is_hidden]
        results.append({
            "id": p.id,
            "author_id": p.author_id,
            "content": p.content,
            "is_hidden": p.is_hidden,
            "created_at": p.created_at,
            "author": p.author,
            "likes_count": likes_count,
            "is_liked_by_me": is_liked,
            "comments": comments
        })
    return results

@router.post("/posts", response_model=PostOut, status_code=status.HTTP_201_CREATED)
def create_post(
    post_in: PostCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """FR-NET-04: Create a professional post."""
    if not post_in.content.strip():
        raise HTTPException(status_code=400, detail="Post content cannot be empty")

    p = Post(author_id=current_user.id, content=post_in.content.strip())
    db.add(p)
    db.commit()
    db.refresh(p)
    return {
        "id": p.id,
        "author_id": p.author_id,
        "content": p.content,
        "is_hidden": p.is_hidden,
        "created_at": p.created_at,
        "author": current_user,
        "likes_count": 0,
        "is_liked_by_me": False,
        "comments": []
    }

@router.post("/posts/{post_id}/like")
def toggle_like(
    post_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Like or unlike a post."""
    existing = db.query(PostLike).filter(
        PostLike.post_id == post_id,
        PostLike.user_id == current_user.id
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
        return {"liked": False}
    else:
        new_like = PostLike(post_id=post_id, user_id=current_user.id)
        db.add(new_like)
        db.commit()
        return {"liked": True}

@router.post("/posts/{post_id}/comments", response_model=PostCommentOut)
def add_comment(
    post_id: int,
    comment_in: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Comment on a post."""
    post = db.query(Post).filter(Post.id == post_id).first()
    if not post or post.is_hidden:
        raise HTTPException(status_code=404, detail="Post not found")

    c = PostComment(
        post_id=post_id,
        author_id=current_user.id,
        content=comment_in.content.strip()
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return c

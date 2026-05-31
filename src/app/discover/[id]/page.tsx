"use client";

import { useState, useEffect, useRef } from "react";
import type { ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PostDetail, PostComment } from "@/lib/post-types";
import { Icon } from "@/components/icon";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [replyTarget, setReplyTarget] = useState<PostComment | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    let cancelled = false;
    async function loadPost() {
      setLoading(true);
      try {
        const response = await fetch(`/api/posts/${params.id}`);
        const data = await response.json();
        if (cancelled) return;
        if (data.error) {
          setPost(null);
        } else {
          setPost(data);
          setLiked(data.liked);
          setFavorited(data.favorited);
          setLikeCount(data._count.likes);
          setFavoriteCount(data._count.favorites);
        }
      } catch {
        if (!cancelled) setPost(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void loadPost();
    return () => {
      cancelled = true;
    };
  }, [params?.id]);

  async function handleLike() {
    if (!post) return;
    const nextLiked = !liked;
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: nextLiked ? "POST" : "DELETE" });
      if (!res.ok) throw new Error("like failed");
      const data = await res.json();
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } catch {
      setLiked(liked);
      setLikeCount((c) => (nextLiked ? c - 1 : c + 1));
    }
  }

  async function handleFavorite() {
    if (!post) return;
    const nextFavorited = !favorited;
    setFavorited(nextFavorited);
    setFavoriteCount((c) => (nextFavorited ? c + 1 : c - 1));
    try {
      const res = await fetch(`/api/posts/${post.id}/favorite`, { method: nextFavorited ? "POST" : "DELETE" });
      if (!res.ok) throw new Error("favorite failed");
      const data = await res.json();
      setFavorited(data.favorited);
      setFavoriteCount(data.favoriteCount);
    } catch {
      setFavorited(favorited);
      setFavoriteCount((c) => (nextFavorited ? c - 1 : c + 1));
    }
  }

  async function handleComment() {
    if (!commentText.trim() || !post) return;
    const content = commentText.trim();
    const parentId = replyTarget?.id ?? null;
    const newComment: PostComment = {
      id: `temp-${Date.now()}`,
      body: content,
      createdAt: new Date().toISOString(),
      parentId,
      liked: false,
      favorited: false,
      _count: {
        likes: 0,
        favorites: 0,
      },
      author: { id: "", name: "你", avatarUrl: null },
    };
    const nextComments = parentId
      ? insertReply(post.comments, parentId, newComment)
      : [...post.comments, newComment];
    setPost({
      ...post,
      comments: nextComments,
    });
    setCommentText("");
    setReplyTarget(null);
    try {
      const res = await fetch(`/api/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: content, parentId }),
      });
      if (!res.ok) throw new Error("comment failed");
      const data = await res.json();
      setPost((current) => {
        if (!current) return current;
        const withoutTemp = removeComment(current.comments, newComment.id);
        return {
          ...current,
          comments: parentId
            ? insertReply(withoutTemp, parentId, data.comment)
            : [...withoutTemp, data.comment],
        };
      });
    } catch {
      setPost((current) =>
        current ? { ...current, comments: removeComment(current.comments, newComment.id) } : current
      );
      setCommentText(content);
      setReplyTarget(replyTarget);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <HeaderBar onBack={() => router.back()} />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-8 h-8 border-2 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="min-h-screen flex flex-col">
        <HeaderBar onBack={() => router.back()} />
        <div className="flex-1 flex flex-col items-center justify-center text-on-surface-variant">
          <Icon name="error" />
          <p>文章未找到</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <HeaderBar onBack={() => router.back()} />

      {/* Cover Image */}
      {post.coverImage && (
        <div className="relative w-full h-56 md:h-72 overflow-hidden">
          <img
            src={post.coverImage}
            alt={post.title}
            className="absolute inset-0 w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        </div>
      )}

      {/* Article Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 md:px-8 py-8 -mt-12 relative z-10">
        {/* Category */}
        <div className="flex items-center gap-2 mb-4">
          {post.categoryIcon && (
            <Icon name={post.categoryIcon} size={16} className="text-tertiary" />
          )}
          <span className="text-xs text-tertiary font-medium uppercase tracking-wider">
            {post.category}
          </span>
          <span className="text-xs text-on-surface-variant ml-auto">
            {post.readMinutes} min · {post.viewCount} 阅读
          </span>
        </div>

        {/* Title */}
        <h1 className="font-[var(--font-display)] text-2xl md:text-3xl font-medium text-on-surface leading-tight mb-6">
          {post.title}
        </h1>

        {/* Author */}
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-outline-variant/20">
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden relative">
            {post.author.avatarUrl ? (
              <img src={post.author.avatarUrl} alt={post.author.name} className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <Icon name="person" />
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">{post.author.name}</p>
            <p className="text-xs text-on-surface-variant">
              {new Date(post.publishedAt).toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Body (rendered as markdown-like paragraphs) */}
        <LongPressActions onLike={handleLike} onFavorite={handleFavorite} onComment={() => setReplyTarget(null)}>
        <article className="prose-custom text-base text-on-surface leading-relaxed space-y-4 mb-10">
          {post.body.split("\n\n").map((paragraph, i) => {
            if (paragraph.startsWith("## ")) {
              return (
                <h2 key={i} className="font-[var(--font-display)] text-xl font-medium text-on-surface mt-8 mb-3">
                  {paragraph.replace("## ", "")}
                </h2>
              );
            }
            if (paragraph.match(/^\d+\. /)) {
              const items = paragraph.split("\n").filter(Boolean);
              return (
                <ol key={i} className="list-decimal list-inside space-y-1.5 text-on-surface-variant">
                  {items.map((item, j) => (
                    <li key={j} dangerouslySetInnerHTML={{ __html: formatBold(item.replace(/^\d+\.\s*/, "")) }} />
                  ))}
                </ol>
              );
            }
            if (paragraph.startsWith("- ")) {
              const items = paragraph.split("\n").filter(Boolean);
              return (
                <ul key={i} className="list-disc list-inside space-y-1.5 text-on-surface-variant">
                  {items.map((item, j) => (
                    <li key={j} dangerouslySetInnerHTML={{ __html: formatBold(item.replace(/^-\s*/, "")) }} />
                  ))}
                </ul>
              );
            }
            return (
              <p key={i} className="text-on-surface-variant" dangerouslySetInnerHTML={{ __html: formatBold(paragraph) }} />
            );
          })}
        </article>
        </LongPressActions>

        {/* Like + Stats Bar */}
        <div className="flex items-center gap-4 py-4 border-t border-b border-outline-variant/20 mb-8">
          <button
            onClick={handleLike}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-300 ${
              liked
                ? "bg-secondary-container text-on-secondary-container"
                : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
            }`}
          >
            <Icon name="favorite" className="text-lg" />
            <span className="text-sm font-medium">{likeCount}</span>
          </button>
          <button
            onClick={handleFavorite}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-300 ${
              favorited
                ? "bg-tertiary-container text-on-tertiary-container"
                : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
            }`}
          >
            <Icon name="bookmark" className="text-lg" />
            <span className="text-sm font-medium">{favoriteCount}</span>
          </button>
          <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
            <Icon name="chat_bubble" />
            {post.comments.length}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-on-surface-variant ml-auto">
            <Icon name="visibility" />
            {post.viewCount}
          </span>
        </div>

        {/* Comments Section */}
        <section className="mb-20">
          <h3 className="text-base font-medium text-on-surface mb-6">
            评论 ({post.comments.length})
          </h3>

          {/* Comment Input */}
          <div className="flex gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
              <Icon name="person" />
            </div>
            <div className="flex-1 flex gap-2">
              <div className="flex-1">
                {replyTarget && (
                  <div className="mb-2 flex items-center gap-2 text-xs text-on-surface-variant">
                    <span>回复 {replyTarget.author.name}</span>
                    <button onClick={() => setReplyTarget(null)} className="text-secondary">取消</button>
                  </div>
                )}
                <input
                  type="text"
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleComment()}
                  placeholder={replyTarget ? "写下回复..." : "说点什么..."}
                  className="w-full bg-surface-container-low border-0 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary transition-all"
                />
              </div>
              <button
                onClick={handleComment}
                disabled={!commentText.trim()}
                className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                发送
              </button>
            </div>
          </div>

          {/* Comment List */}
          <div className="flex flex-col gap-4">
            {post.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                onReply={(target) => setReplyTarget(target)}
                onCommentChanged={(updated) => {
                  setPost((current) =>
                    current ? { ...current, comments: updateComment(current.comments, updated) } : current
                  );
                }}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function CommentItem({
  comment,
  onReply,
  onCommentChanged,
}: {
  comment: PostComment;
  onReply: (comment: PostComment) => void;
  onCommentChanged: (comment: PostComment) => void;
}) {
  async function toggleCommentLike() {
    const nextLiked = !comment.liked;
    onCommentChanged({
      ...comment,
      liked: nextLiked,
      _count: { ...comment._count, likes: comment._count.likes + (nextLiked ? 1 : -1) },
    });
    try {
      const res = await fetch(`/api/comments/${comment.id}/like`, { method: nextLiked ? "POST" : "DELETE" });
      if (!res.ok) throw new Error("comment like failed");
      const data = await res.json();
      onCommentChanged({
        ...comment,
        liked: data.liked,
        _count: { ...comment._count, likes: data.likeCount },
      });
    } catch {
      onCommentChanged(comment);
    }
  }

  async function toggleCommentFavorite() {
    const nextFavorited = !comment.favorited;
    onCommentChanged({
      ...comment,
      favorited: nextFavorited,
      _count: { ...comment._count, favorites: comment._count.favorites + (nextFavorited ? 1 : -1) },
    });
    try {
      const res = await fetch(`/api/comments/${comment.id}/favorite`, { method: nextFavorited ? "POST" : "DELETE" });
      if (!res.ok) throw new Error("comment favorite failed");
      const data = await res.json();
      onCommentChanged({
        ...comment,
        favorited: data.favorited,
        _count: { ...comment._count, favorites: data.favoriteCount },
      });
    } catch {
      onCommentChanged(comment);
    }
  }

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden relative flex-shrink-0">
        {comment.author.avatarUrl ? (
          <img src={comment.author.avatarUrl} alt={comment.author.name} className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <Icon name="person" />
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-on-surface">{comment.author.name}</span>
          <span className="text-xs text-on-surface-variant">
            {new Date(comment.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
          </span>
        </div>
        <LongPressActions
          onLike={toggleCommentLike}
          onFavorite={toggleCommentFavorite}
          onComment={() => onReply(comment)}
        >
          <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{comment.body}</p>
        </LongPressActions>
        <div className="mt-2 flex items-center gap-3 text-xs text-on-surface-variant">
          <button onClick={toggleCommentLike} className={comment.liked ? "text-secondary" : ""}>
            赞 {comment._count.likes}
          </button>
          <button onClick={toggleCommentFavorite} className={comment.favorited ? "text-tertiary" : ""}>
            收藏 {comment._count.favorites}
          </button>
          <button onClick={() => onReply(comment)}>评论</button>
        </div>

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 ml-2 pl-3 border-l border-outline-variant/20 flex flex-col gap-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                onReply={onReply}
                onCommentChanged={onCommentChanged}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function LongPressActions({
  children,
  onLike,
  onFavorite,
  onComment,
}: {
  children: ReactNode;
  onLike: () => void;
  onFavorite: () => void;
  onComment: () => void;
}) {
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function startPress() {
    timerRef.current = setTimeout(() => setOpen(true), 450);
  }

  function endPress() {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }

  return (
    <div
      className="relative"
      onPointerDown={startPress}
      onPointerUp={endPress}
      onPointerCancel={endPress}
      onPointerLeave={endPress}
    >
      {children}
      {open && (
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setOpen(false)} aria-label="关闭操作菜单" />
          <div className="absolute left-0 top-full z-50 mt-2 flex items-center gap-1 rounded-xl border border-outline-variant/30 bg-surface-container-low px-2 py-1 shadow-lg">
            <button onClick={() => { onLike(); setOpen(false); }} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-on-surface hover:bg-surface-variant/30">
              <Icon name="favorite" size={16} /> 赞
            </button>
            <button onClick={() => { onFavorite(); setOpen(false); }} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-on-surface hover:bg-surface-variant/30">
              <Icon name="bookmark" size={16} /> 收藏
            </button>
            <button onClick={() => { onComment(); setOpen(false); }} className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-on-surface hover:bg-surface-variant/30">
              <Icon name="chat_bubble" size={16} /> 评论
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function insertReply(comments: PostComment[], parentId: string, reply: PostComment): PostComment[] {
  return comments.map((comment) => {
    if (comment.id === parentId) {
      return { ...comment, replies: [...(comment.replies ?? []), reply] };
    }
    return {
      ...comment,
      replies: comment.replies ? insertReply(comment.replies, parentId, reply) : comment.replies,
    };
  });
}

function removeComment(comments: PostComment[], commentId: string): PostComment[] {
  return comments
    .filter((comment) => comment.id !== commentId)
    .map((comment) => ({
      ...comment,
      replies: comment.replies ? removeComment(comment.replies, commentId) : comment.replies,
    }));
}

function updateComment(comments: PostComment[], updated: PostComment): PostComment[] {
  return comments.map((comment) => {
    if (comment.id === updated.id) return { ...updated, replies: comment.replies };
    return {
      ...comment,
      replies: comment.replies ? updateComment(comment.replies, updated) : comment.replies,
    };
  });
}

function HeaderBar({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20">
      <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-on-surface hover:opacity-70 transition-opacity rounded-full">
        <Icon name="arrow_back" />
      </button>
      <h1 className="font-[var(--font-display)] text-lg font-medium text-primary">Mindful</h1>
      <Link
        href="/notifications"
        aria-label="通知中心"
        className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:opacity-70 transition-opacity rounded-full"
      >
        <Icon name="notifications" />
      </Link>
    </header>
  );
}

/** Simple bold markdown formatting: **text** → <strong>text</strong> */
function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong class='text-on-surface font-medium'>$1</strong>");
}

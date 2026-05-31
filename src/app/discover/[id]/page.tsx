"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import type { PostDetail, PostComment } from "@/lib/post-types";

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [commentText, setCommentText] = useState("");

  useEffect(() => {
    if (!params?.id) return;
    setLoading(true);
    fetch(`/api/posts/${params.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setPost(null);
        } else {
          setPost(data);
          setLiked(data.liked);
          setLikeCount(data._count.likes);
        }
      })
      .catch(() => setPost(null))
      .finally(() => setLoading(false));
  }, [params?.id]);

  function handleLike() {
    setLiked(!liked);
    setLikeCount((c) => (liked ? c - 1 : c + 1));
    // TODO: POST /api/posts/[id]/like in production
  }

  function handleComment() {
    if (!commentText.trim() || !post) return;
    // Optimistic local add
    const newComment: PostComment = {
      id: `temp-${Date.now()}`,
      body: commentText.trim(),
      createdAt: new Date().toISOString(),
      parentId: null,
      author: { id: "", name: "你", avatarUrl: null },
    };
    setPost({
      ...post,
      comments: [...post.comments, newComment],
    });
    setCommentText("");
    // TODO: POST /api/posts/[id]/comment in production
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
          <span className="material-symbols-outlined text-5xl mb-4">error</span>
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
          <Image
            src={post.coverImage}
            alt={post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface via-transparent to-transparent" />
        </div>
      )}

      {/* Article Content */}
      <main className="flex-1 max-w-3xl mx-auto w-full px-6 md:px-8 py-8 -mt-12 relative z-10">
        {/* Category */}
        <div className="flex items-center gap-2 mb-4">
          {post.categoryIcon && (
            <span className="material-symbols-outlined text-sm text-tertiary">
              {post.categoryIcon}
            </span>
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
              <Image src={post.author.avatarUrl} alt={post.author.name} fill className="object-cover" />
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant absolute inset-0 flex items-center justify-center">person</span>
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
            <span
              className="material-symbols-outlined text-lg"
              style={liked ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              favorite
            </span>
            <span className="text-sm font-medium">{likeCount}</span>
          </button>
          <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-lg">chat_bubble</span>
            {post.comments.length}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-on-surface-variant ml-auto">
            <span className="material-symbols-outlined text-lg">visibility</span>
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
              <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleComment()}
                placeholder="说点什么..."
                className="flex-1 bg-surface-container-low border-0 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary transition-all"
              />
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
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}

function CommentItem({ comment }: { comment: PostComment }) {
  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden relative flex-shrink-0">
        {comment.author.avatarUrl ? (
          <Image src={comment.author.avatarUrl} alt={comment.author.name} fill className="object-cover" />
        ) : (
          <span className="material-symbols-outlined text-sm text-on-surface-variant absolute inset-0 flex items-center justify-center">person</span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-on-surface">{comment.author.name}</span>
          <span className="text-xs text-on-surface-variant">
            {new Date(comment.createdAt).toLocaleDateString("zh-CN", { month: "short", day: "numeric" })}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{comment.body}</p>

        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 ml-2 pl-3 border-l border-outline-variant/20 flex flex-col gap-3">
            {comment.replies.map((reply) => (
              <CommentItem key={reply.id} comment={reply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function HeaderBar({ onBack }: { onBack: () => void }) {
  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 h-14 bg-surface/80 backdrop-blur-xl border-b border-outline-variant/20">
      <button onClick={onBack} className="w-10 h-10 flex items-center justify-center text-on-surface hover:opacity-70 transition-opacity rounded-full">
        <span className="material-symbols-outlined">arrow_back</span>
      </button>
      <h1 className="font-[var(--font-display)] text-lg font-medium text-primary">Mindful</h1>
      <Link
        href="/notifications"
        aria-label="通知中心"
        className="w-10 h-10 flex items-center justify-center text-on-surface-variant hover:opacity-70 transition-opacity rounded-full"
      >
        <span className="material-symbols-outlined">notifications</span>
      </Link>
    </header>
  );
}

/** Simple bold markdown formatting: **text** → <strong>text</strong> */
function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong class='text-on-surface font-medium'>$1</strong>");
}

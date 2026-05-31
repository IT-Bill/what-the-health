"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { PostComment, PostDetail } from "@/lib/post-types";

type PostLikeResponse = {
  liked: boolean;
  likeCount: number;
};

type PostFavoriteResponse = {
  favorited: boolean;
  favoriteCount: number;
};

type CommentLikeResponse = {
  liked: boolean;
  likeCount: number;
};

type CommentFavoriteResponse = {
  favorited: boolean;
  favoriteCount: number;
};

type CreateCommentResponse = {
  comment: PostComment;
};

export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = typeof params?.id === "string" ? params.id : null;
  const [post, setPost] = useState<PostDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [favorited, setFavorited] = useState(false);
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [commentCount, setCommentCount] = useState(0);
  const [commentText, setCommentText] = useState("");
  const [pendingPostAction, setPendingPostAction] = useState<"like" | "favorite" | null>(null);
  const [pendingCommentAction, setPendingCommentAction] = useState<string | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  useEffect(() => {
    if (!postId) {
      return;
    }

    async function loadPost() {
      setLoading(true);

      try {
        const response = await fetch(`/api/posts/${postId}`);
        const data = await response.json();

        if (data.error) {
          setPost(null);
          return;
        }

        setPost(data);
        setLiked(data.liked);
        setLikeCount(data._count.likes);
        setFavorited(data.favorited);
        setFavoriteCount(data._count.favorites);
        setCommentCount(data._count.comments);
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    }

    void loadPost();
  }, [postId]);

  async function handleLike() {
    if (!postId || pendingPostAction) {
      return;
    }

    setPendingPostAction("like");
    try {
      const response = await fetch(`/api/posts/${postId}/like`, {
        method: liked ? "DELETE" : "POST",
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as PostLikeResponse;
      setLiked(data.liked);
      setLikeCount(data.likeCount);
    } finally {
      setPendingPostAction(null);
    }
  }

  async function handleFavorite() {
    if (!postId || pendingPostAction) {
      return;
    }

    setPendingPostAction("favorite");
    try {
      const response = await fetch(`/api/posts/${postId}/favorite`, {
        method: favorited ? "DELETE" : "POST",
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as PostFavoriteResponse;
      setFavorited(data.favorited);
      setFavoriteCount(data.favoriteCount);
    } finally {
      setPendingPostAction(null);
    }
  }

  async function handleComment() {
    if (!postId || !commentText.trim() || submittingComment) {
      return;
    }

    setSubmittingComment(true);
    try {
      const response = await fetch(`/api/posts/${postId}/comments`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ body: commentText.trim() }),
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as CreateCommentResponse;
      setPost((current) =>
        current
          ? {
              ...current,
              comments: [...current.comments, data.comment],
            }
          : current
      );
      setCommentCount((current) => current + 1);
      setCommentText("");
    } finally {
      setSubmittingComment(false);
    }
  }

  async function handleCommentReaction(
    commentId: string,
    action: "like" | "favorite",
    active: boolean
  ) {
    const actionKey = `${commentId}:${action}`;
    if (pendingCommentAction === actionKey) {
      return;
    }

    setPendingCommentAction(actionKey);
    try {
      const response = await fetch(`/api/comments/${commentId}/${action}`, {
        method: active ? "DELETE" : "POST",
      });

      if (response.status === 401) {
        router.push("/login");
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as CommentLikeResponse | CommentFavoriteResponse;
      setPost((current) =>
        current
          ? {
              ...current,
              comments: updateCommentReaction(current.comments, commentId, action, data),
            }
          : current
      );
    } finally {
      setPendingCommentAction(null);
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
          <span className="material-symbols-outlined text-5xl mb-4">error</span>
          <p>文章未找到</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <HeaderBar onBack={() => router.back()} />

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

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 md:px-8 py-8 -mt-12 relative z-10">
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

        <h1 className="font-[var(--font-display)] text-2xl md:text-3xl font-medium text-on-surface leading-tight mb-6">
          {post.title}
        </h1>

        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-outline-variant/20">
          <div className="w-10 h-10 rounded-full bg-surface-container-high overflow-hidden relative">
            {post.author.avatarUrl ? (
              <img
                src={post.author.avatarUrl}
                alt={post.author.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              <span className="material-symbols-outlined text-on-surface-variant absolute inset-0 flex items-center justify-center">
                person
              </span>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-on-surface">{post.author.name}</p>
            <p className="text-xs text-on-surface-variant">
              {new Date(post.publishedAt).toLocaleDateString("zh-CN", {
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>
          </div>
        </div>

        <article className="prose-custom text-base text-on-surface leading-relaxed space-y-4 mb-10">
          {post.body.split("\n\n").map((paragraph, index) => {
            if (paragraph.startsWith("## ")) {
              return (
                <h2
                  key={index}
                  className="font-[var(--font-display)] text-xl font-medium text-on-surface mt-8 mb-3"
                >
                  {paragraph.replace("## ", "")}
                </h2>
              );
            }

            if (paragraph.match(/^\d+\. /)) {
              const items = paragraph.split("\n").filter(Boolean);
              return (
                <ol key={index} className="list-decimal list-inside space-y-1.5 text-on-surface-variant">
                  {items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      dangerouslySetInnerHTML={{
                        __html: formatBold(item.replace(/^\d+\.\s*/, "")),
                      }}
                    />
                  ))}
                </ol>
              );
            }

            if (paragraph.startsWith("- ")) {
              const items = paragraph.split("\n").filter(Boolean);
              return (
                <ul key={index} className="list-disc list-inside space-y-1.5 text-on-surface-variant">
                  {items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      dangerouslySetInnerHTML={{
                        __html: formatBold(item.replace(/^-\s*/, "")),
                      }}
                    />
                  ))}
                </ul>
              );
            }

            return (
              <p
                key={index}
                className="text-on-surface-variant"
                dangerouslySetInnerHTML={{ __html: formatBold(paragraph) }}
              />
            );
          })}
        </article>

        <div className="flex items-center gap-4 py-4 border-t border-b border-outline-variant/20 mb-8">
          <button
            type="button"
            onClick={() => void handleLike()}
            disabled={pendingPostAction !== null}
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
              thumb_up
            </span>
            <span className="text-sm font-medium">{likeCount}</span>
          </button>
          <button
            type="button"
            onClick={() => void handleFavorite()}
            disabled={pendingPostAction !== null}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-300 ${
              favorited
                ? "bg-tertiary text-on-tertiary"
                : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
            }`}
          >
            <span
              className="material-symbols-outlined text-lg"
              style={favorited ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              bookmark
            </span>
            <span className="text-sm font-medium">{favoriteCount}</span>
          </button>
          <span className="flex items-center gap-1.5 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-lg">chat_bubble</span>
            {commentCount}
          </span>
          <span className="flex items-center gap-1.5 text-sm text-on-surface-variant ml-auto">
            <span className="material-symbols-outlined text-lg">visibility</span>
            {post.viewCount}
          </span>
        </div>

        <section className="mb-20">
          <h3 className="text-base font-medium text-on-surface mb-6">
            评论 ({commentCount})
          </h3>

          <div className="flex gap-3 mb-6">
            <div className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center flex-shrink-0">
              <span className="material-symbols-outlined text-sm text-on-surface-variant">person</span>
            </div>
            <div className="flex-1 flex gap-2">
              <input
                type="text"
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    void handleComment();
                  }
                }}
                placeholder="说点什么..."
                className="flex-1 bg-surface-container-low border-0 rounded-xl px-4 py-2.5 text-sm text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary transition-all"
              />
              <button
                type="button"
                onClick={() => void handleComment()}
                disabled={!commentText.trim() || submittingComment}
                className="px-4 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
              >
                {submittingComment ? "发送中" : "发送"}
              </button>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            {post.comments.map((comment) => (
              <CommentItem
                key={comment.id}
                comment={comment}
                pendingAction={pendingCommentAction}
                onReact={handleCommentReaction}
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
  pendingAction,
  onReact,
}: {
  comment: PostComment;
  pendingAction: string | null;
  onReact: (commentId: string, action: "like" | "favorite", active: boolean) => Promise<void>;
}) {
  const likeActionKey = `${comment.id}:like`;
  const favoriteActionKey = `${comment.id}:favorite`;

  return (
    <div className="flex gap-3">
      <div className="w-8 h-8 rounded-full bg-surface-container-high overflow-hidden relative flex-shrink-0">
        {comment.author.avatarUrl ? (
          <img
            src={comment.author.avatarUrl}
            alt={comment.author.name}
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <span className="material-symbols-outlined text-sm text-on-surface-variant absolute inset-0 flex items-center justify-center">
            person
          </span>
        )}
      </div>
      <div className="flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium text-on-surface">{comment.author.name}</span>
          <span className="text-xs text-on-surface-variant">
            {new Date(comment.createdAt).toLocaleDateString("zh-CN", {
              month: "short",
              day: "numeric",
            })}
          </span>
        </div>
        <p className="text-sm text-on-surface-variant mt-1 leading-relaxed">{comment.body}</p>
        <div className="mt-3 flex items-center gap-3 text-xs text-on-surface-variant">
          <button
            type="button"
            onClick={() => void onReact(comment.id, "like", comment.liked)}
            disabled={pendingAction === likeActionKey}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
              comment.liked
                ? "bg-secondary-container text-on-secondary-container"
                : "bg-surface-container-low"
            }`}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={comment.liked ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              thumb_up
            </span>
            {comment._count.likes}
          </button>
          <button
            type="button"
            onClick={() => void onReact(comment.id, "favorite", comment.favorited)}
            disabled={pendingAction === favoriteActionKey}
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 transition-colors ${
              comment.favorited ? "bg-tertiary text-on-tertiary" : "bg-surface-container-low"
            }`}
          >
            <span
              className="material-symbols-outlined text-sm"
              style={comment.favorited ? { fontVariationSettings: "'FILL' 1" } : undefined}
            >
              bookmark
            </span>
            {comment._count.favorites}
          </button>
        </div>

        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-3 ml-2 pl-3 border-l border-outline-variant/20 flex flex-col gap-3">
            {comment.replies.map((reply) => (
              <CommentItem
                key={reply.id}
                comment={reply}
                pendingAction={pendingAction}
                onReact={onReact}
              />
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
      <button
        onClick={onBack}
        className="w-10 h-10 flex items-center justify-center text-on-surface hover:opacity-70 transition-opacity rounded-full"
      >
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

function formatBold(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "<strong class='text-on-surface font-medium'>$1</strong>");
}

function updateCommentReaction(
  comments: PostComment[],
  commentId: string,
  action: "like" | "favorite",
  data: CommentLikeResponse | CommentFavoriteResponse
): PostComment[] {
  return comments.map((comment) => {
    if (comment.id === commentId) {
      if (action === "like") {
        const likeData = data as CommentLikeResponse;
        return {
          ...comment,
          liked: likeData.liked,
          _count: {
            ...comment._count,
            likes: likeData.likeCount,
          },
        };
      }

      const favoriteData = data as CommentFavoriteResponse;
      return {
        ...comment,
        favorited: favoriteData.favorited,
        _count: {
          ...comment._count,
          favorites: favoriteData.favoriteCount,
        },
      };
    }

    if (!comment.replies?.length) {
      return comment;
    }

    return {
      ...comment,
      replies: updateCommentReaction(comment.replies, commentId, action, data),
    };
  });
}

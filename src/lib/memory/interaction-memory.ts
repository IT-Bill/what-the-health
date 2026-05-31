import { rememberInBackground } from "./vector-memory";
import { recordPersonaSignalsInBackground, type PersonaSignals } from "./persona-signals";

type PostMemoryTarget = {
  id: string;
  title: string;
  excerpt?: string | null;
  category?: string | null;
};

type CommentMemoryTarget = {
  id: string;
  body: string;
  postId: string;
  postTitle: string;
};

const actionLabels = {
  like: "点赞",
  favorite: "收藏",
  comment: "评论",
} as const;

export function rememberPostInteraction(input: {
  userId: string;
  action: keyof typeof actionLabels;
  post: PostMemoryTarget;
  commentBody?: string;
}): void {
  const label = actionLabels[input.action];
  const summary = summarizePost(input.post);
  const note =
    input.action === "comment"
      ? `用户在帖子《${input.post.title}》下评论：“${input.commentBody ?? ""}”。这反映了用户对该主题的主动表达或关注。帖子摘要：${summary}`
      : `用户${label}了帖子《${input.post.title}》。这反映了用户对该主题的兴趣或偏好。帖子摘要：${summary}`;

  rememberInBackground({
    userId: input.userId,
    source: `post-${input.action}`,
    sourceId: input.post.id,
    note,
    prompt: input.post.excerpt ?? null,
    metadata: {
      targetType: "post",
      action: input.action,
      postId: input.post.id,
      title: input.post.title,
      summary,
      category: input.post.category,
    },
  });

  recordPersonaSignalsInBackground(input.userId, buildPostPersonaSignals(input));
}

export function rememberCommentInteraction(input: {
  userId: string;
  action: "like" | "favorite";
  comment: CommentMemoryTarget;
}): void {
  const label = actionLabels[input.action];
  rememberInBackground({
    userId: input.userId,
    source: `comment-${input.action}`,
    sourceId: input.comment.id,
    note: `用户${label}了帖子《${input.comment.postTitle}》下的评论：“${input.comment.body}”。这反映了用户对该观点或表达方式的兴趣。`,
    metadata: {
      targetType: "comment",
      action: input.action,
      commentId: input.comment.id,
      postId: input.comment.postId,
      postTitle: input.comment.postTitle,
    },
  });

  recordPersonaSignalsInBackground(input.userId, buildCommentPersonaSignals(input));
}

export function buildPostPersonaSignals(input: {
  action: keyof typeof actionLabels;
  post: PostMemoryTarget;
  commentBody?: string;
}): PersonaSignals {
  const label = actionLabels[input.action];
  return {
    focusAreas: [input.post.title, input.post.category].filter(Boolean) as string[],
    preferenceSignals: [
      input.action === "comment"
        ? `用户会通过评论主动表达对《${input.post.title}》这类内容的看法；帖子摘要：${summarizePost(input.post)}`
        : `用户通过${label}表达了对《${input.post.title}》这类内容的兴趣；帖子摘要：${summarizePost(input.post)}`,
    ],
    behaviorSignals:
      input.action === "comment" && input.commentBody
        ? [`用户曾围绕《${input.post.title}》评论：“${input.commentBody}”。`]
        : [],
  };
}

function summarizePost(post: PostMemoryTarget): string {
  const summary = post.excerpt?.trim() || post.title;
  return summary.length > 180 ? `${summary.slice(0, 180)}...` : summary;
}

export function buildCommentPersonaSignals(input: {
  action: "like" | "favorite";
  comment: CommentMemoryTarget;
}): PersonaSignals {
  const label = actionLabels[input.action];
  return {
    focusAreas: [input.comment.postTitle],
    preferenceSignals: [
      `用户通过${label}表达了对《${input.comment.postTitle}》下某条观点或表达方式的兴趣。`,
    ],
  };
}

// Shared types for Discover/Post feature.
// Re-exports Prisma-generated types + defines API response shapes.

export type {
  Post,
  Comment,
  Like,
  JourneyCategory,
} from "@/generated/prisma/client";

/** Post card displayed in the discover feed. */
export interface PostCard {
  id: string;
  title: string;
  excerpt: string | null;
  category: string;
  categoryIcon: string | null;
  coverImage: string | null;
  readMinutes: number;
  viewCount: number;
  publishedAt: string;
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  _count: {
    likes: number;
    comments: number;
    favorites: number;
  };
}

/** Full post detail with comments. */
export interface PostDetail extends PostCard {
  body: string;
  liked: boolean; // whether current user has liked
  favorited: boolean;
  comments: PostComment[];
}

export interface PostComment {
  id: string;
  body: string;
  createdAt: string;
  parentId: string | null;
  liked: boolean;
  favorited: boolean;
  _count: {
    likes: number;
    favorites: number;
  };
  author: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  replies?: PostComment[];
}

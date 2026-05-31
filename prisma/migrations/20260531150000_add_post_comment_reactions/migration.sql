-- CreateTable
CREATE TABLE "post_favorites" (
    "id" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "post_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_likes" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_likes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_favorites" (
    "id" TEXT NOT NULL,
    "commentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "comment_favorites_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "post_favorites_postId_idx" ON "post_favorites"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "post_favorites_postId_authorId_key" ON "post_favorites"("postId", "authorId");

-- CreateIndex
CREATE INDEX "comment_likes_commentId_idx" ON "comment_likes"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_likes_commentId_authorId_key" ON "comment_likes"("commentId", "authorId");

-- CreateIndex
CREATE INDEX "comment_favorites_commentId_idx" ON "comment_favorites"("commentId");

-- CreateIndex
CREATE UNIQUE INDEX "comment_favorites_commentId_authorId_key" ON "comment_favorites"("commentId", "authorId");

-- AddForeignKey
ALTER TABLE "post_favorites" ADD CONSTRAINT "post_favorites_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "post_favorites" ADD CONSTRAINT "post_favorites_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_likes" ADD CONSTRAINT "comment_likes_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_favorites" ADD CONSTRAINT "comment_favorites_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_favorites" ADD CONSTRAINT "comment_favorites_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
-- Enable pg_trgm extension for fuzzy search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN indexes for fast ILIKE queries on post title and excerpt
CREATE INDEX idx_posts_title_trgm ON posts USING GIN (title gin_trgm_ops);
CREATE INDEX idx_posts_excerpt_trgm ON posts USING GIN (excerpt gin_trgm_ops);

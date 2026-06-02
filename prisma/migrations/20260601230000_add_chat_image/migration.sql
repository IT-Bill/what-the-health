-- Add imageUrl column to chat_messages for image upload support
ALTER TABLE "chat_messages" ADD COLUMN "image_url" TEXT;

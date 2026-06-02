"use client";

import type { Message } from "@/lib/chat/types";

interface UserBubbleProps {
  message: Message;
}

export function UserBubble({ message }: UserBubbleProps) {
  return (
    <div className="flex w-full justify-end py-1">
      <div className="flex flex-col items-end gap-1.5 max-w-[85%] md:max-w-[70%]">
        {message.imageUrl && (
          <div className="bg-surface-container-high rounded-sm overflow-hidden shadow-sm max-w-xs sm:max-w-sm">
            <img
              src={message.imageUrl}
              alt="Uploaded"
              className="w-full h-auto object-contain block"
              loading="lazy"
              onClick={() => window.open(message.imageUrl, "_blank")}
            />
          </div>
        )}
        {message.content && (
          <div className="bg-surface-container-high rounded-[20px] rounded-tr-[4px] px-4 py-2.5">
            <p className="text-on-surface text-base leading-relaxed">{message.content}</p>
          </div>
        )}
      </div>
    </div>
  );
}

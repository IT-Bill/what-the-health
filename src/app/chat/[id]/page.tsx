"use client";

import { useParams } from "next/navigation";
import ChatCore from "@/components/chat/chat-core";

export default function ChatSessionPage() {
  const params = useParams();
  const id = params?.id as string | undefined;

  return <ChatCore initialSessionId={id} />;
}

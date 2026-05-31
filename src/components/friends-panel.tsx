"use client";

import { useState, useEffect, useCallback, type ReactNode } from "react";
import Link from "next/link";
import { Icon } from "@/components/icon";

// --- Types ---
interface FriendUser {
  id: string;
  username: string;
  name: string;
  avatarUrl: string | null;
}

interface Friend extends FriendUser {
  friendshipId: string;
  since: string;
}

interface PendingRequest {
  friendshipId: string;
  user: FriendUser;
  createdAt: string;
}

interface SearchResult extends FriendUser {
  friendshipStatus: string | null;
  friendshipId: string | null;
}

interface FriendsData {
  friends: Friend[];
  pendingReceived: PendingRequest[];
  pendingSent: PendingRequest[];
}

const TABS = ["好友", "添加", "请求"] as const;
type Tab = (typeof TABS)[number];

const PERMISSIONS_MAP: Record<string, string> = {
  weeklyReport: "周报",
  monthlyReport: "月报",
  insights: "AI 洞察",
  goals: "目标进度",
  moodHistory: "情绪记录",
  posts: "文章",
};

export function FriendsPanel() {
  const [activeTab, setActiveTab] = useState<Tab>("好友");
  const [data, setData] = useState<FriendsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchFriends = useCallback(() => {
    setLoading(true);
    fetch("/api/friends")
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchFriends();
  }, [fetchFriends]);

  const pendingCount = data ? data.pendingReceived.length : 0;

  return (
    <div className="flex flex-col gap-6 pb-24">
      {/* Tabs */}
      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 relative ${
              activeTab === tab
                ? "bg-secondary-container text-on-secondary-container"
                : "border border-outline-variant/30 text-on-surface-variant hover:bg-surface-variant/20"
            }`}
          >
            {tab}
            {tab === "请求" && pendingCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-error text-on-error text-[10px] font-bold rounded-full flex items-center justify-center">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === "好友" && (
        <FriendsList
          friends={data?.friends ?? []}
          loading={loading}
          onUpdate={fetchFriends}
        />
      )}
      {activeTab === "添加" && <SearchTab onUpdate={fetchFriends} />}
      {activeTab === "请求" && (
        <RequestsTab
          received={data?.pendingReceived ?? []}
          sent={data?.pendingSent ?? []}
          loading={loading}
          onUpdate={fetchFriends}
        />
      )}
    </div>
  );
}

// --- Friends List ---
function FriendsList({
  friends,
  loading,
  onUpdate,
}: {
  friends: Friend[];
  loading: boolean;
  onUpdate: () => void;
}) {
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-primary-container rounded-2xl h-20" />
        ))}
      </div>
    );
  }

  if (friends.length === 0) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <Icon name="group" />
        <p className="text-lg">还没有好友</p>
        <p className="text-sm mt-1">切换到"添加"标签搜索用户</p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-3">
        {friends.map((friend) => (
          <div
            key={friend.id}
            className="bg-primary-container rounded-2xl p-4 ambient-shadow flex items-center gap-3"
          >
            <Avatar user={friend} size={44} />
            <div className="flex-1 min-w-0">
              <p className="text-base font-medium text-on-surface">{friend.name}</p>
              <p className="text-xs text-on-surface-variant">@{friend.username}</p>
            </div>
            <button
              onClick={() => setViewingFriend(friend)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-secondary hover:bg-secondary-container/50 transition-colors"
              title="查看分享"
            >
              <Icon name="visibility" />
            </button>
            <button
              onClick={() => setSelectedFriend(friend)}
              className="w-9 h-9 rounded-xl flex items-center justify-center text-on-surface-variant hover:bg-surface-variant/30 transition-colors"
              title="权限设置"
            >
              <Icon name="settings" />
            </button>
          </div>
        ))}
      </div>

      {/* View friend's shared content */}
      {viewingFriend && (
        <SharedContentView
          friend={viewingFriend}
          onClose={() => setViewingFriend(null)}
        />
      )}

      {/* Permission Management Modal */}
      {selectedFriend && (
        <PermissionsPanel
          friend={selectedFriend}
          onClose={() => setSelectedFriend(null)}
          onUnfriend={() => {
            setSelectedFriend(null);
            onUpdate();
          }}
        />
      )}
    </>
  );
}

// --- Permission Panel ---
function PermissionsPanel({
  friend,
  onClose,
  onUnfriend,
}: {
  friend: Friend;
  onClose: () => void;
  onUnfriend: () => void;
}) {
  const [granted, setGranted] = useState<string[]>([]);
  const [received, setReceived] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`/api/friends/permissions?friendId=${friend.id}`)
      .then((r) => r.json())
      .then((d) => {
        setGranted(d.granted);
        setReceived(d.received);
      })
      .finally(() => setLoading(false));
  }, [friend.id]);

  function togglePermission(content: string) {
    setGranted((prev) =>
      prev.includes(content) ? prev.filter((p) => p !== content) : [...prev, content]
    );
  }

  async function save() {
    setSaving(true);
    await fetch("/api/friends/permissions", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ friendId: friend.id, permissions: granted }),
    });
    setSaving(false);
  }

  async function handleUnfriend() {
    if (!confirm(`确定要解除与 ${friend.name} 的好友关系吗？`)) return;
    await fetch(`/api/friends/${friend.friendshipId}`, { method: "DELETE" });
    onUnfriend();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-inverse-surface/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface w-full sm:w-[420px] sm:rounded-2xl rounded-t-2xl max-h-[80vh] overflow-y-auto p-6 flex flex-col gap-5 animate-[fadeIn_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Avatar user={friend} size={40} />
          <div>
            <p className="text-base font-medium text-on-surface">{friend.name}</p>
            <p className="text-xs text-on-surface-variant">@{friend.username}</p>
          </div>
          <button onClick={onClose} className="ml-auto text-on-surface-variant hover:text-on-surface">
            <Icon name="close" />
          </button>
        </div>

        {loading ? (
          <div className="py-8 text-center text-on-surface-variant">加载中...</div>
        ) : (
          <>
            {/* My permissions to this friend */}
            <section>
              <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3">
                允许对方查看
              </h3>
              <div className="flex flex-col gap-2">
                {Object.entries(PERMISSIONS_MAP).map(([key, label]) => (
                  <label key={key} className="flex items-center justify-between py-2 cursor-pointer">
                    <span className="text-sm text-on-surface">{label}</span>
                    <button
                      onClick={() => togglePermission(key)}
                      className={`relative w-10 h-5 rounded-full transition-colors duration-300 ${
                        granted.includes(key) ? "bg-secondary" : "bg-surface-variant"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white border transition-all duration-300 ${
                          granted.includes(key) ? "right-0.5 border-secondary" : "left-0.5 border-outline-variant"
                        }`}
                      />
                    </button>
                  </label>
                ))}
              </div>
            </section>

            {/* What they share with me (read-only) */}
            <section>
              <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3">
                对方分享给我
              </h3>
              <div className="flex flex-wrap gap-2">
                {received.length === 0 ? (
                  <p className="text-xs text-on-surface-variant">对方暂未分享任何内容</p>
                ) : (
                  received.map((p) => (
                    <span key={p} className="text-xs bg-secondary-container/50 text-on-secondary-container px-3 py-1 rounded-lg">
                      {PERMISSIONS_MAP[p] || p}
                    </span>
                  ))
                )}
              </div>
            </section>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={save}
                disabled={saving}
                className="flex-1 py-2.5 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {saving ? "保存中..." : "保存权限"}
              </button>
              <button
                onClick={handleUnfriend}
                className="px-4 py-2.5 rounded-xl border border-error/30 text-error text-sm font-medium hover:bg-error/5 transition-colors"
              >
                解除好友
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// --- Search Tab ---
function SearchTab({ onUpdate }: { onUpdate: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [message, setMessage] = useState("");

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setMessage("");
    try {
      const res = await fetch(`/api/friends/search?q=${encodeURIComponent(query.trim())}`);
      const data = await res.json();
      if (res.ok) {
        setResults(data);
        if (data.length === 0) setMessage("未找到用户");
      } else {
        setMessage(data.error || "搜索失败");
      }
    } catch {
      setMessage("网络错误");
    } finally {
      setSearching(false);
    }
  }

  async function sendRequest(userId: string) {
    const res = await fetch("/api/friends", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId }),
    });
    const data = await res.json();
    if (res.ok) {
      setMessage("好友请求已发送");
      // Update status in results
      setResults((prev) =>
        prev.map((r) => (r.id === userId ? { ...r, friendshipStatus: "pending_sent" } : r))
      );
      onUpdate();
    } else {
      setMessage(data.error || "发送失败");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Search Input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="输入用户名或昵称搜索..."
          className="flex-1 bg-surface-container-low border-0 rounded-xl px-4 py-3 text-sm text-on-surface placeholder:text-outline-variant focus:ring-1 focus:ring-secondary transition-all"
        />
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-3 rounded-xl bg-secondary text-on-secondary text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          <Icon name="search" />
        </button>
      </div>

      {message && (
        <p className="text-sm text-on-surface-variant text-center">{message}</p>
      )}

      {/* Results */}
      <div className="flex flex-col gap-3">
        {results.map((user) => (
          <div key={user.id} className="bg-primary-container rounded-2xl p-4 ambient-shadow flex items-center gap-4">
            <Avatar user={user} size={40} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-on-surface">{user.name}</p>
              <p className="text-xs text-on-surface-variant">@{user.username}</p>
            </div>
            {user.friendshipStatus === "friend" ? (
              <span className="text-xs text-secondary font-medium">已是好友</span>
            ) : user.friendshipStatus === "pending_sent" ? (
              <span className="text-xs text-on-surface-variant">已发送</span>
            ) : user.friendshipStatus === "pending_received" ? (
              <span className="text-xs text-on-surface-variant">待接受</span>
            ) : user.friendshipStatus === "blocked" ? (
              <span className="text-xs text-error">已屏蔽</span>
            ) : (
              <button
                onClick={() => sendRequest(user.id)}
                className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-medium hover:opacity-90 transition-opacity"
              >
                添加
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// --- Requests Tab ---
function RequestsTab({
  received,
  sent,
  loading,
  onUpdate,
}: {
  received: PendingRequest[];
  sent: PendingRequest[];
  loading: boolean;
  onUpdate: () => void;
}) {
  async function handleAction(friendshipId: string, action: "accept" | "reject") {
    await fetch(`/api/friends/${friendshipId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    onUpdate();
  }

  if (loading) {
    return <div className="animate-pulse bg-primary-container rounded-2xl h-20" />;
  }

  if (received.length === 0 && sent.length === 0) {
    return (
      <div className="text-center py-16 text-on-surface-variant">
        <Icon name="mark_email_read" />
        <p>没有待处理的请求</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Received */}
      {received.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3">
            收到的请求
          </h3>
          <div className="flex flex-col gap-3">
            {received.map((req) => (
              <div key={req.friendshipId} className="bg-primary-container rounded-2xl p-4 ambient-shadow flex items-center gap-4">
                <Avatar user={req.user} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">{req.user.name}</p>
                  <p className="text-xs text-on-surface-variant">@{req.user.username}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAction(req.friendshipId, "accept")}
                    className="px-3 py-1.5 rounded-lg bg-secondary text-on-secondary text-xs font-medium hover:opacity-90"
                  >
                    接受
                  </button>
                  <button
                    onClick={() => handleAction(req.friendshipId, "reject")}
                    className="px-3 py-1.5 rounded-lg border border-outline-variant/30 text-on-surface-variant text-xs font-medium hover:bg-surface-variant/20"
                  >
                    拒绝
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Sent */}
      {sent.length > 0 && (
        <section>
          <h3 className="text-sm font-medium text-on-surface-variant uppercase tracking-widest mb-3">
            已发送的请求
          </h3>
          <div className="flex flex-col gap-3">
            {sent.map((req) => (
              <div key={req.friendshipId} className="bg-primary-container rounded-2xl p-4 ambient-shadow flex items-center gap-3">
                <Avatar user={req.user} size={40} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">{req.user.name}</p>
                  <p className="text-xs text-on-surface-variant">@{req.user.username}</p>
                </div>
                <span className="text-xs text-on-surface-variant">等待确认</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// --- Shared Content Viewer ---
function SharedContentView({ friend, onClose }: { friend: Friend; onClose: () => void }) {
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/friends/${friend.id}/shared`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [friend.id]);

  const permissions = (data?.permissions ?? []) as string[];

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-inverse-surface/30 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-surface w-full sm:w-[480px] sm:rounded-2xl rounded-t-2xl max-h-[85vh] overflow-y-auto p-6 flex flex-col gap-5 animate-[fadeIn_0.2s_ease]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3">
          <Avatar user={friend} size={40} />
          <div className="flex-1">
            <p className="text-base font-medium text-on-surface">{friend.name} 的分享</p>
            <p className="text-xs text-on-surface-variant">@{friend.username}</p>
          </div>
          <button onClick={onClose} className="text-on-surface-variant hover:text-on-surface">
            <Icon name="close" />
          </button>
        </div>

        {loading ? (
          <div className="py-12 text-center text-on-surface-variant">加载中...</div>
        ) : permissions.length === 0 ? (
          <div className="py-12 text-center text-on-surface-variant">
            <Icon name="lock" />
            <p>对方暂未分享任何内容给你</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {/* Weekly Report */}
            {!!data?.weeklyReport && (
              <SharedSection title="周报" icon="calendar_view_week">
                <ReportCard report={data.weeklyReport as Record<string, unknown>} />
              </SharedSection>
            )}

            {/* Monthly Report */}
            {!!data?.monthlyReport && (
              <SharedSection title="月报" icon="calendar_month">
                <ReportCard report={data.monthlyReport as Record<string, unknown>} />
              </SharedSection>
            )}

            {/* Insights */}
            {Array.isArray(data?.insights) && data.insights.length > 0 && (
              <SharedSection title="AI 洞察" icon="psychology">
                <div className="flex flex-col gap-2">
                  {(data.insights as Array<{ id: string; title: string; content: string; type: string }>).map((insight) => (
                    <div key={insight.id} className="bg-surface-container-low rounded-xl p-3">
                      <p className="text-sm font-medium text-on-surface">{insight.title}</p>
                      <p className="text-xs text-on-surface-variant mt-1 line-clamp-2">{insight.content}</p>
                    </div>
                  ))}
                </div>
              </SharedSection>
            )}

            {/* Goals */}
            {Array.isArray(data?.goals) && data.goals.length > 0 && (
              <SharedSection title="目标进度" icon="flag">
                <div className="flex flex-col gap-2">
                  {(data.goals as Array<{ id: string; title: string; icon: string; completionsThisWeek: number }>).map((goal) => (
                    <div key={goal.id} className="flex items-center gap-3 py-1">
                      <Icon name={goal.icon} />
                      <span className="text-sm text-on-surface flex-1">{goal.title}</span>
                      <span className="text-xs text-on-surface-variant">{goal.completionsThisWeek}次/周</span>
                    </div>
                  ))}
                </div>
              </SharedSection>
            )}

            {/* Mood History */}
            {Array.isArray(data?.moodHistory) && data.moodHistory.length > 0 && (
              <SharedSection title="情绪记录" icon="mood">
                <div className="flex flex-wrap gap-2">
                  {(data.moodHistory as Array<{ mood: string; createdAt: string }>).map((m, i) => {
                    const emoji = m.mood === "calm" ? "😊" : m.mood === "anxious" ? "😰" : "😴";
                    return (
                      <div key={i} className="flex flex-col items-center">
                        <span className="text-lg">{emoji}</span>
                        <span className="text-[9px] text-on-surface-variant">
                          {new Date(m.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" })}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SharedSection>
            )}

            {/* Posts */}
            {Array.isArray(data?.posts) && data.posts.length > 0 && (
              <SharedSection title="文章" icon="article">
                <div className="flex flex-col gap-2">
                  {(data.posts as Array<{ id: string; title: string; excerpt: string | null; publishedAt: string }>).map((post) => (
                    <Link
                      key={post.id}
                      href={`/discover/${post.id}`}
                      className="bg-surface-container-low rounded-xl p-3 hover:bg-surface-variant/30 transition-colors"
                    >
                      <p className="text-sm font-medium text-on-surface line-clamp-1">{post.title}</p>
                      {post.excerpt && <p className="text-xs text-on-surface-variant mt-0.5 line-clamp-1">{post.excerpt}</p>}
                    </Link>
                  ))}
                </div>
              </SharedSection>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function SharedSection({ title, icon, children }: { title: string; icon: string; children: ReactNode }) {
  return (
    <section className="bg-primary-container rounded-2xl p-4 ambient-shadow">
      <div className="flex items-center gap-2 mb-3">
        <Icon name={icon} />
        <h4 className="text-sm font-medium text-on-surface">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function ReportCard({ report }: { report: Record<string, unknown> }) {
  const data = report.data as Record<string, unknown> | undefined;
  const summary = report.summary as string | undefined;
  const score = data?.overallScore as number | undefined;

  return (
    <div className="flex flex-col gap-2">
      {score !== undefined && (
        <div className="flex items-center gap-2">
          <span className="text-2xl font-semibold text-on-surface">{score}</span>
          <span className="text-xs text-on-surface-variant">/100 综合评分</span>
        </div>
      )}
      {!!summary && <p className="text-xs text-on-surface-variant italic">{summary}</p>}
      {Array.isArray(data?.moodEmojis) && (
        <div className="flex gap-0.5 flex-wrap">
          {(data.moodEmojis as string[]).slice(0, 7).map((e, i) => (
            <span key={i} className="text-sm">{e}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Shared Components ---
function Avatar({ user, size = 40 }: { user: FriendUser; size?: number }) {
  return (
    <div
      className="rounded-full bg-surface-container-high overflow-hidden relative flex-shrink-0"
      style={{ width: size, height: size }}
    >
      {user.avatarUrl ? (
        <img src={user.avatarUrl} alt={user.name} className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Icon name="person" className="text-on-surface-variant absolute inset-0 flex items-center justify-center text-lg" />
      )}
    </div>
  );
}


import { useState, useEffect, useCallback } from "react";
import {
  familyApi,
  type FamilyData,
  type FamilyMembership,
  type WardrobeItem,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";

/* ---------- Role badge ---------- */

function RoleBadge({ role }: { role: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    owner: {
      label: "Власник",
      cls: "bg-[#c9a55a]/15 text-[#c9a55a]",
    },
    admin: {
      label: "Адмін",
      cls: "bg-[#c9a55a]/10 text-[#dbb978]",
    },
    member: {
      label: "Учасник",
      cls: "bg-white/[0.06] text-[#f0ece4]/55",
    },
  };
  const badge = map[role] ?? map.member;
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}
    >
      {badge.label}
    </span>
  );
}

/* ---------- Member avatar ---------- */

function MemberAvatar({
  member,
}: {
  member: FamilyMembership["user"];
}) {
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.name ?? member.email}
        className="h-9 w-9 rounded-full object-cover ring-2 ring-[#c9a55a]/30"
        referrerPolicy="no-referrer"
      />
    );
  }
  return (
    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#c9a55a]/15 text-sm font-semibold text-[#c9a55a]">
      {(member.name ?? member.email).charAt(0).toUpperCase()}
    </div>
  );
}

/* ---------- Member wardrobe preview ---------- */

function WardrobePreview({
  items,
  onClose,
  memberName,
}: {
  items: WardrobeItem[];
  onClose: () => void;
  memberName: string;
}) {
  return (
    <div className="mt-3 rounded-lg border border-white/[0.06] bg-white/[0.03] p-3">
      <div className="mb-2 flex items-center justify-between">
        <h4 className="text-sm font-semibold text-[#f0ece4]/80">
          Гардероб — {memberName} ({items.length} речей)
        </h4>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-[#f0ece4]/35 hover:text-[#f0ece4]/55"
        >
          ✕
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[#f0ece4]/45">Гардероб порожній</p>
      ) : (
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {items.slice(0, 18).map((item) => (
            <div
              key={item.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-white/[0.06] bg-white/[0.05]"
            >
              <img
                src={item.thumbnailUrl ?? item.imageUrl}
                alt={item.category}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 bg-black/60 px-1 py-0.5 text-center text-[10px] text-[#f0ece4]/80">
                {item.category}
              </div>
            </div>
          ))}
          {items.length > 18 && (
            <div className="flex aspect-square items-center justify-center rounded-lg border border-dashed border-white/[0.1] text-xs text-[#f0ece4]/35">
              +{items.length - 18}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------- Family card ---------- */

function FamilyCard({
  family,
  currentUserId,
  onRefresh,
}: {
  family: FamilyData;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(family.name);
  const [wardrobePreview, setWardrobePreview] = useState<{
    items: WardrobeItem[];
    name: string;
  } | null>(null);
  const [loadingWardrobe, setLoadingWardrobe] = useState<string | null>(null);

  const isAdmin = family.myRole === "owner" || family.myRole === "admin";
  const isOwner = family.myRole === "owner";

  const handleAddMember = async () => {
    if (!addEmail.trim() || adding) return;
    setAdding(true);
    setError(null);
    try {
      await familyApi.addMember(family.id, addEmail.trim());
      setAddEmail("");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка додавання");
    } finally {
      setAdding(false);
    }
  };

  const handleRemoveMember = async (userId: string) => {
    setError(null);
    try {
      await familyApi.removeMember(family.id, userId);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка видалення");
    }
  };

  const handleLeave = async () => {
    setError(null);
    try {
      await familyApi.removeMember(family.id, currentUserId);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка виходу");
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await familyApi.remove(family.id);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка видалення");
    }
  };

  const handleRename = async () => {
    if (!editName.trim()) return;
    setError(null);
    try {
      await familyApi.update(family.id, editName.trim());
      setEditing(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка оновлення");
    }
  };

  const handleViewWardrobe = async (member: FamilyMembership) => {
    setLoadingWardrobe(member.userId);
    try {
      const data = await familyApi.getMemberWardrobe(family.id, member.userId);
      setWardrobePreview({
        items: data.items,
        name: member.user.name ?? member.user.email,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setLoadingWardrobe(null);
    }
  };

  return (
    <div className={`rounded-xl border bg-[#1a1a2e] p-4 ${isOwner ? "border-[#c9a55a]/30" : "border-white/[0.06]"}`}>
      {/* Header */}
      <div className="mb-3 flex items-center gap-3">
        {editing ? (
          <div className="flex flex-1 items-center gap-2">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="flex-1 rounded-lg border border-white/[0.12] bg-white/[0.05] px-3 py-1.5 text-sm text-[#f0ece4]
                focus:border-[#c9a55a] focus:outline-none focus:ring-1 focus:ring-[#c9a55a]"
              onKeyDown={(e) => e.key === "Enter" && handleRename()}
            />
            <button
              type="button"
              onClick={handleRename}
              className="rounded-lg bg-[#c9a55a] px-3 py-1.5 text-sm font-medium text-[#0f0f1a] hover:bg-[#dbb978]"
            >
              ✓
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setEditName(family.name);
              }}
              className="rounded-lg px-3 py-1.5 text-sm text-[#f0ece4]/45 hover:bg-white/[0.05]"
            >
              ✕
            </button>
          </div>
        ) : (
          <>
            <h3 className="flex-1 text-lg font-semibold text-[#f0ece4]">
              {family.name}
            </h3>
            {isAdmin && (
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="rounded-md px-2 py-1 text-xs text-[#f0ece4]/35 hover:bg-white/[0.05] hover:text-[#f0ece4]/55"
                title="Перейменувати"
              >
                ✏️
              </button>
            )}
          </>
        )}
      </div>

      {error && (
        <div className="mb-3 rounded-lg border border-red-500/20 bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Members */}
      <div className="space-y-2">
        {family.members.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 rounded-lg p-2 hover:bg-white/[0.03]"
          >
            <MemberAvatar member={m.user} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-medium text-[#f0ece4]/80">
                  {m.user.name ?? m.user.email}
                </span>
                <RoleBadge role={m.role} />
              </div>
              <span className="text-xs text-[#f0ece4]/35">{m.user.email}</span>
            </div>

            {/* Wardrobe button */}
            <button
              type="button"
              onClick={() => handleViewWardrobe(m)}
              disabled={loadingWardrobe === m.userId}
              className="rounded-lg bg-[#c9a55a]/10 px-3 py-1.5 text-xs font-medium text-[#c9a55a] hover:bg-[#c9a55a]/20 disabled:opacity-50"
            >
              {loadingWardrobe === m.userId ? "..." : "Гардероб"}
            </button>

            {/* Remove / leave */}
            {m.userId === currentUserId && !isOwner && (
              <button
                type="button"
                onClick={handleLeave}
                className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20"
              >
                Покинути
              </button>
            )}
            {isAdmin && m.userId !== currentUserId && m.role !== "owner" && (
              <button
                type="button"
                onClick={() => handleRemoveMember(m.userId)}
                className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/20"
              >
                Видалити
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Wardrobe preview */}
      {wardrobePreview && (
        <WardrobePreview
          items={wardrobePreview.items}
          memberName={wardrobePreview.name}
          onClose={() => setWardrobePreview(null)}
        />
      )}

      {/* Add member (admin/owner only) */}
      {isAdmin && (
        <div className="mt-4 border-t border-white/[0.06] pt-3">
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder="Email учасника"
              className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.05] px-3 py-2 text-sm text-[#f0ece4]
                placeholder:text-[#f0ece4]/25 focus:border-[#c9a55a] focus:outline-none focus:ring-1 focus:ring-[#c9a55a]"
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
            />
            <button
              type="button"
              onClick={handleAddMember}
              disabled={adding || !addEmail.trim()}
              className="rounded-lg bg-[#c9a55a] px-4 py-2 text-sm font-medium text-[#0f0f1a] hover:bg-[#dbb978] disabled:opacity-50"
            >
              {adding ? "..." : "Додати"}
            </button>
          </div>
        </div>
      )}

      {/* Delete family (owner only) */}
      {isOwner && (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleDelete}
            className="rounded-lg px-3 py-1.5 text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
          >
            Видалити родину
          </button>
        </div>
      )}
    </div>
  );
}

/* ---------- Main page ---------- */

export default function FamilyPage() {
  const { user } = useAuth();
  const [families, setFamilies] = useState<FamilyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFamilies = useCallback(async () => {
    try {
      const data = await familyApi.list();
      setFamilies(data.families);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка завантаження");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) return;
    setCreating(true);
    setError(null);
    try {
      await familyApi.create(newName.trim());
      setNewName("");
      await loadFamilies();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Помилка створення");
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#c9a55a] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div>
        <h1 className="font-display text-2xl font-semibold tracking-wide text-[#c9a55a]">
          Сімейний гардероб
        </h1>
        <p className="mt-1 text-sm text-[#f0ece4]/45">
          Створіть родину, додайте учасників і переглядайте гардероб одне одного.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Create family */}
      <div className="rounded-xl border border-white/[0.06] bg-[#1a1a2e] p-4">
        <h2 className="mb-3 text-lg font-semibold text-[#f0ece4]">
          Створити родину
        </h2>
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Назва родини"
            className="flex-1 rounded-lg border border-white/[0.06] bg-white/[0.05] px-3 py-2 text-sm text-[#f0ece4]
              placeholder:text-[#f0ece4]/25 focus:border-[#c9a55a] focus:outline-none focus:ring-1 focus:ring-[#c9a55a]"
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
          />
          <button
            type="button"
            onClick={handleCreate}
            disabled={creating || !newName.trim()}
            className="gold-btn px-4 py-2 text-sm disabled:opacity-50"
          >
            {creating ? "Створення..." : "Створити"}
          </button>
        </div>
      </div>

      {/* Family list */}
      {families.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-[#c9a55a]/20 bg-[#1a1a2e] p-8 text-center">
          <p className="text-lg text-[#f0ece4]/35">У вас поки немає родин</p>
          <p className="mt-1 text-sm text-[#f0ece4]/25">
            Створіть родину вище, щоб почати
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {families.map((f) => (
            <FamilyCard
              key={f.id}
              family={f}
              currentUserId={user?.id ?? ""}
              onRefresh={loadFamilies}
            />
          ))}
        </div>
      )}
    </div>
  );
}

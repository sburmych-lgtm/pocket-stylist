import { useState, useEffect, useCallback } from "react";
import {
  ArrowRight,
  Crown,
  Eye,
  LoaderCircle,
  PencilLine,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import {
  familyApi,
  type FamilyData,
  type FamilyMembership,
  type WardrobeItem,
} from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { useI18n } from "../i18n";

function RoleBadge({ role }: { role: string }) {
  const { t } = useI18n();
  const map: Record<string, { labelKey: string; cls: string; icon: string }> = {
    owner: {
      labelKey: "family.owner",
      cls: "bg-[rgba(201,165,90,0.12)] text-[var(--accent)]",
      icon: "♛",
    },
    admin: {
      labelKey: "family.admin",
      cls: "bg-[rgba(136,198,189,0.12)] text-[var(--accent-cool)]",
      icon: "✦",
    },
    member: {
      labelKey: "family.member",
      cls: "bg-white/[0.05] text-[var(--text-secondary)]",
      icon: "•",
    },
  };
  const badge = map[role] ?? map.member;

  return (
    <span className={`status-chip ${badge.cls}`}>
      <span>{badge.icon}</span>
      {t(badge.labelKey)}
    </span>
  );
}

function MemberAvatar({ member }: { member: FamilyMembership["user"] }) {
  if (member.avatarUrl) {
    return (
      <img
        src={member.avatarUrl}
        alt={member.name ?? member.email}
        className="h-12 w-12 rounded-full object-cover ring-1 ring-[rgba(201,165,90,0.28)]"
        referrerPolicy="no-referrer"
      />
    );
  }

  return (
    <div className="spotlight-ring flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(201,165,90,0.12)] text-base font-semibold text-[var(--accent)]">
      {(member.name ?? member.email).charAt(0).toUpperCase()}
    </div>
  );
}

function WardrobePreview({
  items,
  onClose,
  memberName,
}: {
  items: WardrobeItem[];
  onClose: () => void;
  memberName: string;
}) {
  const { t } = useI18n();

  return (
    <div className="mt-5 rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="section-subtitle">{t("family.sharedWardrobe")}</p>
          <h4 className="section-title mt-2">
            {memberName} · {items.length} {t("common.items")}
          </h4>
        </div>
        <button type="button" onClick={onClose} className="ghost-action px-4 py-2 text-sm">
          {t("family.hide")}
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-[var(--text-secondary)]">{t("family.emptyWardrobe")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {items.slice(0, 18).map((item) => (
            <div key={item.id} className="overflow-hidden rounded-[1rem] border border-white/8 bg-white/[0.03]">
              <img src={item.thumbnailUrl ?? item.imageUrl} alt={item.category} className="aspect-square h-full w-full object-cover" />
              <div className="px-2 py-2 text-center text-[0.65rem] uppercase tracking-[0.16em] text-[var(--text-muted)]">
                {item.category}
              </div>
            </div>
          ))}
          {items.length > 18 && (
            <div className="flex items-center justify-center rounded-[1rem] border border-dashed border-white/10 text-sm text-[var(--text-secondary)]">
              +{items.length - 18}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function FamilyCard({
  family,
  currentUserId,
  onRefresh,
}: {
  family: FamilyData;
  currentUserId: string;
  onRefresh: () => void;
}) {
  const { t } = useI18n();
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
    if (!addEmail.trim() || adding) {
      return;
    }
    setAdding(true);
    setError(null);
    try {
      await familyApi.addMember(family.id, addEmail.trim());
      setAddEmail("");
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
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
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleLeave = async () => {
    setError(null);
    try {
      await familyApi.removeMember(family.id, currentUserId);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleDelete = async () => {
    setError(null);
    try {
      await familyApi.remove(family.id);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    }
  };

  const handleRename = async () => {
    if (!editName.trim()) {
      return;
    }
    setError(null);
    try {
      await familyApi.update(family.id, editName.trim());
      setEditing(false);
      onRefresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
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
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoadingWardrobe(null);
    }
  };

  return (
    <article className={`luxe-card p-5 sm:p-6 ${isOwner ? "border-[rgba(201,165,90,0.24)]" : ""}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <span className="page-kicker">
            {isOwner ? <Crown size={14} /> : <ShieldCheck size={14} />}
            {t("family.atelier")}
          </span>

          {editing ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="input-surface px-4 py-3 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleRename()}
              />
              <button type="button" onClick={handleRename} className="primary-action px-4 py-3 text-sm">
                {t("family.save")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditName(family.name);
                }}
                className="ghost-action px-4 py-3 text-sm"
              >
                {t("family.cancel")}
              </button>
            </div>
          ) : (
            <div>
              <h3 className="text-3xl font-semibold text-[var(--text-primary)]">{family.name}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {t("family.membersCount", { count: family.members.length })}
              </p>
            </div>
          )}
        </div>

        {isAdmin && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm"
          >
            <PencilLine size={15} />
            {t("family.rename")}
          </button>
        )}
      </div>

      {error && <div className="mt-5 rounded-[1.2rem] border border-[rgba(239,138,128,0.22)] bg-[rgba(239,138,128,0.08)] px-4 py-3 text-sm text-[var(--danger)]">{error}</div>}

      <div className="mt-6 space-y-3">
        {family.members.map((member) => (
          <div
            key={member.id}
            className="rounded-[1.2rem] border border-white/8 bg-white/[0.03] p-4"
          >
            <div className="flex flex-wrap items-center gap-4">
              <MemberAvatar member={member.user} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-base font-semibold text-[var(--text-primary)]">
                    {member.user.name ?? member.user.email}
                  </p>
                  <RoleBadge role={member.role} />
                </div>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{member.user.email}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => handleViewWardrobe(member)}
                  disabled={loadingWardrobe === member.userId}
                  className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm disabled:opacity-50"
                >
                  {loadingWardrobe === member.userId ? <LoaderCircle size={15} className="animate-spin" /> : <Eye size={15} />}
                  {t("family.wardrobe")}
                </button>

                {member.userId === currentUserId && !isOwner && (
                  <button
                    type="button"
                    onClick={handleLeave}
                    className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm text-[var(--danger)]"
                  >
                    {t("family.leave")}
                  </button>
                )}

                {isAdmin && member.userId !== currentUserId && member.role !== "owner" && (
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(member.userId)}
                    className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm text-[var(--danger)]"
                  >
                    <Trash2 size={15} />
                    {t("family.deleteUser")}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {wardrobePreview && (
        <WardrobePreview
          items={wardrobePreview.items}
          memberName={wardrobePreview.name}
          onClose={() => setWardrobePreview(null)}
        />
      )}

      {isAdmin && (
        <div className="mt-6 rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="section-subtitle">{t("family.inviteMember")}</p>
              <h4 className="section-title mt-2">{t("family.addMember")}</h4>
            </div>
            <span className="metric-pill">
              <UserPlus size={14} className="text-[var(--accent)]" />
              {t("family.sharedAccess")}
            </span>
          </div>

          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <input
              type="email"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              placeholder={t("family.emailPlaceholder")}
              className="input-surface flex-1 px-4 py-3 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleAddMember()}
            />
            <button
              type="button"
              onClick={handleAddMember}
              disabled={adding || !addEmail.trim()}
              className="primary-action inline-flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
            >
              {adding ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />}
              {t("family.add")}
            </button>
          </div>
        </div>
      )}

      {isOwner && (
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={handleDelete}
            className="ghost-action inline-flex items-center gap-2 px-4 py-3 text-sm text-[var(--danger)]"
          >
            <Trash2 size={15} />
            {t("family.deleteFamily")}
          </button>
        </div>
      )}
    </article>
  );
}

export default function FamilyPage() {
  const { user } = useAuth();
  const { t } = useI18n();
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
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadFamilies();
  }, [loadFamilies]);

  const handleCreate = async () => {
    if (!newName.trim() || creating) {
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await familyApi.create(newName.trim());
      setNewName("");
      await loadFamilies();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("common.error"));
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle size={28} className="animate-spin text-[var(--accent)]" />
      </div>
    );
  }

  return (
    <div className="page-shell-tight space-y-8">
      <section className="page-header p-6 sm:p-8">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-5">
            <span className="page-kicker">
              <Users size={14} />
              {t("family.kicker")}
            </span>
            <h1 className="page-title">
              {t("family.heading").split("\n").map((line, i) => (
                <span key={i}>{i > 0 && <br />}{line}</span>
              ))}
            </h1>
            <p className="page-copy">
              {t("family.description")}
            </p>
          </div>

          <div className="luxe-card p-6">
            <p className="section-subtitle">{t("family.createFamily")}</p>
            <h2 className="section-title mt-2">{t("family.startHub")}</h2>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={t("family.familyName")}
                className="input-surface flex-1 px-4 py-3 text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleCreate()}
              />
              <button
                type="button"
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="primary-action inline-flex items-center justify-center gap-2 px-5 py-3 text-sm disabled:opacity-50"
              >
                {creating ? <LoaderCircle size={15} className="animate-spin" /> : <ArrowRight size={15} />}
                {t("family.create")}
              </button>
            </div>
          </div>
        </div>
      </section>

      {error && <div className="luxe-card border-[rgba(239,138,128,0.22)] p-4 text-sm text-[var(--danger)]">{error}</div>}

      {families.length === 0 ? (
        <section className="luxe-card p-10 text-center">
          <p className="section-subtitle">{t("family.noHubs")}</p>
          <h2 className="mt-3 text-2xl font-semibold text-[var(--text-primary)]">
            {t("family.noHubsTitle")}
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
            {t("family.noHubsDesc")}
          </p>
        </section>
      ) : (
        <div className="space-y-5">
          {families.map((family) => (
            <FamilyCard
              key={family.id}
              family={family}
              currentUserId={user?.id ?? ""}
              onRefresh={loadFamilies}
            />
          ))}
        </div>
      )}
    </div>
  );
}

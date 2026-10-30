import React, { useState, useMemo, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ArrowLeft,
  Calendar,
  MapPin,
  Sparkles,
  Clock,
  RefreshCw,
  Share2,
  Printer,
  Plus,
  Lock,
  Unlock,
  Edit2,
  Trash2,
  GripVertical,
  Utensils,
  Landmark,
  Hotel,
  Car,
  Compass,
  Undo2,
  RotateCcw,
  Copy,
  AlertCircle,
  ExternalLink,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Users,
  UserMinus,
  AlertTriangle,
  Check,
} from 'lucide-react';
import {
  useTrip,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
  useReorderItems,
  useReplaceItem,
  useRegenerateDay,
  useGenerateItinerary,
  useInviteMember,
  useRemoveMember,
  useGroupPreferences,
  useSaveGroupPreference,
  useVoteItem,
} from '../hooks/useTrips';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../hooks/useToast';
import type {
  ItineraryItem,
  ItineraryItemType,
  ItineraryDayWithItems,
  ItineraryItemInsert,
} from '../types';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Card } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { Modal, ModalFooter } from '../components/ui/Modal';
import { Skeleton } from '../components/ui/Skeleton';
import { toNumber, formatCurrency } from '../lib/utils';

// ─── Helpers & Style Mappings ────────────────────────────────────────────────

export const TYPE_CONFIG: Record<
  ItineraryItemType,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  dining: {
    label: 'Dining',
    bg: 'bg-amber-500/10',
    text: 'text-amber-400',
    border: 'border-amber-500/25',
    icon: <Utensils size={13} />,
  },
  attraction: {
    label: 'Attraction',
    bg: 'bg-violet-500/10',
    text: 'text-violet-400',
    border: 'border-violet-500/25',
    icon: <Landmark size={13} />,
  },
  accommodation: {
    label: 'Stay',
    bg: 'bg-blue-500/10',
    text: 'text-blue-400',
    border: 'border-blue-500/25',
    icon: <Hotel size={13} />,
  },
  transport: {
    label: 'Transit',
    bg: 'bg-emerald-500/10',
    text: 'text-emerald-400',
    border: 'border-emerald-500/25',
    icon: <Car size={13} />,
  },
  activity: {
    label: 'Activity',
    bg: 'bg-rose-500/10',
    text: 'text-rose-400',
    border: 'border-rose-500/25',
    icon: <Compass size={13} />,
  },
};

// ─── Sortable Activity Item Component ────────────────────────────────────────

interface SortableActivityProps {
  item: ItineraryItem;
  dayId: string;
  tripId: string;
  canEdit: boolean;
  onEdit: (item: ItineraryItem) => void;
  onReplace: (item: ItineraryItem) => void;
  onDelete: (item: ItineraryItem) => void;
  onToggleLock: (item: ItineraryItem) => void;
  onVote: (item: ItineraryItem, vote: number) => void;
}

export const SortableActivity: React.FC<SortableActivityProps> = ({
  item,
  canEdit,
  onEdit,
  onReplace,
  onDelete,
  onToggleLock,
  onVote,
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id, disabled: !canEdit });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.6 : 1,
  };

  const typeInfo = TYPE_CONFIG[item.type] || TYPE_CONFIG.activity;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group relative rounded-2xl bg-slate-900/80 border p-4 transition-all duration-200 ${
        item.is_locked
          ? 'border-amber-500/40 bg-amber-500/[0.03]'
          : 'border-slate-800 hover:border-slate-700/80'
      } ${isDragging ? 'shadow-2xl border-brand-500 scale-[1.02]' : ''}`}
    >
      <div className="flex items-start gap-3">
        {/* Drag Handle - Only if editor/owner */}
        {canEdit && (
          <button
            type="button"
            {...attributes}
            {...listeners}
            className="no-print mt-1 cursor-grab active:cursor-grabbing text-slate-600 hover:text-slate-400 p-1 -ml-1 rounded transition-colors"
            title="Drag to reorder"
            aria-label="Reorder activity"
          >
            <GripVertical size={16} />
          </button>
        )}

        {/* Time column */}
        <div className="w-16 flex-shrink-0 pt-0.5 font-mono text-xs text-slate-400">
          {item.start_time ? (
            <span className="flex items-center gap-1 font-semibold text-slate-300">
              <Clock size={11} className="text-slate-500" />
              {item.start_time.slice(0, 5)}
            </span>
          ) : (
            <span className="text-slate-600 text-[11px]">—:—</span>
          )}
          {item.end_time && (
            <p className="text-[10px] text-slate-500 mt-0.5">{item.end_time.slice(0, 5)}</p>
          )}
        </div>

        {/* Details column */}
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${typeInfo.bg} ${typeInfo.text} ${typeInfo.border}`}
            >
              {typeInfo.icon}
              {typeInfo.label}
            </span>

            {item.is_locked && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <Lock size={10} /> Locked
              </span>
            )}
          </div>

          <h4 className="text-sm font-bold text-slate-100 leading-snug">{item.title}</h4>

          {item.description && (
            <p className="text-xs text-slate-400 leading-relaxed">{item.description}</p>
          )}

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-400 pt-1">
            {item.location && (
              <a
                href={`https://maps.google.com/?q=${encodeURIComponent(item.location)}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 text-slate-400 hover:text-brand-300 transition-colors truncate max-w-xs"
              >
                <MapPin size={11} className="text-slate-500 flex-shrink-0" />
                <span className="truncate">{item.location}</span>
                <ExternalLink size={9} className="flex-shrink-0 opacity-70" />
              </a>
            )}

            {item.notes && (
              <span className="flex items-center gap-1 text-slate-400 italic">
                <MessageSquare size={11} className="text-slate-500" />
                {item.notes}
              </span>
            )}
          </div>
        </div>

        {/* Cost & Action Controls */}
        <div className="flex flex-col items-end gap-2 flex-shrink-0 ml-2">
          {item.estimated_cost != null && (
            <span className="font-mono text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-lg border border-emerald-500/20">
              {formatCurrency(item.estimated_cost)}
            </span>
          )}

          {/* Group Voting Controls - Available to everyone including viewers */}
          <div className="no-print flex items-center gap-1 bg-slate-800/80 rounded-lg p-0.5 border border-slate-700/60">
            <button
              type="button"
              onClick={() => onVote(item, item.user_vote === 1 ? 0 : 1)}
              title="Vote up"
              className={`px-1.5 py-1 rounded text-xs flex items-center gap-1 transition-all ${
                item.user_vote === 1
                  ? 'bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30'
                  : 'text-slate-400 hover:text-emerald-400 hover:bg-slate-700/50'
              }`}
            >
              <ThumbsUp size={11} className={item.user_vote === 1 ? 'fill-emerald-400' : ''} />
              <span className="text-[10px]">{item.upvotes || 0}</span>
            </button>
            <button
              type="button"
              onClick={() => onVote(item, item.user_vote === -1 ? 0 : -1)}
              title="Vote down"
              className={`px-1.5 py-1 rounded text-xs flex items-center gap-1 transition-all ${
                item.user_vote === -1
                  ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/30'
                  : 'text-slate-400 hover:text-rose-400 hover:bg-slate-700/50'
              }`}
            >
              <ThumbsDown size={11} className={item.user_vote === -1 ? 'fill-rose-400' : ''} />
              <span className="text-[10px]">{item.downvotes || 0}</span>
            </button>
          </div>

          {/* Quick buttons - only for editors/owner */}
          {canEdit && (
            <div className="no-print flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
              {/* Lock toggle */}
              <button
                type="button"
                onClick={() => onToggleLock(item)}
                title={item.is_locked ? 'Unlock (AI may regenerate)' : 'Lock (AI will keep this)'}
                className={`p-1.5 rounded-lg transition-colors ${
                  item.is_locked
                    ? 'bg-amber-500/20 text-amber-300 hover:bg-amber-500/30'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800'
                }`}
              >
                {item.is_locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>

              {/* Replace with AI */}
              <button
                type="button"
                onClick={() => onReplace(item)}
                title="Replace activity with AI suggestion"
                className="p-1.5 rounded-lg text-slate-500 hover:text-brand-300 hover:bg-brand-500/10 transition-colors"
              >
                <Sparkles size={13} />
              </button>

              {/* Edit */}
              <button
                type="button"
                onClick={() => onEdit(item)}
                title="Edit activity"
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-200 hover:bg-slate-800 transition-colors"
              >
                <Edit2 size={13} />
              </button>

              {/* Delete */}
              <button
                type="button"
                onClick={() => onDelete(item)}
                title="Delete activity"
                className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── Main Page Component ─────────────────────────────────────────────────────

export const TripDetailsPage: React.FC = () => {
  const { id: tripId = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { success, error: showError } = useToast();

  const { data: trip, isLoading, isError, refetch } = useTrip(tripId);

  const { user } = useAuth();

  // Mutations
  const createItem = useCreateItem();
  const updateItem = useUpdateItem();
  const deleteItem = useDeleteItem();
  const reorderItems = useReorderItems();
  const replaceItem = useReplaceItem();
  const regenerateDay = useRegenerateDay();
  const generateItinerary = useGenerateItinerary();
  const inviteMember = useInviteMember();
  const removeMember = useRemoveMember();
  const voteItem = useVoteItem();
  const saveGroupPreference = useSaveGroupPreference();
  const { data: groupPrefs } = useGroupPreferences(tripId);

  // Group collaboration & role detection
  const isOwner = trip ? trip.owner_id === user?.id : false;
  const currentMember = trip?.members?.find((m) => m.user_id === user?.id);
  const userRole: 'owner' | 'editor' | 'viewer' = isOwner
    ? 'owner'
    : currentMember?.role || 'viewer';
  const canEdit = userRole === 'owner' || userRole === 'editor';
  const isViewer = !canEdit;

  // Active view filters
  const [selectedDayNumber, setSelectedDayNumber] = useState<number | 'all'>('all');

  // Regenerate states & Undo history
  const [regeneratingDayNumber, setRegeneratingDayNumber] = useState<number | null>(null);
  const [undoHistory, setUndoHistory] = useState<Record<number, ItineraryItem[]>>({});
  const [dayRegenModalOpen, setDayRegenModalOpen] = useState(false);
  const [dayToRegenerate, setDayToRegenerate] = useState<ItineraryDayWithItems | null>(null);
  const [dayRegenInstruction, setDayRegenInstruction] = useState('');

  // Modals state
  const [editModalItem, setEditModalItem] = useState<{
    item?: ItineraryItem;
    dayId: string;
    isNew: boolean;
  } | null>(null);

  const [itemFormData, setItemFormData] = useState<{
    title: string;
    type: ItineraryItemType;
    start_time: string;
    end_time: string;
    estimated_cost: number;
    location: string;
    description: string;
    notes: string;
  }>({
    title: '',
    type: 'activity',
    start_time: '10:00',
    end_time: '12:00',
    estimated_cost: 0,
    location: '',
    description: '',
    notes: '',
  });

  const [replaceModalItem, setReplaceModalItem] = useState<ItineraryItem | null>(null);
  const [replaceInstruction, setReplaceInstruction] = useState('');

  const [confirmFullRegenOpen, setConfirmFullRegenOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');

  // Group preferences modal state
  const [groupPrefsOpen, setGroupPrefsOpen] = useState(false);
  const [userInterests, setUserInterests] = useState<string[]>([]);
  const [userBudgetCap, setUserBudgetCap] = useState<string>('');
  const [userDietaryNotes, setUserDietaryNotes] = useState<string>('');

  // Sensors for dnd-kit
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ─── Budget & Category Metrics ─────────────────────────────────────────────

  const budgetStats = useMemo(() => {
    if (!trip || !trip.days) {
      return {
        totalCost: 0,
        budgetLimit: 0,
        pct: 0,
        remaining: 0,
        byCategory: { dining: 0, attraction: 0, transport: 0, accommodation: 0, activity: 0 },
      };
    }

    const byCategory = { dining: 0, attraction: 0, transport: 0, accommodation: 0, activity: 0 };
    let totalCost = 0;

    trip.days.forEach((day) => {
      day.items?.forEach((item) => {
        const cost = toNumber(item.estimated_cost);
        totalCost += cost;
        if (byCategory[item.type] !== undefined) {
          byCategory[item.type] += cost;
        } else {
          byCategory.activity += cost;
        }
      });
    });

    const budgetLimit = toNumber(trip.budget_total);
    // Clamp progress percentage between 0 and 100
    const rawPct = budgetLimit > 0 ? (totalCost / budgetLimit) * 100 : 0;
    const pct = Math.min(100, Math.max(0, Math.round(rawPct)));
    const remaining = Math.max(0, budgetLimit - totalCost);

    return {
      totalCost,
      budgetLimit,
      pct,
      remaining,
      byCategory,
    };
  }, [trip]);

  const rawTravelers = toNumber(trip?.num_travelers);
  const travelerCount = rawTravelers > 0 ? rawTravelers : 0;
  const perPersonCost = travelerCount > 0 ? budgetStats.totalCost / travelerCount : 0;
  const perPersonBudget =
    travelerCount > 0 && budgetStats.budgetLimit > 0
      ? budgetStats.budgetLimit / travelerCount
      : 0;

  // ─── Drag and Drop Handler ─────────────────────────────────────────────────

  const handleDragEnd = useCallback(
    async (event: DragEndEvent, day: ItineraryDayWithItems) => {
      const { active, over } = event;
      if (!over || active.id === over.id || !day.items) return;

      const oldIndex = day.items.findIndex((item) => item.id === active.id);
      const newIndex = day.items.findIndex((item) => item.id === over.id);
      if (oldIndex === -1 || newIndex === -1) return;

      const reordered = arrayMove(day.items, oldIndex, newIndex);
      const itemIds = reordered.map((i) => i.id);

      try {
        await reorderItems.mutateAsync({
          dayId: day.id,
          itemIds,
          tripId,
        });
        success('Reordered', 'Activity order saved');
      } catch {
        showError('Reorder Failed', 'Could not save new sequence');
      }
    },
    [reorderItems, tripId, success, showError]
  );

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleToggleLock = async (item: ItineraryItem) => {
    const nextLocked = !item.is_locked;
    try {
      await updateItem.mutateAsync({
        id: item.id,
        data: { is_locked: nextLocked },
        tripId,
      });
      success(
        nextLocked ? 'Activity Locked' : 'Activity Unlocked',
        nextLocked ? 'AI regeneration will preserve this.' : 'Activity can be modified by AI.'
      );
    } catch {
      showError('Update Failed', 'Could not update lock state');
    }
  };

  const handleDeleteItem = async (item: ItineraryItem) => {
    try {
      await deleteItem.mutateAsync({ id: item.id, tripId });
      success('Activity Removed', `Deleted ${item.title}`);
    } catch {
      showError('Delete Failed', 'Could not remove activity');
    }
  };

  const handleOpenAddModal = (dayId: string) => {
    setItemFormData({
      title: '',
      type: 'activity',
      start_time: '10:00',
      end_time: '12:00',
      estimated_cost: 20,
      location: '',
      description: '',
      notes: '',
    });
    setEditModalItem({ dayId, isNew: true });
  };

  const handleOpenEditModal = (item: ItineraryItem) => {
    setItemFormData({
      title: item.title,
      type: item.type,
      start_time: item.start_time || '10:00',
      end_time: item.end_time || '12:00',
      estimated_cost: item.estimated_cost || 0,
      location: item.location || '',
      description: item.description || '',
      notes: item.notes || '',
    });
    setEditModalItem({ item, dayId: item.day_id, isNew: false });
  };

  const handleSaveItemModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModalItem || !itemFormData.title.trim()) return;

    try {
      if (editModalItem.isNew) {
        const payload: ItineraryItemInsert = {
          day_id: editModalItem.dayId,
          order_index: 99,
          type: itemFormData.type,
          title: itemFormData.title.trim(),
          description: itemFormData.description.trim() || null,
          location: itemFormData.location.trim() || null,
          start_time: itemFormData.start_time || null,
          end_time: itemFormData.end_time || null,
          estimated_cost: Number(itemFormData.estimated_cost) || 0,
          notes: itemFormData.notes.trim() || null,
          is_locked: false,
        };
        await createItem.mutateAsync({
          dayId: editModalItem.dayId,
          data: payload,
          tripId,
        });
        success('Activity Added', `Created ${itemFormData.title}`);
      } else if (editModalItem.item) {
        await updateItem.mutateAsync({
          id: editModalItem.item.id,
          data: {
            title: itemFormData.title.trim(),
            type: itemFormData.type,
            start_time: itemFormData.start_time || null,
            end_time: itemFormData.end_time || null,
            estimated_cost: Number(itemFormData.estimated_cost) || 0,
            location: itemFormData.location.trim() || null,
            description: itemFormData.description.trim() || null,
            notes: itemFormData.notes.trim() || null,
          },
          tripId,
        });
        success('Activity Saved', `Updated ${itemFormData.title}`);
      }
      setEditModalItem(null);
    } catch {
      showError('Save Failed', 'Could not save activity details');
    }
  };

  const handleReplaceActivity = async () => {
    if (!replaceModalItem) return;
    try {
      await replaceItem.mutateAsync({
        id: replaceModalItem.id,
        data: {
          instruction: replaceInstruction.trim() || undefined,
        },
        tripId,
      });
      success('Activity Replaced', 'AI suggested a new alternative');
      setReplaceModalItem(null);
      setReplaceInstruction('');
    } catch {
      showError('Replace Failed', 'Could not generate alternative');
    }
  };

  const handleRegenerateDaySubmit = async () => {
    if (!dayToRegenerate) return;
    const dayNum = dayToRegenerate.day_number;

    // Save snapshot of current items for undo
    if (dayToRegenerate.items) {
      setUndoHistory((prev) => ({
        ...prev,
        [dayNum]: [...(dayToRegenerate.items || [])],
      }));
    }

    setDayRegenModalOpen(false);
    setRegeneratingDayNumber(dayNum);

    try {
      await regenerateDay.mutateAsync({
        tripId,
        dayNumber: dayNum,
        data: {
          instruction: dayRegenInstruction.trim() || undefined,
        },
      });
      success(`Day ${dayNum} Regenerated`, 'Schedule refreshed with AI suggestions');
      setDayRegenInstruction('');
    } catch {
      showError('Regeneration Failed', `Could not regenerate Day ${dayNum}`);
    } finally {
      setRegeneratingDayNumber(null);
    }
  };

  const handleUndoDay = async (day: ItineraryDayWithItems) => {
    const previousItems = undoHistory[day.day_number];
    if (!previousItems) return;

    try {
      // Re-create previous snapshot items
      const itemIds = previousItems.map((i) => i.id);
      await reorderItems.mutateAsync({
        dayId: day.id,
        itemIds,
        tripId,
      });

      // Clear from undo history
      setUndoHistory((prev) => {
        const copy = { ...prev };
        delete copy[day.day_number];
        return copy;
      });

      success('Undo Applied', `Restored Day ${day.day_number} activities`);
      refetch();
    } catch {
      showError('Undo Failed', 'Could not restore previous version');
    }
  };

  const handleRegenerateEntireTrip = async () => {
    setConfirmFullRegenOpen(false);
    try {
      await generateItinerary.mutateAsync({ tripId });
      success('Itinerary Regenerated', 'Entire trip refreshed with new schedule');
    } catch {
      showError('Regeneration Failed', 'Could not regenerate entire trip');
    }
  };

  const handleVote = async (item: ItineraryItem, vote: number) => {
    try {
      await voteItem.mutateAsync({
        itemId: item.id,
        vote,
        tripId,
      });
      if (vote === 1) {
        success('Upvoted', `Voted for ${item.title}`);
      } else if (vote === -1) {
        success('Downvoted', `Downvoted ${item.title}`);
      } else {
        success('Vote Removed', 'Removed vote for this activity');
      }
    } catch {
      showError('Vote Failed', 'Could not register your vote');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    try {
      await removeMember.mutateAsync({ tripId, userId });
      success('Member Removed', 'Collaborator removed from trip');
    } catch {
      showError('Removal Failed', 'Could not remove member');
    }
  };

  const handleOpenGroupPrefsModal = () => {
    const currentMemberPref = groupPrefs?.preferences?.find((p) => p.user_id === user?.id);
    if (currentMemberPref) {
      setUserInterests(currentMemberPref.interests || []);
      setUserBudgetCap(currentMemberPref.budget_cap ? String(currentMemberPref.budget_cap) : '');
      setUserDietaryNotes(currentMemberPref.notes || '');
    } else {
      setUserInterests(trip?.interests || []);
      setUserBudgetCap('');
      setUserDietaryNotes('');
    }
    setGroupPrefsOpen(true);
  };

  const handleSavePreferences = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const parsedCap = userBudgetCap ? Number(userBudgetCap) : null;
      await saveGroupPreference.mutateAsync({
        tripId,
        data: {
          interests: userInterests,
          budget_cap: parsedCap,
          notes: userDietaryNotes.trim() || undefined,
        },
      });
      success('Preferences Saved', 'Consensus updated with your choices');
      setGroupPrefsOpen(false);
    } catch {
      showError('Save Failed', 'Could not save member preferences');
    }
  };

  const toggleInterest = (interest: string) => {
    setUserInterests((prev) =>
      prev.includes(interest) ? prev.filter((i) => i !== interest) : [...prev, interest]
    );
  };

  const handleShareCopy = () => {
    navigator.clipboard.writeText(window.location.href);
    success('Link Copied', 'Trip share URL copied to clipboard');
  };

  const handleInviteCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    try {
      await inviteMember.mutateAsync({
        tripId,
        email: inviteEmail.trim(),
        role: inviteRole,
      });
      success('Invitation Sent', `Invited ${inviteEmail} as ${inviteRole}`);
      setInviteEmail('');
    } catch {
      showError('Invite Failed', 'Could not send invitation');
    }
  };

  // ─── Loading & Error States ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto space-y-6 pb-12">
        <Skeleton variant="line" className="h-6 w-36" />
        <Skeleton variant="rect" className="h-44 w-full rounded-3xl" />
        <Skeleton variant="rect" className="h-28 w-full rounded-2xl" />
        <div className="space-y-4">
          <Skeleton variant="rect" className="h-48 w-full rounded-2xl" />
          <Skeleton variant="rect" className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !trip) {
    return (
      <div className="max-w-md mx-auto text-center py-20 space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-rose-500/15 border border-rose-500/25 flex items-center justify-center mx-auto text-rose-400">
          <AlertCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-slate-100">Trip not found</h2>
        <p className="text-xs text-slate-400">
          Could not locate itinerary details for ID: {tripId}
        </p>
        <div className="pt-2 flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/dashboard')}>
            Back to Dashboard
          </Button>
          <Button variant="primary" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      </div>
    );
  }

  const days = trip.days || [];
  const visibleDays =
    selectedDayNumber === 'all'
      ? days
      : days.filter((d) => d.day_number === selectedDayNumber);

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-20">
      {/* ─── Top Navigation Bar ──────────────────────────────────────────── */}
      <div className="no-print flex items-center justify-between">
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-slate-200 transition-colors"
        >
          <ArrowLeft size={14} /> Back to Dashboard
        </button>

        <div className="flex items-center gap-2">
          {/* Group Preferences Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Users size={13} />}
            onClick={handleOpenGroupPrefsModal}
          >
            Group Preferences
          </Button>

          {/* Share Button */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Share2 size={13} />}
            onClick={() => setShareModalOpen(true)}
          >
            Share
          </Button>

          {/* Export / Print PDF */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            leftIcon={<Printer size={13} />}
            onClick={() => window.print()}
          >
            Export PDF
          </Button>

          {/* Regenerate Entire Trip - only for editors/owner */}
          {canEdit && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={13} />}
              onClick={() => setConfirmFullRegenOpen(true)}
              className="text-slate-400 hover:text-brand-300"
            >
              Regenerate Trip
            </Button>
          )}
        </div>
      </div>

      {/* ─── Header: Trip Title, Destination & Traveler Info ──────────────── */}
      <div className="rounded-3xl bg-slate-900/80 border border-slate-700/60 p-6 sm:p-8 backdrop-blur-md shadow-2xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge
                variant={
                  trip.status === 'generated'
                    ? 'success'
                    : trip.status === 'draft'
                    ? 'warning'
                    : 'default'
                }
                dot
              >
                {trip.status}
              </Badge>
              {isViewer ? (
                <Badge variant="outline" className="border-amber-500/40 text-amber-300 bg-amber-500/10">
                  Viewer (Read-Only)
                </Badge>
              ) : isOwner ? (
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10">
                  Trip Owner
                </Badge>
              ) : (
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-300 bg-emerald-500/10">
                  Editor
                </Badge>
              )}
              <span className="text-xs text-slate-400 font-medium capitalize">
                {trip.traveler_type} ({trip.num_travelers} {trip.num_travelers === 1 ? 'traveler' : 'travelers'}) • {trip.pace} pace
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight">
              {trip.title}
            </h1>

            <div className="flex flex-wrap items-center gap-y-2 gap-x-4 text-xs text-slate-300">
              <span className="flex items-center gap-1.5">
                <MapPin size={13} className="text-brand-400" />
                {trip.destination}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={13} className="text-brand-400" />
                {trip.start_date} – {trip.end_date}
              </span>
              <span className="flex items-center gap-1.5">
                <Clock size={13} className="text-brand-400" />
                {days.length} {days.length === 1 ? 'Day' : 'Days'} Schedule
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Sticky Budget & Category Breakdown Panel ──────────────────────── */}
      <div className="sticky top-2 z-20 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-slate-700/70 p-4 sm:p-5 shadow-xl space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Trip Budget Tracker
            </p>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-xl font-black text-slate-100 font-mono">
                {formatCurrency(budgetStats.totalCost)}
              </span>
              {budgetStats.budgetLimit > 0 && (
                <span className="text-xs text-slate-400">
                  of {formatCurrency(budgetStats.budgetLimit)} target limit
                </span>
              )}
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span
              className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                budgetStats.pct >= 100
                  ? 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  : budgetStats.pct > 80
                  ? 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                  : 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
              }`}
            >
              {budgetStats.pct}% allocated
            </span>
            {budgetStats.remaining > 0 && (
              <p className="text-[10px] text-slate-400 mt-1">
                {formatCurrency(budgetStats.remaining)} remaining balance
              </p>
            )}
          </div>
        </div>

        {/* Progress Bar (Clamped strictly between 0 and 100%) */}
        <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              budgetStats.pct >= 100
                ? 'bg-rose-500'
                : budgetStats.pct > 80
                ? 'bg-amber-500'
                : 'bg-gradient-to-r from-brand-500 to-emerald-400'
            }`}
            style={{ width: `${Math.min(100, Math.max(0, budgetStats.pct))}%` }}
          />
        </div>

        {/* Category breakdown chips */}
        <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 text-amber-300 border border-amber-500/20 font-medium">
            <Utensils size={12} /> Dining: {formatCurrency(budgetStats.byCategory.dining)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-violet-500/10 text-violet-300 border border-violet-500/20 font-medium">
            <Landmark size={12} /> Attractions: {formatCurrency(budgetStats.byCategory.attraction)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 font-medium">
            <Car size={12} /> Transport: {formatCurrency(budgetStats.byCategory.transport)}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-300 border border-blue-500/20 font-medium">
            <Hotel size={12} /> Stay: {formatCurrency(budgetStats.byCategory.accommodation)}
          </span>
        </div>

        {/* Per-Person Cost Split */}
        <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/25 text-indigo-300 font-semibold text-xs">
              <Users size={12} /> Per-Person Split ({travelerCount} {travelerCount === 1 ? 'traveler' : 'travelers'})
            </span>
            <span className="font-mono font-bold text-slate-100">
              {travelerCount > 0 ? formatCurrency(perPersonCost) : '$0.00'}{' '}
              <span className="text-slate-400 font-normal">/ person</span>
            </span>
            {travelerCount > 0 && perPersonBudget > 0 && (
              <span className="text-slate-400 text-[11px]">
                (of {formatCurrency(perPersonBudget)} target limit)
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>Dining: {formatCurrency(travelerCount > 0 ? budgetStats.byCategory.dining / travelerCount : 0)}</span>
            <span>•</span>
            <span>Attractions: {formatCurrency(travelerCount > 0 ? budgetStats.byCategory.attraction / travelerCount : 0)}</span>
            <span>•</span>
            <span>Stay: {formatCurrency(travelerCount > 0 ? budgetStats.byCategory.accommodation / travelerCount : 0)}</span>
            <span>•</span>
            <span>Transport: {formatCurrency(travelerCount > 0 ? budgetStats.byCategory.transport / travelerCount : 0)}</span>
          </div>
        </div>
      </div>

      {/* ─── Day Tabs Selector ────────────────────────────────────────────── */}
      <div className="no-print flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <button
          type="button"
          onClick={() => setSelectedDayNumber('all')}
          className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
            selectedDayNumber === 'all'
              ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
              : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
          }`}
        >
          All Days ({days.length})
        </button>

        {days.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => setSelectedDayNumber(d.day_number)}
            className={`px-3.5 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedDayNumber === d.day_number
                ? 'bg-brand-500 text-white shadow-md shadow-brand-500/25'
                : 'bg-slate-900/60 border border-slate-800 text-slate-400 hover:text-slate-200 hover:border-slate-700'
            }`}
          >
            Day {d.day_number}
          </button>
        ))}
      </div>

      {/* ─── Itinerary Schedule Days List ─────────────────────────────────── */}
      <div className="space-y-6">
        {visibleDays.map((day) => {
          const isRegenerating = regeneratingDayNumber === day.day_number;
          const items = day.items || [];
          const hasUndo = Boolean(undoHistory[day.day_number]);
          const dayCost = items.reduce((acc, i) => acc + toNumber(i.estimated_cost), 0);

          return (
            <Card
              key={day.id}
              variant="glass"
              padding="md"
              className="border-slate-800/90 shadow-xl relative overflow-hidden"
            >
              {/* Day Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg bg-brand-500/15 border border-brand-500/25 text-brand-300 font-extrabold text-xs">
                      Day {day.day_number}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">{day.date}</span>
                    <span className="text-xs font-mono font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                      {formatCurrency(dayCost)}
                    </span>
                  </div>

                  {day.summary && (
                    <p className="text-sm font-semibold text-slate-200 leading-snug">
                      {day.summary}
                    </p>
                  )}
                </div>

                {/* Day Action Buttons - Only for editors/owner */}
                {canEdit && (
                  <div className="no-print flex items-center gap-2 flex-shrink-0">
                    {hasUndo && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        leftIcon={<Undo2 size={13} />}
                        onClick={() => handleUndoDay(day)}
                        className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                      >
                        Undo Regen
                      </Button>
                    )}

                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      leftIcon={<RefreshCw size={13} />}
                      onClick={() => {
                        setDayToRegenerate(day);
                        setDayRegenModalOpen(true);
                      }}
                      disabled={isRegenerating}
                    >
                      Regenerate Day
                    </Button>

                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      leftIcon={<Plus size={13} />}
                      onClick={() => handleOpenAddModal(day.id)}
                    >
                      Add Activity
                    </Button>
                  </div>
                )}
              </div>

              {/* Day Body Content */}
              <div className="pt-4">
                {isRegenerating ? (
                  <div className="space-y-3 py-6 animate-pulse text-center">
                    <Sparkles size={24} className="mx-auto text-brand-400 animate-spin" />
                    <p className="text-xs text-slate-300 font-medium">
                      AI is refreshing Day {day.day_number} activities...
                    </p>
                    <div className="space-y-2 max-w-md mx-auto pt-2">
                      <Skeleton variant="rect" className="h-16 w-full" />
                      <Skeleton variant="rect" className="h-16 w-full" />
                    </div>
                  </div>
                ) : items.length === 0 ? (
                  <div className="text-center py-8 text-slate-500 text-xs italic">
                    No activities scheduled for this day yet.{' '}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleOpenAddModal(day.id)}
                        className="text-brand-400 underline hover:text-brand-300 ml-1"
                      >
                        Add one now
                      </button>
                    )}
                  </div>
                ) : (
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={(event) => handleDragEnd(event, day)}
                  >
                    <SortableContext
                      items={items.map((i) => i.id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-3">
                        {items.map((item) => (
                          <SortableActivity
                            key={item.id}
                            item={item}
                            dayId={day.id}
                            tripId={tripId}
                            canEdit={canEdit}
                            onEdit={handleOpenEditModal}
                            onReplace={setReplaceModalItem}
                            onDelete={handleDeleteItem}
                            onToggleLock={handleToggleLock}
                            onVote={handleVote}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      {/* ─── MODAL: Add / Edit Activity ──────────────────────────────────── */}
      <Modal
        isOpen={Boolean(editModalItem)}
        onClose={() => setEditModalItem(null)}
        title={editModalItem?.isNew ? 'Add Activity' : 'Edit Activity'}
        description="Configure activity timing, location, and estimated cost."
      >
        <form onSubmit={handleSaveItemModal} className="space-y-4">
          <Input
            id="item-title-input"
            label="Activity Title"
            placeholder="e.g. Louvre Museum Guided Tour"
            value={itemFormData.title}
            onChange={(e) => setItemFormData({ ...itemFormData, title: e.target.value })}
            required
            autoFocus
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Select
              label="Type / Category"
              value={itemFormData.type}
              onChange={(e) =>
                setItemFormData({ ...itemFormData, type: e.target.value as ItineraryItemType })
              }
              options={[
                { value: 'attraction', label: 'Attraction / Landmark' },
                { value: 'dining', label: 'Dining / Food' },
                { value: 'activity', label: 'Activity / Experience' },
                { value: 'transport', label: 'Transport / Transit' },
                { value: 'accommodation', label: 'Accommodation / Check-in' },
              ]}
            />

            <Input
              id="item-cost-input"
              type="number"
              label="Estimated Cost ($)"
              value={itemFormData.estimated_cost}
              onChange={(e) =>
                setItemFormData({ ...itemFormData, estimated_cost: Number(e.target.value) })
              }
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input
              id="item-start-input"
              type="time"
              label="Start Time"
              value={itemFormData.start_time}
              onChange={(e) => setItemFormData({ ...itemFormData, start_time: e.target.value })}
            />
            <Input
              id="item-end-input"
              type="time"
              label="End Time"
              value={itemFormData.end_time}
              onChange={(e) => setItemFormData({ ...itemFormData, end_time: e.target.value })}
            />
          </div>

          <Input
            id="item-location-input"
            label="Location / Address"
            placeholder="e.g. Rue de Rivoli, 75001 Paris"
            value={itemFormData.location}
            onChange={(e) => setItemFormData({ ...itemFormData, location: e.target.value })}
          />

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Key details, exhibit focus, or booking advice..."
              value={itemFormData.description}
              onChange={(e) => setItemFormData({ ...itemFormData, description: e.target.value })}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Notes & Tips (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Book skip-the-line tickets online"
              value={itemFormData.notes}
              onChange={(e) => setItemFormData({ ...itemFormData, notes: e.target.value })}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs px-3 py-2 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setEditModalItem(null)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={createItem.isPending || updateItem.isPending}
            >
              {editModalItem?.isNew ? 'Create Activity' : 'Save Changes'}
            </Button>
          </ModalFooter>
        </form>
      </Modal>

      {/* ─── MODAL: Replace Activity with AI ─────────────────────────────── */}
      <Modal
        isOpen={Boolean(replaceModalItem)}
        onClose={() => setReplaceModalItem(null)}
        title="Replace Activity with AI"
        description={`Get a fresh alternative recommendation to replace "${replaceModalItem?.title}".`}
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-slate-800/60 p-3.5 text-xs text-slate-300 space-y-1">
            <p className="font-semibold text-slate-100">Current Activity</p>
            <p>{replaceModalItem?.title}</p>
            <p className="text-slate-400 capitalize">
              {replaceModalItem?.type} • ${replaceModalItem?.estimated_cost}
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Custom Instruction / Preference (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Find an indoor museum instead because of rain, or suggest a rooftop cocktail bar..."
              value={replaceInstruction}
              onChange={(e) => setReplaceInstruction(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setReplaceModalItem(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="gradient"
              size="sm"
              leftIcon={<Sparkles size={14} />}
              loading={replaceItem.isPending}
              onClick={handleReplaceActivity}
            >
              Suggest Alternative
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* ─── MODAL: Regenerate Day ───────────────────────────────────────── */}
      <Modal
        isOpen={dayRegenModalOpen}
        onClose={() => setDayRegenModalOpen(false)}
        title={`Regenerate Day ${dayToRegenerate?.day_number}`}
        description="AI will generate a fresh schedule for this day. All locked activities will be preserved, and you can undo if you prefer the previous version."
      >
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
              Instructions for this day (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Focus on modern art and bohemian cafes, or add a scenic sunset viewpoint..."
              value={dayRegenInstruction}
              onChange={(e) => setDayRegenInstruction(e.target.value)}
              className="w-full rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDayRegenModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              leftIcon={<RefreshCw size={14} />}
              onClick={handleRegenerateDaySubmit}
            >
              Regenerate Day
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* ─── MODAL: Confirm Regenerate Entire Trip ───────────────────────── */}
      <Modal
        isOpen={confirmFullRegenOpen}
        onClose={() => setConfirmFullRegenOpen(false)}
        title="Regenerate Entire Trip?"
        description="This will rewrite all unlocked days with a newly synthesized AI schedule matching your budget and interests."
      >
        <div className="space-y-4">
          <div className="rounded-xl bg-amber-500/10 border border-amber-500/25 p-4 text-xs text-amber-200">
            <p className="font-semibold">Note on locked activities:</p>
            <p className="mt-1 opacity-90">
              Any activities you have locked with the lock icon will remain in place.
            </p>
          </div>

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setConfirmFullRegenOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="danger"
              size="sm"
              loading={generateItinerary.isPending}
              leftIcon={<Sparkles size={14} />}
              onClick={handleRegenerateEntireTrip}
            >
              Regenerate Entire Trip
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* ─── MODAL: Share & Collaborator Invite ───────────────────────────── */}
      <Modal
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        title="Share & Collaborate"
        description="Share this travel plan or invite friends with editor or viewer permissions."
      >
        <div className="space-y-5">
          {/* Link copy */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Trip Link
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                readOnly
                value={window.location.href}
                className="flex-1 rounded-xl bg-slate-900 border border-slate-700 text-xs text-slate-300 px-3 py-2 truncate select-all"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                leftIcon={<Copy size={13} />}
                onClick={handleShareCopy}
              >
                Copy
              </Button>
            </div>
          </div>

          {/* Members List */}
          <div className="space-y-2 pt-2 border-t border-slate-800">
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
              Trip Members & Roles
            </label>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {/* Trip Owner */}
              <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/60 border border-slate-700/50">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="w-7 h-7 rounded-full bg-indigo-500/20 border border-indigo-500/40 flex items-center justify-center text-xs font-bold text-indigo-300 flex-shrink-0">
                    👑
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-slate-200 truncate">
                      {trip.owner?.full_name || trip.owner?.email || 'Trip Creator'}
                    </p>
                    <p className="text-[10px] text-slate-500">Trip Organizer</p>
                  </div>
                </div>
                <Badge variant="outline" className="border-indigo-500/40 text-indigo-300 bg-indigo-500/10 text-[10px]">
                  Owner
                </Badge>
              </div>

              {/* Collaborators */}
              {trip.members && trip.members.length > 0 ? (
                trip.members.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-800/40 border border-slate-700/40"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-7 h-7 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs font-medium text-slate-300 flex-shrink-0">
                        {(member.profile?.full_name || member.profile?.email || 'U')[0].toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">
                          {member.profile?.full_name || member.profile?.email || member.user_id}
                        </p>
                        <p className="text-[10px] text-slate-500 capitalize">{member.role} role</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          member.role === 'editor'
                            ? 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10 text-[10px]'
                            : 'border-amber-500/40 text-amber-300 bg-amber-500/10 text-[10px]'
                        }
                      >
                        {member.role}
                      </Badge>
                      {canEdit && member.user_id !== trip.owner_id && (
                        <button
                          type="button"
                          onClick={() => handleRemoveMember(member.user_id)}
                          className="text-slate-500 hover:text-rose-400 p-1 rounded transition-colors"
                          title="Remove member"
                        >
                          <UserMinus size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500 italic py-1">No other members joined yet.</p>
              )}
            </div>
          </div>

          {/* Email Invite form - only if editor/owner */}
          {canEdit && (
            <form onSubmit={handleInviteCollaborator} className="space-y-2 pt-2 border-t border-slate-800">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300">
                Invite New Member
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="sm:col-span-2">
                  <Input
                    type="email"
                    placeholder="friend@example.com"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    required
                    className="py-1.5 text-xs"
                  />
                </div>
                <Select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as 'editor' | 'viewer')}
                  options={[
                    { value: 'editor', label: 'Editor' },
                    { value: 'viewer', label: 'Viewer' },
                  ]}
                />
              </div>
              <div className="flex justify-end pt-1">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={inviteMember.isPending}
                >
                  Send Invitation
                </Button>
              </div>
            </form>
          )}

          <ModalFooter>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShareModalOpen(false)}
            >
              Close
            </Button>
          </ModalFooter>
        </div>
      </Modal>

      {/* ─── MODAL: Group Preferences & Consensus ────────────────────────── */}
      <Modal
        isOpen={groupPrefsOpen}
        onClose={() => setGroupPrefsOpen(false)}
        title="Group Travel Preferences & Consensus"
        description="Submit your individual budget cap and interests. The AI merges group preferences to plan activities everyone enjoys while honoring the lowest budget limit."
      >
        <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">
          {/* Merged Consensus Summary */}
          <div className="space-y-3 p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
              <Users size={13} className="text-brand-400" /> Group Consensus Synthesis
            </h4>

            {/* Effective Budget Cap */}
            {groupPrefs?.effective_budget_cap != null ? (
              <div className="p-2.5 rounded-xl bg-slate-900/80 border border-emerald-500/30 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase text-slate-400">
                    Effective Group Budget Cap
                  </p>
                  <p className="text-base font-black font-mono text-emerald-400">
                    ${groupPrefs.effective_budget_cap.toLocaleString()}
                  </p>
                </div>
                <span className="text-[11px] text-slate-400 max-w-[200px] text-right">
                  Constrained by lowest member limit to keep the trip inclusive for all.
                </span>
              </div>
            ) : (
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-700/40 text-[11px] text-slate-400">
                No member budget caps set yet. Trip total budget applies.
              </div>
            )}

            {/* Prioritized Shared Interests */}
            <div>
              <p className="text-[10px] font-semibold uppercase text-slate-400 mb-1.5">
                Prioritized Group Interests
              </p>
              {groupPrefs?.merged_interests && groupPrefs.merged_interests.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {groupPrefs.merged_interests.map((interest, idx) => (
                    <span
                      key={interest}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold bg-brand-500/15 border border-brand-500/25 text-brand-300 capitalize"
                    >
                      <Check size={10} />
                      #{idx + 1} {interest}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-slate-500 italic">No shared interests submitted yet.</p>
              )}
            </div>

            {/* Conflicts Alert Box */}
            {groupPrefs?.conflicts && groupPrefs.conflicts.length > 0 && (
              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-1">
                <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle size={13} />
                  Flagged Group Conflicts
                </p>
                <ul className="text-xs text-amber-200/90 list-disc list-inside space-y-0.5">
                  {groupPrefs.conflicts.map((conflict, i) => (
                    <li key={i}>{conflict}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Submissions by members */}
            {groupPrefs?.preferences && groupPrefs.preferences.length > 0 && (
              <div className="pt-2 border-t border-slate-700/50">
                <p className="text-[10px] font-semibold uppercase text-slate-400 mb-1.5">
                  Submissions ({groupPrefs.preferences.length})
                </p>
                <div className="space-y-1.5">
                  {groupPrefs.preferences.map((p) => (
                    <div
                      key={p.user_id}
                      className="p-2 rounded-lg bg-slate-900/60 border border-slate-800 text-xs flex items-center justify-between"
                    >
                      <div>
                        <span className="font-semibold text-slate-200">
                          {p.user_name || p.user_email || 'Member'}
                        </span>
                        <span className="text-slate-500 text-[11px] ml-2">
                          Cap: {p.budget_cap != null ? `$${p.budget_cap}` : 'None'}
                        </span>
                      </div>
                      <div className="flex gap-1 text-[10px] text-slate-400">
                        {p.interests?.slice(0, 3).map((i) => (
                          <span key={i} className="px-1.5 py-0.5 rounded bg-slate-800 capitalize">
                            {i}
                          </span>
                        ))}
                        {p.interests && p.interests.length > 3 && (
                          <span className="text-slate-500">+{p.interests.length - 3}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Member Personal Submission Form */}
          <form onSubmit={handleSavePreferences} className="space-y-4 pt-2 border-t border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-200">
              Submit Your Personal Preferences
            </h4>

            {/* Budget Cap */}
            <div>
              <Input
                type="number"
                label="Your Personal Budget Cap ($)"
                placeholder="e.g. 1200"
                value={userBudgetCap}
                onChange={(e) => setUserBudgetCap(e.target.value)}
              />
              <p className="text-[10px] text-slate-400 mt-1">
                The itinerary generator will respect the lowest budget cap among all members.
              </p>
            </div>

            {/* Interest Chips */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1.5">
                Your Interests (Select all that apply)
              </label>
              <div className="flex flex-wrap gap-2">
                {[
                  'food',
                  'sightseeing',
                  'culture',
                  'adventure',
                  'nature',
                  'nightlife',
                  'shopping',
                  'relaxation',
                  'romantic',
                ].map((interest) => {
                  const isSelected = userInterests.includes(interest);
                  return (
                    <button
                      key={interest}
                      type="button"
                      onClick={() => toggleInterest(interest)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-all ${
                        isSelected
                          ? 'bg-brand-500 text-white shadow-md shadow-brand-500/20'
                          : 'bg-slate-800 text-slate-400 border border-slate-700 hover:text-slate-200 hover:border-slate-600'
                      }`}
                    >
                      {interest}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes / Dietary constraints */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1">
                Dietary & Accessibility Notes (Optional)
              </label>
              <textarea
                rows={2}
                placeholder="e.g. Vegetarian only, avoid strenuous hiking, prefer walking tours..."
                value={userDietaryNotes}
                onChange={(e) => setUserDietaryNotes(e.target.value)}
                className="w-full rounded-xl bg-slate-900 border border-slate-700 text-slate-100 text-xs p-3 focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <ModalFooter>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setGroupPrefsOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                size="sm"
                loading={saveGroupPreference.isPending}
              >
                Save My Preferences
              </Button>
            </ModalFooter>
          </form>
        </div>
      </Modal>
    </div>
  );
};

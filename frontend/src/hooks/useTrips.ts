import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import type {
  Trip,
  TripWithDetails,
  TripInsert,
  TripUpdate,
  TripMember,
  ItineraryItemInsert,
  ItineraryItemUpdate,
} from '../types';

// ─── Query Keys ─────────────────────────────────────────────────────────────

export const queryKeys = {
  trips: ['trips'] as const,
  trip: (id: string) => ['trips', id] as const,
  tripMembers: (id: string) => ['trips', id, 'members'] as const,
  tripPreferences: (id: string) => ['trips', id, 'preferences'] as const,
};

// ─── Trips ───────────────────────────────────────────────────────────────────

export function useTrips(options?: Omit<UseQueryOptions<Trip[]>, 'queryKey' | 'queryFn'>) {
  return useQuery<Trip[]>({
    queryKey: queryKeys.trips,
    queryFn: () => apiClient.trips.list(),
    staleTime: 30_000,
    ...options,
  });
}

export function useTrip(
  id: string,
  options?: Omit<UseQueryOptions<TripWithDetails>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TripWithDetails>({
    queryKey: queryKeys.trip(id),
    queryFn: () => apiClient.trips.get(id),
    enabled: Boolean(id),
    staleTime: 15_000,
    ...options,
  });
}

export function useTripMembers(
  tripId: string,
  options?: Omit<UseQueryOptions<TripMember[]>, 'queryKey' | 'queryFn'>
) {
  return useQuery<TripMember[]>({
    queryKey: queryKeys.tripMembers(tripId),
    queryFn: () => apiClient.trips.getMembers(tripId),
    enabled: Boolean(tripId),
    ...options,
  });
}

export function useCreateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: TripInsert) => apiClient.trips.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips });
    },
  });
}

export function useUpdateTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TripUpdate }) =>
      apiClient.trips.update(id, data),
    onSuccess: (_data, { id }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips });
    },
  });
}

export function useDeleteTrip() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiClient.trips.delete(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.trip(id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips });
    },
  });
}

export function useGenerateItinerary() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      constraints,
    }: {
      tripId: string;
      constraints?: { must_include?: string[]; avoid?: string[] };
    }) => apiClient.trips.generate(tripId, constraints),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

export function useRegenerateDay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      dayNumber,
      data,
    }: {
      tripId: string;
      dayNumber: number;
      data?: { instruction?: string; must_include?: string[]; avoid?: string[] };
    }) => apiClient.trips.regenerateDay(tripId, dayNumber, data),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

export function useInviteMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, email, role }: { tripId: string; email: string; role?: string }) =>
      apiClient.trips.inviteMember(tripId, { email, role }),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tripMembers(tripId) });
    },
  });
}

// ─── Items ────────────────────────────────────────────────────────────────────

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ dayId, data }: { dayId: string; data: ItineraryItemInsert; tripId: string }) =>
      apiClient.items.create(dayId, data),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: ItineraryItemUpdate;
      tripId: string;
    }) => apiClient.items.update(id, data),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string; tripId: string }) => apiClient.items.delete(id),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

export function useReplaceItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data?: { instruction?: string; preference?: string };
      tripId: string;
    }) => apiClient.items.replace(id, data),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

export function useReorderItems() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      dayId,
      itemIds,
    }: {
      dayId: string;
      itemIds: string[];
      tripId: string;
    }) => apiClient.items.reorder(dayId, itemIds),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tripId, userId }: { tripId: string; userId: string }) =>
      apiClient.trips.removeMember(tripId, userId),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.tripMembers(tripId) });
    },
  });
}

export function useGroupPreferences(tripId: string) {
  return useQuery({
    queryKey: queryKeys.tripPreferences(tripId),
    queryFn: () => apiClient.trips.getPreferences(tripId),
    enabled: Boolean(tripId),
  });
}

export function useSaveGroupPreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      tripId,
      data,
    }: {
      tripId: string;
      data: { interests: string[]; budget_cap?: number | null; notes?: string };
    }) => apiClient.trips.savePreferences(tripId, data),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tripPreferences(tripId) });
    },
  });
}

export function useVoteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      itemId,
      vote,
    }: {
      itemId: string;
      vote: number;
      tripId: string;
    }) => apiClient.items.vote(itemId, vote),
    onSuccess: (_data, { tripId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trip(tripId) });
    },
  });
}

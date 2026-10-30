import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactElement } from 'react';
import { DndContext } from '@dnd-kit/core';
import { SortableActivity } from '../pages/TripDetailsPage';
import type { ItineraryItem } from '../types';

describe('Itinerary Components & Item Cards', () => {
  const mockItem: ItineraryItem = {
    id: 'item-1',
    day_id: 'day-101',
    type: 'dining',
    title: 'Authentic Kyoto Kaiseki Dinner',
    description: 'Multi-course seasonal traditional feast in Gion',
    location: 'Gion District, Kyoto',
    start_time: '19:00',
    end_time: '21:00',
    estimated_cost: 120,
    is_locked: false,
    order_index: 0,
    notes: 'Reservations required 2 weeks prior',
    upvotes: 4,
    downvotes: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const renderWithDnd = (ui: ReactElement) => {
    return render(<DndContext>{ui}</DndContext>);
  };

  it('renders item details, title, category, and cost correctly', () => {
    renderWithDnd(
      <SortableActivity
        item={mockItem}
        dayId="day-101"
        tripId="trip-202"
        canEdit={true}
        onEdit={vi.fn()}
        onReplace={vi.fn()}
        onDelete={vi.fn()}
        onToggleLock={vi.fn()}
        onVote={vi.fn()}
      />
    );

    expect(screen.getByText('Authentic Kyoto Kaiseki Dinner')).toBeInTheDocument();
    expect(screen.getByText('Multi-course seasonal traditional feast in Gion')).toBeInTheDocument();
    expect(screen.getByText('Gion District, Kyoto')).toBeInTheDocument();
    expect(screen.getByText('$120.00')).toBeInTheDocument();
    expect(screen.getByText('19:00')).toBeInTheDocument();
    expect(screen.getByText('Dining')).toBeInTheDocument();
  });

  it('displays lock indicator and toggles lock status', () => {
    const onToggleLock = vi.fn();
    const lockedItem = { ...mockItem, is_locked: true };

    renderWithDnd(
      <SortableActivity
        item={lockedItem}
        dayId="day-101"
        tripId="trip-202"
        canEdit={true}
        onEdit={vi.fn()}
        onReplace={vi.fn()}
        onDelete={vi.fn()}
        onToggleLock={onToggleLock}
        onVote={vi.fn()}
      />
    );

    expect(screen.getByText('Locked')).toBeInTheDocument();

    const lockBtn = screen.getByTitle('Unlock (AI may regenerate)');
    fireEvent.click(lockBtn);
    expect(onToggleLock).toHaveBeenCalledWith(lockedItem);
  });

  it('handles item voting with upvote and downvote counts', () => {
    const onVote = vi.fn();
    renderWithDnd(
      <SortableActivity
        item={mockItem}
        dayId="day-101"
        tripId="trip-202"
        canEdit={true}
        onEdit={vi.fn()}
        onReplace={vi.fn()}
        onDelete={vi.fn()}
        onToggleLock={vi.fn()}
        onVote={onVote}
      />
    );

    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('1')).toBeInTheDocument();

    const upvoteBtn = screen.getByTitle('Vote up');
    fireEvent.click(upvoteBtn);
    expect(onVote).toHaveBeenCalledWith(mockItem, 1);

    const downvoteBtn = screen.getByTitle('Vote down');
    fireEvent.click(downvoteBtn);
    expect(onVote).toHaveBeenCalledWith(mockItem, -1);
  });

  it('hides edit and deletion actions for read-only viewers', () => {
    renderWithDnd(
      <SortableActivity
        item={mockItem}
        dayId="day-101"
        tripId="trip-202"
        canEdit={false}
        onEdit={vi.fn()}
        onReplace={vi.fn()}
        onDelete={vi.fn()}
        onToggleLock={vi.fn()}
        onVote={vi.fn()}
      />
    );

    expect(screen.queryByTitle('Edit activity')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete activity')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Replace activity with AI suggestion')).not.toBeInTheDocument();
  });
});

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmModal } from '@/components/ui/ConfirmModal';

const defaults = {
  title: 'Delete item',
  message: 'This cannot be undone.',
  onConfirm: vi.fn(),
  onCancel: vi.fn(),
};

describe('ConfirmModal', () => {
  it('renders title and message', () => {
    render(<ConfirmModal {...defaults} />);
    expect(screen.getByText('Delete item')).toBeInTheDocument();
    expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
  });

  it('renders "Confirm" as the default confirm label', () => {
    render(<ConfirmModal {...defaults} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
  });

  it('renders a custom confirmLabel', () => {
    render(<ConfirmModal {...defaults} confirmLabel="Delete forever" />);
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeInTheDocument();
  });

  it('calls onConfirm when the confirm button is clicked', async () => {
    const onConfirm = vi.fn();
    render(<ConfirmModal {...defaults} onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
    expect(onConfirm).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the Cancel button is clicked', async () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaults} onCancel={onCancel} />);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when the backdrop is clicked', async () => {
    const onCancel = vi.fn();
    const { container } = render(<ConfirmModal {...defaults} onCancel={onCancel} />);
    const backdrop = container.querySelector('.fixed.inset-0');
    await userEvent.click(backdrop!);
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('calls onCancel when Escape is pressed', async () => {
    const onCancel = vi.fn();
    render(<ConfirmModal {...defaults} onCancel={onCancel} />);
    await userEvent.keyboard('{Escape}');
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('applies danger styling to the confirm button when danger is true', () => {
    render(<ConfirmModal {...defaults} confirmLabel="Delete" danger />);
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-500');
  });

  it('applies default indigo styling when danger is false', () => {
    render(<ConfirmModal {...defaults} />);
    expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('bg-indigo-600');
  });
});

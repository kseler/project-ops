import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectDetail } from '@/pages/ProjectDetail';
import type { Project } from '@/types';

const mockMutate = vi.fn();

vi.mock('@/queries/projects', () => ({
  useProject: vi.fn(),
  useUpdateProject: () => ({ mutate: mockMutate, isPending: false }),
}));

vi.mock('@/hooks/useProjectRealtime', () => ({
  useProjectRealtime: vi.fn(),
}));

vi.mock('@/components/project/ProjectListView', () => ({
  ProjectListView: () => <div>List View</div>,
}));

vi.mock('@/components/project/ProjectGanttView', () => ({
  ProjectGanttView: () => <div>Gantt View</div>,
}));

import { useProject } from '@/queries/projects';
const mockUseProject = vi.mocked(useProject);

const baseProject: Project = {
  id: 'p1',
  name: 'Alpha Project',
  description: 'A test project',
  status: 'active',
  dueDate: '2027-12-01',
  taskCount: 5,
  completedCount: 2,
  createdAt: '2026-01-01T00:00:00.000Z',
};

function renderDetail() {
  const queryClient = new QueryClient();
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/projects/p1']}>
        <Routes>
          <Route path="/projects/:id" element={<ProjectDetail />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ProjectDetail', () => {
  beforeEach(() => {
    mockMutate.mockClear();
    mockUseProject.mockReturnValue({
      data: baseProject,
      isLoading: false,
      error: null,
    } as ReturnType<typeof useProject>);
  });

  it('shows a loading state', () => {
    mockUseProject.mockReturnValue({ data: undefined, isLoading: true, error: null } as ReturnType<typeof useProject>);
    renderDetail();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders the project name and description', () => {
    renderDetail();
    expect(screen.getByText('Alpha Project')).toBeInTheDocument();
    // description appears in both the display <p> and the hidden form textarea
    expect(screen.getAllByText('A test project').length).toBeGreaterThanOrEqual(1);
  });

  it('renders the due date', () => {
    renderDetail();
    expect(screen.getByText(/Due/)).toBeInTheDocument();
  });

  it('renders the status badge', () => {
    renderDetail();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('opens the edit form when the pencil button is clicked', async () => {
    renderDetail();
    await userEvent.click(screen.getByTitle('Edit project'));
    expect(screen.getByDisplayValue('Alpha Project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test project')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('closes the edit form when Cancel is clicked', async () => {
    renderDetail();
    await userEvent.click(screen.getByTitle('Edit project'));
    const saveButton = screen.getByRole('button', { name: 'Save' });
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    // form stays in DOM (CSS animation) but its wrapper is hidden
    expect(saveButton.closest('.max-h-0')).toBeInTheDocument();
  });

  it('shows a name validation error when saving with an empty name', async () => {
    renderDetail();
    await userEvent.click(screen.getByTitle('Edit project'));
    await userEvent.clear(screen.getByDisplayValue('Alpha Project'));
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.getByText('Name is required.')).toBeInTheDocument();
    expect(mockMutate).not.toHaveBeenCalled();
  });

  it('calls mutate with the correct payload on save', async () => {
    renderDetail();
    await userEvent.click(screen.getByTitle('Edit project'));

    const nameInput = screen.getByDisplayValue('Alpha Project');
    await userEvent.clear(nameInput);
    await userEvent.type(nameInput, 'Beta Project');

    await userEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(mockMutate).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Beta Project' }),
      expect.any(Object),
    );
  });

  it('prefills the form with the current project values', async () => {
    renderDetail();
    await userEvent.click(screen.getByTitle('Edit project'));
    expect(screen.getByDisplayValue('Alpha Project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('A test project')).toBeInTheDocument();
    expect(screen.getByDisplayValue('2027-12-01')).toBeInTheDocument();
  });
});

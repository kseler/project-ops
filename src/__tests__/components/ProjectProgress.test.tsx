import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProjectProgress } from '@/components/project/ProjectProgress';

describe('ProjectProgress', () => {
  it('shows 0% when the project has no tasks', () => {
    render(<ProjectProgress taskCount={0} completedCount={0} />);
    expect(screen.getByText('0%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  });

  it('rounds the completed share to a whole percent', () => {
    render(<ProjectProgress taskCount={3} completedCount={1} />);
    expect(screen.getByText('33%')).toBeInTheDocument();
  });

  it('shows 100% when every task is done', () => {
    render(<ProjectProgress taskCount={4} completedCount={4} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '100');
  });
});

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import GuidelinesIndex from '../../components/guidelines/GuidelinesIndex';

jest.mock('../../content/clinical/index.json', () => ([
  { slug: 'a', title: 'Article A', tags: ['tag1'], updated: '2025-08-17', preview: 'Alpha' },
  { slug: 'b', title: 'Article B', tags: ['tag2'], updated: '2025-08-17', preview: 'Beta' }
]));

test('filters by search and tag', () => {
  const onSelect = jest.fn();
  render(<GuidelinesIndex onSelect={onSelect} />);
  fireEvent.change(screen.getByLabelText(/search/i), { target: { value: 'Article B' } });
  expect(screen.getByText(/Article B/i)).toBeInTheDocument();
  fireEvent.click(screen.getByText('tag1'));
  expect(screen.queryByText(/Article B/i)).not.toBeInTheDocument();
});

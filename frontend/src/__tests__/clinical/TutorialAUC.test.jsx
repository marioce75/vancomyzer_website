import React from 'react';
import { render, screen } from '@testing-library/react';
import TutorialAUC from '../../components/tutorial/TutorialAUC';

test('renders AUC chips', () => {
  render(<TutorialAUC />);
  expect(screen.getByText(/AUC24/i)).toBeInTheDocument();
});

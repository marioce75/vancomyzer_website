import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import ClinicalInfo from '../../pages/ClinicalInfo';

function setup(){
  return render(<BrowserRouter><ClinicalInfo /></BrowserRouter>);
}

test('renders tabs and switches between Tutorial and Guidelines', () => {
  setup();
  expect(screen.getByRole('tab', { name: /tutorial/i })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: /guidelines/i })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('tab', { name: /guidelines/i }));
  expect(screen.getByLabelText(/Search guidelines/i)).toBeInTheDocument();
});

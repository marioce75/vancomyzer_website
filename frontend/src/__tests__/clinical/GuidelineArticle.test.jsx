import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import GuidelineArticle from '../../components/guidelines/GuidelineArticle';

const RAW = `---\ntitle: "Mock"\nupdated: "2025-01-01"\n---\n# Heading\nBody`;

jest.mock('html2canvas', () => jest.fn(() => Promise.resolve({ toDataURL: () => 'data:image/png;base64,xxx', width: 1000, height: 2000 })));
const saveMock = jest.fn();
jest.mock('jspdf', () => ({ jsPDF: jest.fn().mockImplementation(() => ({ internal: { pageSize: { getWidth: () => 595, getHeight: () => 842 } }, setFontSize: jest.fn(), text: jest.fn(), addImage: jest.fn(), addPage: jest.fn(), getNumberOfPages: jest.fn(() => 1), setPage: jest.fn(), save: saveMock })) }));

test('renders markdown article', async () => {
  render(<GuidelineArticle slug={'00_tutorial_overview'} overrideText={RAW} />);
  expect(await screen.findByText('Heading')).toBeInTheDocument();
});

test('export PDF button triggers save', async () => {
  render(<GuidelineArticle slug={'00_tutorial_overview'} overrideText={RAW} />);
  const btn = await screen.findByLabelText(/Export PDF/i);
  fireEvent.click(btn);
  await waitFor(() => expect(saveMock).toHaveBeenCalled());
});

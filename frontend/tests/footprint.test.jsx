import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FootprintForm from '../src/components/FootprintForm';
import { api } from '../src/utils/api';

vi.mock('../src/utils/api', () => ({
  api: {
    calculate: vi.fn(),
    getTips: vi.fn(),
    logRecord: vi.fn()
  }
}));

describe('FootprintForm', () => {
  it('renders all form fields', () => {
    render(<FootprintForm apiAvailable={true} />);
    expect(screen.getByLabelText(/Transport/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Energy/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Diet/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Calculate & Log/i })).toBeInTheDocument();
  });

  it('updates live preview correctly for vegetarian with no other activity', () => {
    render(<FootprintForm apiAvailable={true} />);
    
    // Default is average (3.8)
    expect(screen.getByText('3.80')).toBeInTheDocument();
    
    // Change diet to vegetarian
    fireEvent.change(screen.getByLabelText(/Diet/i), { target: { value: 'vegetarian' } });
    
    // Live estimate should update to 2.5
    expect(screen.getByText('2.50')).toBeInTheDocument();
  });

  it('calls api endpoints on submit when api is available', async () => {
    const mockCalcResult = {
      transport_kg: 1.92,
      energy_kg: 2.33,
      diet_kg: 3.8,
      total_kg: 8.05,
      record_date: '2026-06-20',
      grade: 'D'
    };
    
    const mockTips = { tips: ['A great tip!'] };
    
    api.calculate.mockResolvedValueOnce(mockCalcResult);
    api.getTips.mockResolvedValueOnce(mockTips);
    api.logRecord.mockResolvedValueOnce({});
    
    const handleResult = vi.fn();
    const handleTips = vi.fn();
    
    render(<FootprintForm onResult={handleResult} onTips={handleTips} apiAvailable={true} />);
    
    // Fill form
    fireEvent.change(screen.getByLabelText(/Transport/i), { target: { value: '10' } });
    fireEvent.change(screen.getByLabelText(/Energy/i), { target: { value: '10' } });
    
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Calculate & Log/i }));
    
    await waitFor(() => {
      expect(api.calculate).toHaveBeenCalledWith({
        transport_km: 10,
        energy_kwh: 10,
        diet: 'average',
        record_date: expect.any(String)
      });
      expect(handleResult).toHaveBeenCalled();
      expect(handleTips).toHaveBeenCalledWith(mockTips);
    });
    
    // Result card is shown
    expect(screen.getByText('8.05 kg CO₂ today')).toBeInTheDocument();
    expect(screen.getByText('D')).toBeInTheDocument(); // Grade
  });

  it('uses local fallback calculation when api is offline', async () => {
    const handleResult = vi.fn();
    
    render(<FootprintForm onResult={handleResult} apiAvailable={false} />);
    
    // Warning should be present
    expect(screen.getByText(/Running in offline mode/i)).toBeInTheDocument();
    
    // Change to zero activity vegetarian (should get A or B grade)
    fireEvent.change(screen.getByLabelText(/Transport/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Energy/i), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText(/Diet/i), { target: { value: 'vegetarian' } });
    
    // Submit
    fireEvent.click(screen.getByRole('button', { name: /Calculate & Log/i }));
    
    await waitFor(() => {
      expect(handleResult).toHaveBeenCalled();
    });
    
    // Result card is shown
    expect(screen.getByText('2.5 kg CO₂ today')).toBeInTheDocument();
    // 2.5 is <= 75% of 4.7 (avg), so it should be grade B based on offline logic
    expect(screen.getByText('B')).toBeInTheDocument(); 
  });
});

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../src/utils/api';

describe('api utility', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('health check uses GET /health', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ status: 'ok' })
    });
    
    const result = await api.health();
    
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/health'), expect.objectContaining({
      headers: expect.any(Object)
    }));
    expect(result.status).toBe('ok');
  });

  it('calculate uses POST with JSON body', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ total_kg: 10 })
    });
    
    const payload = { transport_km: 10, energy_kwh: 5, diet: 'average' };
    await api.calculate(payload);
    
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/footprint/calculate'), expect.objectContaining({
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    }));
  });

  it('throws custom error when response is not ok', async () => {
    fetch.mockResolvedValueOnce({
      ok: false,
      status: 422,
      statusText: 'Unprocessable Entity',
      json: async () => ({ message: 'Validation failed' })
    });
    
    await expect(api.health()).rejects.toThrow('Validation failed');
  });
});

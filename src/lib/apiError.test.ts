import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './apiError';

describe('getApiErrorMessage', () => {
  it('reads the API error envelope used by the backend exception filter', () => {
    const error = {
      response: {
        data: {
          data: null,
          error: {
            code: 'NOTARY_NOT_AVAILABLE',
            message: 'Belum ada notaris approved yang memenuhi syarat assignment',
          },
        },
      },
    };

    expect(getApiErrorMessage(error, 'Fallback')).toBe(
      'Belum ada notaris approved yang memenuhi syarat assignment',
    );
  });

  it('falls back when no useful message is available', () => {
    expect(getApiErrorMessage({}, 'Fallback')).toBe('Fallback');
  });
});

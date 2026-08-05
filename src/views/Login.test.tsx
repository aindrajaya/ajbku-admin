import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Login from './Login';

const navigateMock = vi.fn();
const authState: any = {
  tenantCode: '',
  setTenantCode: vi.fn(),
  status: 'anonymous',
  pendingAuth: null,
  loginWithCredentials: vi.fn(),
  completeTotpLogin: vi.fn(),
  cancelCredentialAuth: vi.fn(),
};
let pathname = '/auth/login';

vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => navigateMock,
  useRouterState: ({ select }: any) => select({ location: { pathname } }),
}));

vi.mock('../auth/AuthProvider', () => ({
  useAuth: () => authState,
}));

describe('Login', () => {
  beforeEach(() => {
    pathname = '/auth/login';
    navigateMock.mockReset();
    authState.tenantCode = '';
    authState.status = 'anonymous';
    authState.pendingAuth = null;
    authState.setTenantCode.mockReset();
    authState.loginWithCredentials.mockReset();
    authState.completeTotpLogin.mockReset();
    authState.cancelCredentialAuth.mockReset();
  });

  it('stops at TOTP boundary after credential login', async () => {
    authState.loginWithCredentials.mockResolvedValueOnce({ needsTotp: true });

    render(<Login />);

    fireEvent.change(screen.getByLabelText('Kode Kantor'), { target: { value: 'AJB01' } });
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'admin@test.dev' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'secret' } });
    fireEvent.click(screen.getByText('Masuk Akun'));

    await waitFor(() => {
      expect(authState.loginWithCredentials).toHaveBeenCalledWith({
        tenantCode: 'AJB01',
        email: 'admin@test.dev',
        password: 'secret',
      });
    });
    expect(navigateMock).toHaveBeenCalledWith({ to: '/auth/totp' });
  });

  it('shows PRD error message when TOTP verification fails', async () => {
    pathname = '/auth/totp';
    authState.status = 'credential-authenticated';
    authState.pendingAuth = {
      tenantCode: 'AJB01',
      user: { id: 'u1', tenantId: 't1', email: 'admin@test.dev', fullName: 'Admin', roles: ['ADMIN_INTAKE'] },
    };
    authState.completeTotpLogin.mockRejectedValueOnce(new Error('invalid-totp'));

    render(<Login />);

    fireEvent.change(screen.getByLabelText('Kode Authenticator'), { target: { value: '123456' } });
    fireEvent.click(screen.getByText('Verifikasi & Masuk'));

    expect(await screen.findByText('Kode tidak valid. Pastikan waktu perangkat Anda sinkron.')).toBeTruthy();
  });
});

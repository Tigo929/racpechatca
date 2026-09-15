import { UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import { LocalAgentTokenGuard } from './local-agent-token.guard';

function contextWithToken(token?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({
        header: () => (token ? `Bearer ${token}` : undefined),
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('LocalAgentTokenGuard', () => {
  const credential = {
    findUnique: jest.fn(),
    update: jest.fn(),
  };
  const guard = new LocalAgentTokenGuard({
    localAgentCredential: credential,
  } as never);

  beforeEach(() => jest.clearAllMocks());

  it('accepts an active token and records its use', async () => {
    credential.findUnique.mockResolvedValue({ id: 'credential-1', isActive: true });
    credential.update.mockResolvedValue({});

    await expect(guard.canActivate(contextWithToken('secret'))).resolves.toBe(true);
    expect(credential.update).toHaveBeenCalledWith({
      where: { id: 'credential-1' },
      data: { lastUsedAt: expect.any(Date) },
    });
  });

  it('rejects a missing token', async () => {
    await expect(guard.canActivate(contextWithToken())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects an unknown or disabled token', async () => {
    credential.findUnique.mockResolvedValue(null);
    await expect(
      guard.canActivate(contextWithToken('wrong')),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});

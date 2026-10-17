import { ServiceUnavailableException } from '@nestjs/common';
import { AiService } from './ai.service';

describe('AiService', () => {
  const originalToken = process.env.AI_GATEWAY_TOKEN;

  afterEach(() => {
    jest.restoreAllMocks();
    if (originalToken === undefined) delete process.env.AI_GATEWAY_TOKEN;
    else process.env.AI_GATEWAY_TOKEN = originalToken;
  });

  it('reports a disabled gateway without making a network request', async () => {
    delete process.env.AI_GATEWAY_TOKEN;
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(new AiService().health()).resolves.toEqual({
      status: 'disabled',
      configured: false,
    });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('rejects malformed gateway responses', async () => {
    process.env.AI_GATEWAY_TOKEN = 'secret';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ answer: 'missing session and tools' }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );

    await expect(new AiService().ask('Что происходит?')).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });

  it('adds trace metadata to a valid answer', async () => {
    process.env.AI_GATEWAY_TOKEN = 'secret';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          session: 'session-1',
          answer: 'Всё работает.',
          tools: ['crm_orders'],
          usage: { totalTokens: 10 },
        }),
        { status: 200, headers: { 'content-type': 'application/json' } },
      ),
    );

    await expect(
      new AiService().ask('Статус?', undefined, 'user-1'),
    ).resolves.toEqual(
      expect.objectContaining({
        session: 'session-1',
        requestId: expect.any(String),
        durationMs: expect.any(Number),
      }),
    );
  });
});

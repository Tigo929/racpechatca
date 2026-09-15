import { EnumTaskAssigneeKind } from 'src/generated/prisma/enums';
import { buildLocalAgentReportMessage } from './local-agent-report';

describe('local agent Telegram report', () => {
  const task = {
    id: 'd636a9c3-296c-4210-84cc-215c878f735a',
    title: 'Tg тов',
    assigneeKind: EnumTaskAssigneeKind.CODEX,
    order: { numberOrder: '20260915-1' },
  };

  it('builds an HTML-safe completion report for the group chat', () => {
    const message = buildLocalAgentReportMessage(
      task,
      'Изменил <script> & проверил.',
      'done',
    );

    expect(message).toContain('<b>Codex завершил задачу</b>');
    expect(message).toContain('<b>Tg тов</b>');
    expect(message).toContain(
      '<code>d636a9c3-296c-4210-84cc-215c878f735a</code>',
    );
    expect(message).toContain('<b>20260915-1</b>');
    expect(message).toContain('Изменил &lt;script&gt; &amp; проверил.');
  });

  it('keeps long reports inside Telegram message limit', () => {
    const message = buildLocalAgentReportMessage(
      task,
      '<&'.repeat(5000),
      'failed',
    );

    expect(message.length).toBeLessThanOrEqual(4096);
    expect(message).toContain('сообщил о проблеме');
    expect(message.endsWith('…')).toBe(true);
    expect(message).not.toMatch(/&(?!lt;|gt;|amp;|quot;|#039;)/);
  });
});

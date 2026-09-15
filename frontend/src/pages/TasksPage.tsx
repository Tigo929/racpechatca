import { useMemo, useState } from 'react';
import { usePersistentState } from '../hooks/usePersistentState';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Bot, CalendarClock, Check, Cloud, Pencil, Play, Plus, Trash2, X,
} from 'lucide-react';
import { AppShell } from '../components/layout/AppShell';
import { Modal } from '../components/ui/Modal';
import { FilterChip } from '../components/ui/FilterChip';
import { tasksApi } from '../api/tasks';
import { usersApi } from '../api/users';
import { useAuth } from '../context/useAuth';
import { getErrorMessage } from '../utils/get-error-message';
import {
  TASK_ASSIGNEE_KIND_LABELS, TASK_STATUS_LABELS, type AppUser,
  type CreateTaskDto, type EnumTaskAssigneeKind, type EnumTaskStatus, type Task,
} from '../types/index';

type StatusFilter = EnumTaskStatus | 'ACTIVE';

const FILTERS: { key: StatusFilter; label: string }[] = [
  { key: 'ACTIVE', label: 'Активные' },
  { key: 'OPEN', label: 'Новые' },
  { key: 'IN_PROGRESS', label: 'В работе' },
  { key: 'DONE', label: 'Выполненные' },
  { key: 'CANCELLED', label: 'Отменённые' },
];

/** Календарных дней до срока: 0 — сегодня, отрицательное — просрочено. */
function daysUntil(deadline: string): number {
  const d = new Date(deadline);
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const n = new Date();
  const b = new Date(n.getFullYear(), n.getMonth(), n.getDate()).getTime();
  return Math.round((a - b) / 86_400_000);
}

function pluralDays(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'день';
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return 'дня';
  return 'дней';
}

function DeadlineChip({ deadline, closed }: { deadline: string; closed: boolean }) {
  const days = daysUntil(deadline);
  const date = new Date(deadline).toLocaleDateString('ru-RU', {
    day: '2-digit', month: '2-digit',
  });
  if (closed) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
        <CalendarClock size={13} aria-hidden="true" />{date}
      </span>
    );
  }
  const overdue = days < 0;
  const today = days === 0;
  const label = overdue
    ? `просрочено на ${Math.abs(days)} ${pluralDays(Math.abs(days))}`
    : today ? 'сегодня' : days === 1 ? 'завтра' : `до ${date}`;
  const cls = overdue
    ? 'bg-red-50 text-red-700 border-red-200'
    : today
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-medium ${cls}`}>
      <CalendarClock size={13} aria-hidden="true" />
      {label}
    </span>
  );
}

interface FormState {
  title: string;
  description: string;
  assigneeTarget: string;
  deadline: string;
  /** Оплата за выполнение. Пусто или 0 — задача без оплаты. */
  rewardAmount: string;
  /** Короткий результат локального агента. */
  agentSummary: string;
}

const EMPTY_FORM: FormState = {
  title: '',
  description: '',
  assigneeTarget: '',
  deadline: '',
  rewardAmount: '',
  agentSummary: '',
};

const AGENT_OPTIONS: { kind: Exclude<EnumTaskAssigneeKind, 'USER'>; label: string }[] = [
  { kind: 'CODEX', label: 'Codex' },
  { kind: 'CLOUD_CODE', label: 'Claude Code' },
];

function userTarget(id: string) {
  return `user:${id}`;
}

function agentTarget(kind: Exclude<EnumTaskAssigneeKind, 'USER'>) {
  return `agent:${kind}`;
}

function parseAssigneeTarget(target: string): {
  assigneeKind: EnumTaskAssigneeKind;
  assigneeId?: string;
} | null {
  if (target.startsWith('user:')) {
    const assigneeId = target.slice(5);
    return assigneeId ? { assigneeKind: 'USER', assigneeId } : null;
  }
  if (target === 'agent:CODEX') return { assigneeKind: 'CODEX' };
  if (target === 'agent:CLOUD_CODE') return { assigneeKind: 'CLOUD_CODE' };
  return null;
}

function taskAssigneeTarget(task: Task) {
  if (task.assigneeKind === 'CODEX' || task.assigneeKind === 'CLOUD_CODE') {
    return agentTarget(task.assigneeKind);
  }
  return task.assigneeId ? userTarget(task.assigneeId) : '';
}

function AgentIcon({ kind }: { kind: EnumTaskAssigneeKind }) {
  if (kind === 'CLOUD_CODE') return <Cloud size={12} aria-hidden="true" />;
  if (kind === 'CODEX') return <Bot size={12} aria-hidden="true" />;
  return null;
}

export default function TasksPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const qc = useQueryClient();

  // Отбор задач держится: возвращаясь к списку, видишь то же, что оставил.
  const [filter, setFilter] = usePersistentState<StatusFilter>('tasks-filter', 'ACTIVE');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ['tasks', 'list'],
    queryFn: () => tasksApi.getAll(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: usersApi.getAll,
    enabled: isAdmin,
    staleTime: 60_000,
  });

  const assignable = useMemo(
    () => (users as AppUser[]).filter((u) => u.isActive),
    [users],
  );

  const visible = useMemo(() => {
    if (filter === 'ACTIVE') {
      return tasks.filter((t) => t.status === 'OPEN' || t.status === 'IN_PROGRESS');
    }
    return tasks.filter((t) => t.status === filter);
  }, [tasks, filter]);

  const overdueCount = tasks.filter(
    (t) => (t.status === 'OPEN' || t.status === 'IN_PROGRESS') &&
      t.deadline && daysUntil(t.deadline) < 0,
  ).length;

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ['tasks'] });
  };

  const saveMutation = useMutation({
    mutationFn: (dto: CreateTaskDto) =>
      editing ? tasksApi.update(editing.id, dto) : tasksApi.create(dto),
    onSuccess: () => {
      invalidate();
      setFormOpen(false);
      setEditing(null);
      setForm(EMPTY_FORM);
      toast.success(editing ? 'Задача обновлена' : 'Задача поставлена');
    },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось сохранить задачу')),
  });

  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: EnumTaskStatus }) =>
      tasksApi.setStatus(id, status),
    onSuccess: () => { invalidate(); toast.success('Статус обновлён'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось изменить статус')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => tasksApi.remove(id),
    onSuccess: () => { invalidate(); toast.success('Задача удалена'); },
    onError: (e) => toast.error(getErrorMessage(e, 'Не удалось удалить задачу')),
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ ...EMPTY_FORM, assigneeTarget: assignable[0]?.id ? userTarget(assignable[0].id) : '' });
    setFormOpen(true);
  };

  const openEdit = (task: Task) => {
    setEditing(task);
    setForm({
      title: task.title,
      description: task.description ?? '',
      assigneeTarget: taskAssigneeTarget(task),
      // <input type="date"> понимает только YYYY-MM-DD.
      deadline: task.deadline ? task.deadline.slice(0, 10) : '',
      rewardAmount: task.rewardAmount ? String(task.rewardAmount) : '',
      agentSummary: task.agentSummary ?? '',
    });
    setFormOpen(true);
  };

  const submit = () => {
    if (form.title.trim().length < 3) {
      toast.error('Опишите задачу подробнее — минимум 3 символа');
      return;
    }
    const assignee = parseAssigneeTarget(form.assigneeTarget);
    if (!assignee) {
      toast.error('Выберите ответственного');
      return;
    }
    const isAgentTask = assignee.assigneeKind !== 'USER';
    saveMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      assigneeKind: assignee.assigneeKind,
      assigneeId: assignee.assigneeId,
      // Срок ставим на конец дня: задача со сроком «сегодня» не должна
      // считаться просроченной с самого утра.
      deadline: form.deadline ? `${form.deadline}T23:59:00` : undefined,
      rewardAmount: isAgentTask ? 0 : Math.max(0, Math.round(Number(form.rewardAmount)) || 0),
      agentSummary: form.agentSummary.trim() || undefined,
    });
  };

  const parsedAssignee = parseAssigneeTarget(form.assigneeTarget);
  const selectedAssignee = parsedAssignee?.assigneeKind === 'USER'
    ? assignable.find((u) => u.id === parsedAssignee.assigneeId)
    : undefined;
  const selectedAgentKind = parsedAssignee?.assigneeKind !== 'USER'
    ? parsedAssignee?.assigneeKind
    : undefined;
  const noTelegram = !!selectedAssignee && !selectedAssignee.telegramUsername;

  return (
    <AppShell
      title="Задачи"
      subtitle={
        isLoading ? 'Загрузка…'
          : overdueCount > 0
            ? `${visible.length} в списке · ${overdueCount} просрочено`
            : `${visible.length} в списке`
      }
      onRefresh={() => void refetch()}
      actions={isAdmin ? (
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 px-3.5 min-h-[44px] bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        >
          <Plus size={15} aria-hidden="true" />
          <span className="hidden sm:inline">Новая задача</span>
        </button>
      ) : undefined}
    >
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <FilterChip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label}
          </FilterChip>
        ))}
      </div>

      <div className="mt-4 space-y-2">
        {isLoading ? (
          <p className="py-16 text-center text-gray-400">Загрузка…</p>
        ) : visible.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500">
              {filter === 'ACTIVE' ? 'Активных задач нет.' : 'В этом фильтре пусто.'}
            </p>
            {isAdmin && filter === 'ACTIVE' && (
              <button onClick={openCreate} className="mt-3 text-sm font-semibold text-amber-700 hover:text-amber-800">
                Поставить первую задачу
              </button>
            )}
          </div>
        ) : (
          visible.map((task) => {
            const closed = task.status === 'DONE' || task.status === 'CANCELLED';
            const mine = task.assigneeId === user?.id;
            return (
              <article
                key={task.id}
                className={`bg-white rounded-xl border p-4 transition-colors ${
                  closed ? 'border-gray-100 opacity-70' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <h3 className={`text-sm font-semibold ${closed ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                      {task.title}
                    </h3>
                    {task.description && (
                      <p className="mt-1 text-sm text-gray-500 whitespace-pre-wrap">{task.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 text-xs font-medium">
                        <AgentIcon kind={task.assigneeKind} />
                        {task.assigneeKind === 'USER'
                          ? task.assignee?.username ?? 'Ответственный не выбран'
                          : TASK_ASSIGNEE_KIND_LABELS[task.assigneeKind]}
                        {task.assigneeKind === 'USER' && !task.assignee?.telegramUsername && (
                          <span title="Telegram-ник не указан — напоминание не разбудит уведомлением">
                            <AlertTriangle size={12} className="text-amber-500" aria-hidden="true" />
                          </span>
                        )}
                      </span>
                      {task.deadline && <DeadlineChip deadline={task.deadline} closed={closed} />}
                      {task.order && (
                        <Link
                          to="/crm/photo"
                          className="text-xs font-medium text-gray-500 hover:text-indigo-700 underline decoration-dotted"
                        >
                          заказ {task.order.numberOrder}
                        </Link>
                      )}
                      {task.agentLastHeartbeatAt && (
                        <span className="text-xs text-gray-400">
                          пинг {new Date(task.agentLastHeartbeatAt).toLocaleString('ru-RU', {
                            day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                          })}
                        </span>
                      )}
                      {closed && (
                        <span className="text-xs text-gray-400">
                          {TASK_STATUS_LABELS[task.status]}
                        </span>
                      )}
                    </div>
                    {task.agentSummary && (
                      <div className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 px-3 py-2">
                        <p className="text-xs font-semibold text-emerald-800">Результат агента</p>
                        <p className="mt-1 whitespace-pre-wrap text-sm text-emerald-900">{task.agentSummary}</p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    {!closed && (isAdmin || mine) && (
                      <>
                        {task.status === 'OPEN' && (
                          <button
                            onClick={() => statusMutation.mutate({ id: task.id, status: 'IN_PROGRESS' })}
                            title="Взять в работу"
                            aria-label="Взять в работу"
                            className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                          >
                            <Play size={15} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          onClick={() => statusMutation.mutate({ id: task.id, status: 'DONE' })}
                          title="Выполнена"
                          aria-label="Отметить выполненной"
                          className="p-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition-colors"
                        >
                          <Check size={15} aria-hidden="true" />
                        </button>
                      </>
                    )}
                    {closed && isAdmin && (
                      <button
                        onClick={() => statusMutation.mutate({ id: task.id, status: 'OPEN' })}
                        title="Вернуть в работу"
                        aria-label="Вернуть в работу"
                        className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                      >
                        <Play size={15} aria-hidden="true" />
                      </button>
                    )}
                    {isAdmin && (
                      <>
                        {!closed && (
                          <button
                            onClick={() => statusMutation.mutate({ id: task.id, status: 'CANCELLED' })}
                            title="Отменить"
                            aria-label="Отменить задачу"
                            className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <X size={15} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          onClick={() => openEdit(task)}
                          title="Изменить"
                          aria-label="Изменить задачу"
                          className="p-2 text-gray-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition-colors"
                        >
                          <Pencil size={15} aria-hidden="true" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Удалить задачу «${task.title}»?`)) deleteMutation.mutate(task.id);
                          }}
                          title="Удалить"
                          aria-label="Удалить задачу"
                          className="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>

      <Modal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        title={editing ? 'Изменить задачу' : 'Новая задача'}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-gray-700">Что нужно сделать</span>
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Например: закупить плёнку Instax"
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Подробности <span className="text-gray-400">— необязательно</span></span>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Ответственный</span>
            <select
              value={form.assigneeTarget}
              onChange={(e) => setForm({ ...form, assigneeTarget: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500"
            >
              <option value="">— выберите —</option>
              <optgroup label="Сотрудники">
              {assignable.map((u) => (
                <option key={u.id} value={userTarget(u.id)}>
                  {u.username}{u.role === 'ADMIN' ? ' (админ)' : ''}
                </option>
              ))}
              </optgroup>
              <optgroup label="Локальные агенты на ноутбуке">
                {AGENT_OPTIONS.map((agent) => (
                  <option key={agent.kind} value={agentTarget(agent.kind)}>
                    {agent.label}
                  </option>
                ))}
              </optgroup>
            </select>
          </label>

          {selectedAgentKind && (
            <div className="flex gap-2 rounded-lg bg-indigo-50 border border-indigo-200 px-3 py-2.5">
              <Bot size={16} className="text-indigo-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-indigo-900">
                Задача попадёт в очередь для локального агента <b>{TASK_ASSIGNEE_KIND_LABELS[selectedAgentKind]}</b>.
                Ноутбук должен быть включён: локальный диспетчер заберёт описание, откроет инструмент и обновит статус в CRM.
              </p>
            </div>
          )}

          {/* Ошибку лучше показать здесь, чем ловить «мне не пришло» через неделю */}
          {noTelegram && (
            <div className="flex gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5">
              <AlertTriangle size={16} className="text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
              <p className="text-xs text-amber-800">
                У сотрудника <b>{selectedAssignee?.username}</b> не указан Telegram-ник.
                Задача попадёт в напоминание, но уведомление в телефон не придёт.
                Ник добавляется в разделе «Сотрудники».
              </p>
            </div>
          )}

          <label className="block">
            <span className="text-sm font-medium text-gray-700">Срок <span className="text-gray-400">— необязательно</span></span>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="mt-1 block text-xs text-gray-500">
              Со сроком бот напомнит в рабочем чате в 10:00 — за 3 дня до даты
              и каждый день, пока задача не закрыта. Без срока задача просто
              лежит в списке и чат не трогает.
            </span>
          </label>

          <label className="block">
            <span className="text-sm font-medium text-gray-700">
              Оплата за выполнение, ₽ <span className="text-gray-400">— необязательно</span>
            </span>
            <input
              type="number"
              min={0}
              placeholder="0"
              value={form.rewardAmount}
              disabled={!!selectedAgentKind}
              onChange={(e) => setForm({ ...form, rewardAmount: e.target.value })}
              className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="mt-1 block text-xs text-gray-500">
              {selectedAgentKind
                ? 'Локальным агентам оплата не начисляется: они работают через ваш ноутбук.'
                : 'Когда сотрудник отметит задачу выполненной, сумма начислится ему в зарплату и попадёт в долг. Пусто или 0 — задача без оплаты.'}
            </span>
          </label>

          {(selectedAgentKind || form.agentSummary) && (
            <label className="block">
              <span className="text-sm font-medium text-gray-700">
                Короткий результат <span className="text-gray-400">— заполнит агент или администратор</span>
              </span>
              <textarea
                value={form.agentSummary}
                onChange={(e) => setForm({ ...form, agentSummary: e.target.value })}
                rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
            </label>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={submit}
              disabled={saveMutation.isPending}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              {saveMutation.isPending ? 'Сохранение…' : editing ? 'Сохранить' : 'Поставить задачу'}
            </button>
            <button
              onClick={() => { setFormOpen(false); setEditing(null); }}
              className="px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </Modal>
    </AppShell>
  );
}

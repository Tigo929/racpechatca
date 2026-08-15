import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  Pencil,
  Trash2,
  Flame,
  Clock,
  Copy,
  UserCheck,
  X,
  Send,
  Printer,
  Paperclip,
  AlarmClock,
} from "lucide-react";
import { usersApi } from "../../api/users";
import {
  businessConfig,
  formatOrderNumberForClient,
  resolvePickupAddress,
} from "../../config/business";
import { COMMUNICATION_LABELS, DELIVERY_LABELS } from "../../constants";
import { GulianSyncBlock } from './GulianSyncBlock';
import { DispatchToExecutorModal } from './DispatchToExecutorModal';

/**
 * Напоминание о ПВЗ выделено: без пункта выдачи и телефона заявку на доставку
 * не оформить, а в длинном сообщении эта строка терялась.
 *
 * Подчёркивание делаем юникодной линией под каждым знаком, а не парой «__»
 * по краям: парные значки показывались получателю буквально. Здесь подчёркнут
 * сам текст, поэтому лишних символов в начале и в конце нет нигде.
 *
 * Жирный оставляем разметкой Telegram (**). Юникодного «жирного» начертания
 * для кириллицы не существует — только для латиницы, поэтому иначе никак.
 */
/** U+0332 — подчёркивающая линия под предыдущим знаком. Задаём кодом,
 *  а не символом: сам знак невидим в редакторе, и его легко потерять. */
const COMBINING_LOW_LINE = String.fromCharCode(0x0332);

const underlineEveryChar = (text: string): string =>
  // Раскладываем по символам, а не по кодовым единицам: иначе эмодзи и
  // составные знаки распались бы на половинки.
  [...text].map((char) => char + COMBINING_LOW_LINE).join('');

const pvzHighlight = (text: string): string =>
  `**${underlineEveryChar(text)}**`;

function pvzReminder(deliveryMethod: string): string[] {
  if (deliveryMethod === "YANDEX_PVZ") {
    return [
      "",
      `📦 ${pvzHighlight("После оплаты пришлите чек и сообщите удобный Яндекс ПВЗ + номер телефона — оформим заявку на доставку.")}`,
    ];
  }
  if (deliveryMethod === "OZON_PVZ") {
    return [
      "",
      `📦 ${pvzHighlight("После оплаты пришлите чек и сообщите удобный Ozon ПВЗ + номер телефона — оформим заявку на доставку.")}`,
    ];
  }
  return [];
}

type PhotoOrderItem = OrderPhoto["items"][number];

function isFreeFormPhotoItem(order: OrderPhoto, item: PhotoOrderItem): boolean {
  if (order.isFreePrice || item.isFreePrice) return true;
  return (item.pricePosition ?? 0) !== (item.price ?? 0) * (item.quantity ?? 0);
}

function formatPhotoItemLine(order: OrderPhoto, item: PhotoOrderItem): string {
  if (isFreeFormPhotoItem(order, item)) {
    return `• ${item.formatPaper} × ${item.quantity} шт — ${item.pricePosition.toLocaleString("ru-RU")} ₽`;
  }
  const type = item.typePaper === "GLOSS" ? "Глянец" : "Матт";
  return `• ${item.formatPaper} (${type}) × ${item.quantity} шт — ${item.pricePosition.toLocaleString("ru-RU")} ₽`;
}

function generateConfirmationText(order: OrderPhoto): string {
  const items = order.items ?? [];
  const tshirtItems = order.tshirtItems ?? [];
  const canvasItems = order.canvasItems ?? [];
  const delivery = order.deliveryCost ?? 0;
  const total = order.totalOrder ?? 0;
  const prepay = Math.ceil(total * 0.5);
  const rest = total - prepay;

  const lines: string[] = [];
  items.forEach((i) => {
    lines.push(formatPhotoItemLine(order, i));
  });
  tshirtItems.forEach((i) => {
    lines.push(
      `• Футболка ${i.color}, р-р ${i.size} × ${i.quantity} шт — ${i.pricePosition.toLocaleString("ru-RU")} ₽`,
    );
  });
  canvasItems.forEach((i) => {
    lines.push(
      `• Холст ${i.formatCanvas} × ${i.quantity} шт — ${i.pricePosition.toLocaleString("ru-RU")} ₽`,
    );
  });
  // Разработка дизайна — такая же позиция состава: она входит в итог заказа,
  // и без этой строки «сумма по позициям» не сходилась бы с «итого к оплате».
  const designCost = order.designDevelopmentCost ?? 0;
  if (designCost > 0) {
    lines.push(
      `• Разработка дизайна — ${designCost.toLocaleString("ru-RU")} ₽`,
    );
  }
  // Срочность — тоже позиция состава: клиент за неё платит и должен видеть,
  // за что именно. В зарплату сотрудников она при этом не попадает.
  const urgencyFee = order.urgencyFee ?? 0;
  if (urgencyFee > 0) {
    lines.push(
      `• Срочное изготовление — ${urgencyFee.toLocaleString("ru-RU")} ₽`,
    );
  }

  const itemsTotal =
    [...items, ...tshirtItems, ...canvasItems].reduce((s, i) => s + (i.pricePosition ?? 0), 0) +
    designCost +
    urgencyFee;
  const separator = "─────────────────";

  const isPickup = order.deliveryMethod === "PICKUP";
  const pickupAddr = resolvePickupAddress(order);

  const restLabel = isPickup
    ? `👉 Остаток — ${rest.toLocaleString("ru-RU")} ₽ при самовывозе`
    : `👉 Остаток — ${rest.toLocaleString("ru-RU")} ₽ при подтверждении фото доставки`;

  return [
    "✅ Отлично, ваш заказ подтверждён!",
    `📌 Номер заказа: ${formatOrderNumberForClient(order)}`,
    "",
    "📋 Состав заказа:",
    ...lines,
    "",
    separator,
    `💰 Сумма по позициям: ${itemsTotal.toLocaleString("ru-RU")} ₽`,
    ...(delivery > 0
      ? [
          `🚚 Доставка (${DELIVERY_LABELS[order.deliveryMethod as keyof typeof DELIVERY_LABELS] ?? order.deliveryMethod}): ${delivery.toLocaleString("ru-RU")} ₽`,
        ]
      : []),
    `📦 Итого к оплате: ${total.toLocaleString("ru-RU")} ₽`,
    separator,
    "💳 Для подтверждения заказа:",
    `👉 Предоплата 50% — ${prepay.toLocaleString("ru-RU")} ₽ (сейчас)`,
    restLabel,
    ...(isPickup ? ["", `📍 Самовывоз: ${pickupAddr}`] : []),
    "",
    `📲 Реквизиты для перевода (${businessConfig.payment.label}):`,
    `   ${businessConfig.payment.phone}`,
    `   ${businessConfig.payment.recipient}`,
    "",
    "👉 Как только внесёте оплату, пожалуйста, пришлите чек.",
    "",
    "Спасибо за доверие! Приступаем к работе 🙌",
  ].join("\n");
}

function generateReadyText(order: OrderPhoto): string {
  const items = order.items ?? [];
  const tshirtItems = order.tshirtItems ?? [];
  const canvasItems = order.canvasItems ?? [];
  const delivery = order.deliveryCost ?? 0;
  const total = order.totalOrder ?? 0;
  const prepay = Math.ceil(total * 0.5);
  const rest = total - prepay;

  const lines: string[] = [];
  items.forEach((i) => {
    lines.push(formatPhotoItemLine(order, i));
  });
  tshirtItems.forEach((i) => {
    lines.push(
      `• Футболка ${i.color}, р-р ${i.size} × ${i.quantity} шт — ${i.pricePosition.toLocaleString("ru-RU")} ₽`,
    );
  });
  canvasItems.forEach((i) => {
    lines.push(
      `• Холст ${i.formatCanvas} × ${i.quantity} шт — ${i.pricePosition.toLocaleString("ru-RU")} ₽`,
    );
  });
  // Разработка дизайна — такая же позиция состава: она входит в итог заказа,
  // и без этой строки «сумма по позициям» не сходилась бы с «итого к оплате».
  const designCost = order.designDevelopmentCost ?? 0;
  if (designCost > 0) {
    lines.push(
      `• Разработка дизайна — ${designCost.toLocaleString("ru-RU")} ₽`,
    );
  }
  // Срочность — тоже позиция состава: клиент за неё платит и должен видеть,
  // за что именно. В зарплату сотрудников она при этом не попадает.
  const urgencyFee = order.urgencyFee ?? 0;
  if (urgencyFee > 0) {
    lines.push(
      `• Срочное изготовление — ${urgencyFee.toLocaleString("ru-RU")} ₽`,
    );
  }

  const itemsTotal =
    [...items, ...tshirtItems, ...canvasItems].reduce((s, i) => s + (i.pricePosition ?? 0), 0) +
    designCost +
    urgencyFee;
  const separator = "─────────────────";
  const isPickup = order.deliveryMethod === "PICKUP";
  const pickupAddr = resolvePickupAddress(order);

  return [
    "🎉 Ваш заказ готов!",
    `📌 Номер заказа: ${formatOrderNumberForClient(order)}`,
    "",
    "📋 Состав заказа:",
    ...lines,
    "",
    separator,
    `💰 Сумма по позициям: ${itemsTotal.toLocaleString("ru-RU")} ₽`,
    ...(delivery > 0
      ? [
          `🚚 Доставка (${DELIVERY_LABELS[order.deliveryMethod as keyof typeof DELIVERY_LABELS] ?? order.deliveryMethod}): ${delivery.toLocaleString("ru-RU")} ₽`,
        ]
      : []),
    `📦 Итого к оплате: ${total.toLocaleString("ru-RU")} ₽`,
    "",
    separator,
    "💳 Остаток к оплате:",
    `👉 Предоплата 50% — ${prepay.toLocaleString("ru-RU")} ₽ (уже внесена)`,
    `👉 Остаток — ${rest.toLocaleString("ru-RU")} ₽`,
    ...(isPickup ? ["", `📍 Самовывоз: ${pickupAddr}`] : []),
    "",
    `📲 Реквизиты для перевода (${businessConfig.payment.label}):`,
    `   ${businessConfig.payment.phone}`,
    `   ${businessConfig.payment.recipient}`,
    "",
    "👉 Пожалуйста, оплатите остаток и пришлите чек по тем же реквизитам.",
    ...pvzReminder(order.deliveryMethod),
    "",
    "Спасибо! Ждём вас 🙌",
  ].join("\n");
}
import { getDeadlineInfo } from "../../utils/deadline";
import { getStalledDays } from "../../utils/stalled";
import { ordersApi } from "../../api/orders";
import { partnerSettingsApi } from "../../api/partnerSettings";
import { computeSettlement } from "../../utils/settlement";
import { StatusStepper } from "./StatusStepper";
import { ItemsTable } from "./ItemsTable";
import { StatusBadge } from "../ui/StatusBadge";
import { InfoRow } from "../ui/InfoRow";
import { OrderEditForm } from "./OrderEditForm";
import { TshirtItemsTable } from "./TshirtItemsTable";
import { CanvasItemsTable } from "./CanvasItemsTable";
import { useAuth } from "../../context/useAuth";
import type { AppUser, UpdateOrderDto, OrderPhoto } from "../../types/index";
import { getErrorMessage } from "../../utils/get-error-message";

const inputCls =
  "w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:border-transparent";

interface AssignPanelProps {
  order: OrderPhoto;
  onAssigned: (updated: OrderPhoto) => void;
}

function AssignPanel({ order, onAssigned }: AssignPanelProps) {
  const [open, setOpen] = useState(false);
  const [executorId, setExecutorId] = useState(order.executorId ?? "");

  const { data: users = [] } = useQuery({
    queryKey: ["users"],
    queryFn: usersApi.getAll,
    staleTime: 60_000,
  });

  // Свободные сверху: назначая заказ, сразу видно, кому есть куда его дать.
  const executors = users
    .filter((u: AppUser) => u.role === "EXECUTOR" && u.isActive !== false)
    .sort((a, b) => (a.activeOrdersCount ?? 0) - (b.activeOrdersCount ?? 0));

  const mutation = useMutation({
    mutationFn: () => ordersApi.assignExecutor(order.id, executorId || null),
    onSuccess: (updated) => {
      onAssigned(updated);
      setOpen(false);
      toast.success(executorId ? "Исполнитель назначен" : "Исполнитель снят");
    },
    onError: (error: unknown) => toast.error(getErrorMessage(error, "Ошибка")),
  });

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-dashed border-indigo-300 text-indigo-600 hover:bg-indigo-50 transition-colors"
      >
        <UserCheck size={13} />
        {order.executor
          ? `Исполнитель: ${order.executor.username}`
          : "Назначить исполнителя"}
      </button>
    );
  }

  return (
    <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-3 flex items-center gap-2">
      <select
        value={executorId}
        onChange={(e) => setExecutorId(e.target.value)}
        className={inputCls + " flex-1"}
      >
        <option value="">— без исполнителя —</option>
        {executors.map((u) => (
          <option key={u.id} value={u.id}>
            {u.username} —{" "}
            {(u.activeOrdersCount ?? 0) === 0
              ? "свободен"
              : `${u.activeOrdersCount} в работе`}
            {u.rateBasisPoints === null
              ? " · ставка не назначена"
              : ` · ${(u.rateBasisPoints / 100).toFixed(2)}%`}
          </option>
        ))}
      </select>
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending}
        className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
      >
        {mutation.isPending ? "…" : "Назначить"}
      </button>
      <button
        onClick={() => setOpen(false)}
        className="p-1.5 text-gray-400 hover:text-gray-600"
      >
        <X size={14} />
      </button>
    </div>
  );
}

interface Props {
  orderId: string;
  onDeleted: () => void;
}

export function OrderDetail({ orderId, onDeleted }: Props) {
  const { user } = useAuth();
  // Менеджер по оформлению управляет заказами как админ (и видит суммы заказа).
  const isAdmin = user?.role === "ADMIN" || user?.role === "ORDER_MANAGER";
  // Разбивку прибыли владельца (расчёт с партнёром) видит только сам владелец.
  const isOwner = user?.role === "ADMIN";

  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<UpdateOrderDto>({});

  const {
    data: order,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => ordersApi.getById(orderId),
  });

  // Ставка партнёра для разбивки в карточке (только для футболок у админа).
  const { data: partnerSettings } = useQuery({
    queryKey: ["partner-settings"],
    queryFn: partnerSettingsApi.get,
    enabled: isOwner && order?.productCategory === "TSHIRT",
    staleTime: 60_000,
  });

  const [showDispatchModal, setShowDispatchModal] = useState(false);

  const tshirtPayout = useMemo(() => {
    if (!partnerSettings || !(order?.tshirtItems?.length)) return null;
    const items = order!.tshirtItems!;
    const qty = items.reduce((s, i) => s + i.quantity, 0);
    const s = computeSettlement(items, partnerSettings.partnerRateBasisPoints);
    const totalKopecks = Math.round(s.reward * 100);
    const mode = qty > 0 && totalKopecks % qty === 0 ? 'per_unit' as const : 'order_total' as const;
    const totalPayoutRub = Math.round(s.reward);
    const unitPayoutRub = mode === 'per_unit' ? Math.round(s.reward / qty) : null;
    return { quantity: qty, totalPayoutRub, unitPayoutRub, mode };
  }, [order?.tshirtItems, partnerSettings]);

  const updateMutation = useMutation({
    mutationFn: (dto: UpdateOrderDto) => ordersApi.update(orderId, dto),
    onSuccess: (updated) => {
      qc.setQueryData(["order", orderId], updated);
      qc.invalidateQueries({ queryKey: ["orders"] });
      setEditing(false);
      toast.success("Заявка обновлена");
    },
    onError: () => toast.error("Ошибка обновления"),
  });

  const toggleUrgent = () => {
    if (!order) return;
    updateMutation.mutate({ isUrgent: !order.isUrgent });
  };

  const uploadPhotoMutation = useMutation({
    mutationFn: (files: File[]) =>
      ordersApi.uploadTechSpecPhotos(orderId, files),
    onSuccess: (updated) => {
      qc.setQueryData(["order", orderId], updated);
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("ТЗ-файлы прикреплены");
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Не удалось загрузить ТЗ-файлы")),
  });

  const sendTshirtTelegramMutation = useMutation({
    mutationFn: () => ordersApi.sendTshirtTelegram(orderId),
    onSuccess: (updated) => {
      qc.setQueryData(["order", orderId], updated);
      qc.invalidateQueries({ queryKey: ["orders"] });
      if (updated.partnerSyncStatus === "SENT") {
        toast.success("ТЗ отправлено в Telegram");
      } else {
        toast.error(updated.partnerSyncError ?? "Не удалось отправить ТЗ");
      }
    },
    onError: (error: unknown) =>
      toast.error(getErrorMessage(error, "Ошибка отправки в Telegram")),
  });

  const handleViewPhoto = async (index = 0) => {
    try {
      const blob = await ordersApi.getTechSpecPhoto(orderId, index);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось открыть ТЗ-файл"));
    }
  };

  const [clientStickerLoading, setClientStickerLoading] = useState(false);
  const handlePrintClientSticker = async () => {
    try {
      setClientStickerLoading(true);
      const blob = await ordersApi.getClientStickerPdf(orderId);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сформировать стикер"));
    } finally {
      setClientStickerLoading(false);
    }
  };

  const [stickerLoading, setStickerLoading] = useState(false);
  const handlePrintSticker = async () => {
    try {
      setStickerLoading(true);
      const blob = await ordersApi.getStickerPdf(orderId);
      // Открываем PDF в новой вкладке — оттуда удобно отправить на печать.
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (error) {
      toast.error(getErrorMessage(error, "Не удалось сформировать стикер"));
    } finally {
      setStickerLoading(false);
    }
  };

  const deleteMutation = useMutation({
    mutationFn: () => ordersApi.delete(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["orders"] });
      toast.success("Заявка удалена");
      onDeleted();
    },
    onError: () => toast.error("Ошибка удаления"),
  });

  const startEdit = () => {
    if (!order) return;
    // Если Telegram — вернуть @username из https://t.me/username
    const urlComm =
      order.communicationPlatform === "TELEGRAM" &&
      order.urlCommunication.startsWith("https://t.me/")
        ? "@" + order.urlCommunication.replace("https://t.me/", "")
        : order.urlCommunication;
    setForm({
      sourceOrder: order.sourceOrder,
      communicationPlatform: order.communicationPlatform,
      urlCommunication: urlComm,
      deliveryMethod: order.deliveryMethod,
      deliveryCost: order.deliveryCost,
      designDevelopmentCost: order.designDevelopmentCost ?? 0,
      isUrgent: order.isUrgent ?? false,
      urgencyFee: order.urgencyFee ?? 0,
      note: order.note,
    });
    setEditing(true);
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <div
          role="status"
          aria-label="Загрузка заявки"
          className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"
        />
      </div>
    );
  }

  if (!order) return null;

  const techSpecPaths =
    order.techSpecPhotoPaths && order.techSpecPhotoPaths.length > 0
      ? order.techSpecPhotoPaths
      : order.techSpecPhotoPath
        ? [order.techSpecPhotoPath]
        : [];
  const hasTechSpecFiles = techSpecPaths.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-2xl font-bold text-gray-900">
              #{order.numberOrder}
            </span>
            <StatusBadge
              status={order.status}
              productCategory={order.productCategory}
            />
            {/* Дедлайн — для фото, срочность — для любого незакрытого заказа */}
            {(() => {
              const isClosed = [
                "PAID",
                "SENT",
                "DONE",
                "COMPLETED",
                "CANCELLED",
              ].includes(order.status);
              if (isClosed) return null;
              const tracksDeadline = order.productCategory !== "TSHIRT";
              const dl = tracksDeadline
                ? getDeadlineInfo(order.deadline, order.createdAt)
                : null;
              return (
                <>
                  {dl?.label && (
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${dl.badgeClass}`}
                    >
                      <Clock size={10} /> {dl.label}
                    </span>
                  )}
                  {order.isUrgent && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold border border-red-300 motion-safe:animate-pulse">
                      <Flame size={11} aria-hidden="true" /> Срочно
                    </span>
                  )}
                  {(() => {
                    const stalled = getStalledDays(order);
                    return stalled === null ? null : (
                      <span
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-50 text-red-700 text-xs font-semibold border border-red-200"
                        title="Статус не менялся — заказ стоит без движения"
                      >
                        <AlarmClock size={11} aria-hidden="true" /> Завис{" "}
                        {stalled} дн.
                      </span>
                    );
                  })()}
                </>
              );
            })()}
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0 flex-wrap justify-end">
          {/* Кнопка Срочно — только для незакрытых заказов */}
          {!["PAID", "SENT", "DONE", "COMPLETED", "CANCELLED"].includes(
            order.status,
          ) && (
            <button
              onClick={toggleUrgent}
              disabled={updateMutation.isPending}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 ${
                order.isUrgent
                  ? "bg-red-500 text-white hover:bg-red-600"
                  : "bg-red-50 text-red-600 hover:bg-red-100 border border-red-200"
              }`}
            >
              <Flame size={13} aria-hidden="true" />
              {order.isUrgent ? "Снять срочность" : "Срочно"}
            </button>
          )}
          {/* Клиентский стикер на пакет — печатают и админ, и исполнитель,
              как только заказ готов. */}
            {order.productCategory === "PHOTO" &&
            ["READY", "SHIPMENT_CREATED", "DONE", "SENT", "PAID", "COMPLETED"].includes(
              order.status,
            ) && (
              <button
                onClick={handlePrintClientSticker}
                disabled={clientStickerLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              >
                <Printer size={13} aria-hidden="true" />
                {clientStickerLoading ? "Готовим…" : "Печать PDF"}
              </button>
            )}
          {isAdmin && (
            <>
              {/* Копирование текста клиенту: подтверждение при NEW, сообщение
                  готовности с остатком к оплате при READY. Одинаково для фото
                  и футболок — «готов» у обоих теперь READY. */}
              {(() => {
                const isNew = order.status === "NEW";
                const isReady = order.status === "READY";
                if (!isNew && !isReady) return null;
                const text = isNew
                  ? generateConfirmationText(order)
                  : generateReadyText(order);
                const label = isNew
                  ? "Скопировать подтверждение"
                  : "Скопировать сообщение готовности";
                const copyText = () => {
                  try {
                    if (navigator.clipboard && window.isSecureContext) {
                      navigator.clipboard
                        .writeText(text)
                        .then(() => toast.success("Текст скопирован!"))
                        .catch(() => toast.error("Не удалось скопировать"));
                    } else {
                      const ta = document.createElement("textarea");
                      ta.value = text;
                      ta.style.position = "fixed";
                      ta.style.opacity = "0";
                      document.body.appendChild(ta);
                      ta.focus();
                      ta.select();
                      document.execCommand("copy");
                      document.body.removeChild(ta);
                      toast.success("Текст скопирован!");
                    }
                  } catch {
                    toast.error("Не удалось скопировать");
                  }
                };
                return (
                  <button
                    onClick={copyText}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                  >
                    <Copy size={13} aria-hidden="true" /> {label}
                  </button>
                );
              })()}
              {order.productCategory === "TSHIRT" && (
                <button
                  onClick={handlePrintSticker}
                  disabled={stickerLoading}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                >
                  <Printer size={13} aria-hidden="true" />
                  {stickerLoading ? "Готовим…" : "Стикер (PDF)"}
                </button>
              )}
              {!editing && (
                <button
                  onClick={startEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                >
                  <Pencil size={13} aria-hidden="true" /> Изменить
                </button>
              )}
              <button
                onClick={() => {
                  if (confirm("Удалить заявку?")) deleteMutation.mutate();
                }}
                disabled={deleteMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Trash2 size={13} aria-hidden="true" /> Удалить
              </button>
            </>
          )}
        </div>
      </div>

      {/* Status flow */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <p className="text-xs font-medium text-gray-500">Прогресс статуса</p>
        <StatusStepper order={order} />
        {/* Внешние продукты печатает подрядчик — своего исполнителя на них не назначаем. */}
        {isAdmin && order.productCategory === "PHOTO" && (
          <AssignPanel
            order={order}
            onAssigned={(updated) => {
              qc.setQueryData(["order", orderId], updated);
              refetch();
            }}
          />
        )}
      </div>

      {/* ТЗ исполнителю-партнёру — только TSHIRT-заказы, только админ */}
      {isAdmin && order.productCategory === "TSHIRT" && (
        <div
          className={`rounded-xl border p-4 space-y-3 ${
            order.partnerSyncStatus === "SENT"
              ? "bg-emerald-50 border-emerald-200"
              : order.partnerSyncStatus === "FAILED"
                ? "bg-red-50 border-red-200"
                : "bg-gray-50 border-gray-200"
          }`}
        >
          <p className="text-xs font-medium text-gray-500">
            Исполнитель-партнёр (печать футболок)
          </p>

          {/* Разбивка расчёта с партнёром — сколько он зарабатывает и моя прибыль */}
          {partnerSettings &&
            (order.tshirtItems?.length ?? 0) > 0 &&
            (() => {
              const s = computeSettlement(
                order.tshirtItems ?? [],
                partnerSettings.partnerRateBasisPoints,
              );
              // Партнёр делит только печать футболок. Разработка дизайна и
              // свободные позиции (кружки, баннеры, доп. услуги) — полностью
              // ваши: они в чеке клиента, но в делёж с партнёром не входят.
              // Без них «Моя прибыль» была занижена ровно на эти суммы.
              const designRub = order.designDevelopmentCost ?? 0;
              const extraRub = (order.items ?? []).reduce(
                (sum, i) => sum + (i.pricePosition ?? 0),
                0,
              );
              const ownerTotal = s.ownerProfit + designRub + extraRub;
              const money = (v: number) => `${v.toLocaleString("ru-RU")} ₽`;
              const Row = ({
                l,
                v,
                strong,
              }: {
                l: string;
                v: string;
                strong?: boolean;
              }) => (
                <div
                  className={`flex justify-between ${strong ? "font-semibold text-gray-900" : "text-gray-500"}`}
                >
                  <span>{l}</span>
                  <span className="tabular-nums">{v}</span>
                </div>
              );
              return (
                <div className="rounded-lg bg-white border border-gray-200 p-3 text-sm space-y-1">
                  <Row l="Сумма футболок" v={money(s.tshirtRevenue)} />
                  <Row
                    l="Материалы (термо + футболка)"
                    v={money(s.materials)}
                  />
                  <Row l="Делимая маржа" v={money(s.margin)} />
                  <Row
                    l={`Заработок партнёра (${partnerSettings.partnerRateBasisPoints / 100}%)`}
                    v={money(s.partnerProfit)}
                  />
                  <Row
                    l={`Плачу ${partnerSettings.partnerName}`}
                    v={money(s.reward)}
                    strong
                  />

                  <div className="pt-1.5 mt-1 border-t border-gray-100 space-y-1">
                    <Row l="Прибыль с футболок" v={money(s.ownerProfit)} />
                    {designRub > 0 && (
                      <Row l="+ Разработка дизайна" v={money(designRub)} />
                    )}
                    {extraRub > 0 && (
                      <Row l="+ Доп. позиции" v={money(extraRub)} />
                    )}
                    <Row l="Моя прибыль" v={money(ownerTotal)} strong />
                  </div>

                  <p className="text-[11px] text-gray-400 pt-1">
                    Расход «Вознаграждение партнёру» на {money(s.reward)}{" "}
                    создаётся при статусе «Оплачен». Доставка сюда не входит —
                    она транзитная.
                  </p>
                </div>
              );
            })()}

          {/* ТЗ-файлы (согласованный макет и уточнения) */}
          <div className="flex items-center gap-3 flex-wrap">
            <label className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-indigo-700 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 cursor-pointer transition-colors">
              <Paperclip size={13} aria-hidden="true" />
              {hasTechSpecFiles ? "Заменить ТЗ-файлы" : "Прикрепить ТЗ-файлы"}
              <input
                type="file"
                accept="image/*,application/pdf"
                multiple
                className="hidden"
                disabled={uploadPhotoMutation.isPending}
                onChange={(e) => {
                  const files = Array.from(e.target.files ?? []);
                  if (files.length > 0) uploadPhotoMutation.mutate(files);
                  e.target.value = "";
                }}
              />
            </label>
            {hasTechSpecFiles && (
              <div className="flex items-center gap-2 flex-wrap text-xs">
                <span className="text-gray-500">
                  Прикреплено: {techSpecPaths.length}
                </span>
                {techSpecPaths.map((path, index) => (
                  <button
                    key={`${path}-${index}`}
                    onClick={() => handleViewPhoto(index)}
                    className="text-indigo-700 underline hover:text-indigo-900"
                  >
                    {techSpecPaths.length === 1
                      ? "Открыть ТЗ"
                      : `Открыть ТЗ ${index + 1}`}
                  </button>
                ))}
              </div>
            )}
            {uploadPhotoMutation.isPending && (
              <span className="text-xs text-gray-500">Загрузка…</span>
            )}
          </div>

          {/* Статус Telegram-отправки */}
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              {order.partnerSyncStatus === "SENT" ? (
                <p className="text-sm font-semibold text-emerald-700">
                  ТЗ отправлено исполнителю в Telegram
                  {order.partnerSyncAt && (
                    <span className="font-normal text-emerald-600">
                      {" "}
                      ({new Date(order.partnerSyncAt).toLocaleString("ru-RU")})
                    </span>
                  )}
                </p>
              ) : order.partnerSyncStatus === "FAILED" ? (
                <>
                  <p className="text-sm font-semibold text-red-700">
                    Ошибка отправки в Telegram
                  </p>
                  {order.partnerSyncError && (
                    <p className="text-xs text-red-600 mt-0.5 break-words">
                      {order.partnerSyncError}
                    </p>
                  )}
                </>
              ) : order.partnerSyncStatus === "PENDING" ? (
                <p className="text-sm font-semibold text-gray-600">
                  Отправляется…
                </p>
              ) : (
                <p className="text-sm text-gray-600">
                  Нажмите «Отправить исполнителю»: CRM проверит ТЗ-файлы,
                  поставит статус «Отправлен» и отправит заказ в Telegram.
                </p>
              )}
              {!hasTechSpecFiles && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Сначала прикрепите ТЗ-файл — без него статус «Отправлен» не
                  поставится.
                </p>
              )}
            </div>
            {order.status !== "PAID" && (
              <button
                onClick={() => setShowDispatchModal(true)}
                disabled={
                  sendTshirtTelegramMutation.isPending ||
                  order.partnerSyncStatus === "PENDING"
                }
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
              >
                <Send size={13} aria-hidden="true" />
                {sendTshirtTelegramMutation.isPending
                  ? "Отправка…"
                  : (order as any).executorSentAt
                    ? "Повторно отправить исполнителю"
                    : "Отправить заказ исполнителю"}
              </button>
            )}
          </div>
          {(order as any).executorSentAt && (
            <GulianSyncBlock orderId={order.id} order={order as any} />
          )}
        </div>
      )}

      {showDispatchModal && tshirtPayout && order && (
        <DispatchToExecutorModal
          orderNumber={String(order.numberOrder ?? order.id)}
          payout={tshirtPayout}
          isResend={(order as any).executorSentAt != null}
          isPending={sendTshirtTelegramMutation.isPending}
          onConfirm={() => { setShowDispatchModal(false); sendTshirtTelegramMutation.mutate(); }}
          onCancel={() => setShowDispatchModal(false)}
        />
      )}

      {/* Details */}
      {isAdmin && editing ? (
        <OrderEditForm
          form={form}
          onChange={setForm}
          onSave={() => updateMutation.mutate(form)}
          onCancel={() => setEditing(false)}
          isPending={updateMutation.isPending}
          productCategory={order.productCategory}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          <InfoRow
            label="Платформа общения"
            value={COMMUNICATION_LABELS[order.communicationPlatform]}
          />
          <InfoRow
            label="Способ доставки"
            value={DELIVERY_LABELS[order.deliveryMethod]}
          />
          {isAdmin && (
            <>
              <InfoRow
                label="Доставка"
                value={`${(order.deliveryCost ?? 0).toLocaleString()} ₽`}
              />
              {(order.urgencyFee ?? 0) > 0 && (
                <InfoRow
                  label="Срочность"
                  value={`${(order.urgencyFee ?? 0).toLocaleString()} ₽`}
                />
              )}
              {(order.designDevelopmentCost ?? 0) > 0 && (
                <InfoRow
                  label="Разработка дизайна"
                  value={`${(order.designDevelopmentCost ?? 0).toLocaleString()} ₽`}
                />
              )}
              {order.note && (
                <InfoRow
                  label="Примечание"
                  value={order.note}
                  className="sm:col-span-2"
                />
              )}
              {order.productCategory === "CANVAS" && (
                <div className="sm:col-span-2 rounded-xl border border-cyan-100 bg-cyan-50/50 p-3 grid grid-cols-3 gap-3 text-sm">
                  {(() => {
                    const totals = (order.canvasItems ?? []).reduce(
                      (acc, item) => {
                        acc.revenue += item.pricePosition ?? 0;
                        acc.cost += item.contractorCostPosition ?? 0;
                        acc.profit += item.profitPosition ?? 0;
                        return acc;
                      },
                      { revenue: 0, cost: 0, profit: 0 },
                    );
                    const money = (value: number) =>
                      `${value.toLocaleString("ru-RU")} ₽`;
                    return (
                      <>
                        <div>
                          <p className="text-xs text-gray-500">Холсты клиенту</p>
                          <p className="font-semibold text-gray-900">{money(totals.revenue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Подрядчик</p>
                          <p className="font-semibold text-gray-900">{money(totals.cost)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Маржа</p>
                          <p className={`font-semibold ${totals.profit >= 0 ? "text-emerald-700" : "text-red-600"}`}>
                            {money(totals.profit)}
                          </p>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
              <div className="sm:col-span-2 pt-2 border-t border-gray-100 flex justify-end">
                <div className="text-right">
                  <p className="text-xs text-gray-500">Сумма заказа</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {(order.totalOrder ?? 0).toLocaleString()} ₽
                  </p>
                </div>
              </div>
            </>
          )}
          {!isAdmin && order.note && (
            <InfoRow
              label="Примечание"
              value={order.note}
              className="sm:col-span-2"
            />
          )}
        </div>
      )}

      {/* Items — исполнители видят только фото-позиции */}
      {order.productCategory === "TSHIRT" && isAdmin ? (
        order.isFreePrice ? (
          <ItemsTable order={order} />
        ) : (
          <TshirtItemsTable order={order} />
        )
      ) : order.productCategory === "CANVAS" && isAdmin ? (
        <CanvasItemsTable order={order} />
      ) : order.productCategory === "PHOTO" ? (
        <ItemsTable order={order} />
      ) : null}
    </div>
  );
}

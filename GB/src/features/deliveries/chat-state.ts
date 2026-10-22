import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { deliveriesApi, type ChatChannel } from '../../modules/deliveries/api/deliveries.api';
import type { DeliveryMessage } from '../../modules/deliveries/types/delivery.types';
import { playChatMessageSound } from '../../modules/orders/utils/notification-sound';
import { notify } from './notify';

const POLL_MS = 4_000;

export const chatKey = (channel: ChatChannel) =>
  ['delivery-chat', channel.as, channel.as === 'CUSTOMER' ? channel.code : channel.deliveryId] as const;

const chatId = (channel: ChatChannel) =>
  `${channel.as}:${channel.as === 'CUSTOMER' ? channel.code : channel.deliveryId}`;

/** The chat's messages, shared by everything that shows or watches the same chat (one request every few seconds). */
export function useChatMessages(channel: ChatChannel, enabled = true) {
  return useQuery({
    queryKey: chatKey(channel),
    queryFn: () => deliveriesApi.messages(channel),
    enabled,
    refetchInterval: POLL_MS,
    refetchIntervalInBackground: true,
  });
}

// ---- What each viewer has read, per chat, kept on the device ----

const STORAGE_KEY = 'gb-delivery-chat-read';
const listeners = new Set<() => void>();
let readUntil: Record<string, string> = (() => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, string>;
  } catch {
    return {};
  }
})();

function setReadUntil(id: string, at: string): void {
  if (readUntil[id] && readUntil[id] >= at) return;
  readUntil = { ...readUntil, [id]: at };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(readUntil));
  } catch {
    // Private mode: unread counts last until the page closes.
  }
  listeners.forEach((listener) => listener());
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

const fromOthers = (channel: ChatChannel, messages: DeliveryMessage[]) =>
  messages.filter((message) => message.sender !== channel.as);

/** Messages from the other side that this device has not seen in the open chat. */
export function useUnreadCount(channel: ChatChannel, messages: DeliveryMessage[]): number {
  const id = chatId(channel);
  const until = useSyncExternalStore(subscribe, () => readUntil[id]);
  return fromOthers(channel, messages).filter((message) => !until || message.createdAt > until).length;
}

/** The chat is on screen: everything in it counts as read. */
export function useMarkChatRead(channel: ChatChannel, messages: DeliveryMessage[], visible: boolean): void {
  const id = chatId(channel);
  const latest = messages.at(-1)?.createdAt;
  useEffect(() => {
    if (visible && latest) setReadUntil(id, latest);
  }, [id, latest, visible]);
}

/**
 * Sounds, vibrates and notifies when the other side writes. While the chat is
 * open and in view only a soft sound plays; otherwise there is an on-screen
 * notice too (and a phone notification when the page is in the background).
 * Messages already there when the page opened do not count as new.
 */
export function useChatNotifications({
  channel,
  enabled,
  chatVisible,
  title,
}: {
  channel: ChatChannel;
  enabled: boolean;
  chatVisible: boolean;
  title: string;
}): DeliveryMessage[] {
  const { enqueueSnackbar } = useSnackbar();
  const { data: messages = [], isSuccess } = useChatMessages(channel, enabled);
  const seen = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!isSuccess) return;
    if (seen.current === null) {
      seen.current = new Set(messages.map((message) => message.id));
      return;
    }
    const fresh = fromOthers(channel, messages).filter((message) => !seen.current!.has(message.id));
    messages.forEach((message) => seen.current!.add(message.id));
    if (fresh.length === 0) return;
    playChatMessageSound();
    if (chatVisible && document.visibilityState === 'visible') return;
    const last = fresh[fresh.length - 1];
    const who = last.sender === 'CUSTOMER' ? 'Cliente' : (last.senderName ?? (last.sender === 'COURIER' ? 'Domiciliario' : 'Restaurante'));
    enqueueSnackbar(`${who}: ${last.body}`, { variant: 'info', autoHideDuration: 6_000 });
    notify(title, `${who}: ${last.body}`, `chat-${chatId(channel)}`);
    // channel is described by its id; the rest are stable or read when needed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages, isSuccess]);

  return messages;
}

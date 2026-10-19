import { useEffect, useRef, useState, type FormEvent } from 'react';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { SendHorizontal } from 'lucide-react';
import { normalizeApiError } from '../../../lib/api/api-error';
import { deliveriesApi, type ChatChannel } from '../../../modules/deliveries/api/deliveries.api';
import type { DeliveryMessage, MessageSender } from '../../../modules/deliveries/types/delivery.types';
import { formatDateCO, formatTimeCO } from '../../../utils/format';
import { chatKey, useChatMessages, useMarkChatRead } from '../chat-state';

function senderLabel(message: DeliveryMessage): string {
  if (message.sender === 'CUSTOMER') return 'Cliente';
  if (message.sender === 'COURIER') return `${message.senderName ?? 'Domiciliario'} · domiciliario`;
  return `${message.senderName ?? 'Restaurante'} · restaurante`;
}

const SENDER_COLORS: Record<MessageSender, string> = {
  CUSTOMER: 'info.main',
  COURIER: 'success.main',
  STAFF: 'warning.main',
};

const dayOf = (iso: string) => new Date(iso).toDateString();

interface DeliveryChatProps {
  channel: ChatChannel;
  /** False once the delivery is over: the chat shows, but no one can write. */
  canWrite: boolean;
  /** One-tap messages shown above the box, e.g. "Ya voy en camino". */
  quickReplies?: string[];
  height?: number | string;
}

/**
 * The chat of a delivery, between the customer (public page), the courier
 * and the restaurant. It asks for new messages every few seconds and marks
 * what is on screen as read.
 */
export default function DeliveryChat({ channel, canWrite, quickReplies = [], height = 360 }: DeliveryChatProps) {
  const viewer: MessageSender = channel.as;
  const queryClient = useQueryClient();
  const { data: messages = [], isError, isLoading } = useChatMessages(channel);
  useMarkChatRead(channel, messages, true);
  const [draft, setDraft] = useState('');
  const send = useMutation({
    mutationFn: (body: string) => deliveriesApi.sendMessage(channel, body),
    onSuccess: (message) => {
      queryClient.setQueryData<DeliveryMessage[]>(chatKey(channel), (current = []) =>
        current.some((m) => m.id === message.id) ? current : [...current, message],
      );
      setDraft('');
    },
  });
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  function submit(event?: FormEvent) {
    event?.preventDefault();
    const body = draft.trim();
    if (body && !send.isPending) send.mutate(body);
  }

  return (
    <Stack sx={{ height, minHeight: 0 }}>
      <Box sx={{ flex: 1, overflowY: 'auto', px: 1.5, py: 1.5, display: 'flex', flexDirection: 'column', gap: 0.75 }}>
        {messages.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', mt: 4 }}>
            {isLoading ? 'Cargando…' : isError ? 'No se pudo cargar el chat.' : 'Todavía no hay mensajes. ¡Escribe el primero!'}
          </Typography>
        )}
        {messages.map((message, index) => {
          const mine = message.sender === viewer;
          const previous = messages[index - 1];
          const newDay = !previous || dayOf(previous.createdAt) !== dayOf(message.createdAt);
          // Consecutive messages of the same sender are grouped under one name.
          const showName = !mine && (newDay || previous?.sender !== message.sender);
          return (
            <Box key={message.id} sx={{ display: 'contents' }}>
              {newDay && (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center', my: 0.5 }}>
                  {formatDateCO(message.createdAt)}
                </Typography>
              )}
              <Box
                sx={{
                  alignSelf: mine ? 'flex-end' : 'flex-start',
                  maxWidth: '82%',
                  mt: showName ? 0.75 : 0,
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2.5,
                  borderTopRightRadius: mine ? 4 : undefined,
                  borderTopLeftRadius: mine ? undefined : 4,
                  bgcolor: mine ? 'primary.main' : 'action.selected',
                  color: mine ? 'primary.contrastText' : 'text.primary',
                }}
              >
                {showName && (
                  <Typography variant="caption" sx={{ fontWeight: 800, display: 'block', color: SENDER_COLORS[message.sender] }}>
                    {senderLabel(message)}
                  </Typography>
                )}
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {message.body}
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', opacity: 0.7, fontSize: 11 }}>
                  {formatTimeCO(message.createdAt)}
                </Typography>
              </Box>
            </Box>
          );
        })}
        <div ref={endRef} />
      </Box>
      {canWrite ? (
        <Box sx={{ borderTop: 1, borderColor: 'divider' }}>
          {quickReplies.length > 0 && (
            <Stack direction="row" spacing={0.75} sx={{ px: 1, pt: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
              {quickReplies.map((reply) => (
                <Chip
                  key={reply}
                  label={reply}
                  size="small"
                  variant="outlined"
                  disabled={send.isPending}
                  onClick={() => send.mutate(reply)}
                  sx={{ flexShrink: 0 }}
                />
              ))}
            </Stack>
          )}
          <Box component="form" onSubmit={submit} sx={{ display: 'flex', gap: 1, p: 1, alignItems: 'flex-end' }}>
            <TextField
              size="small"
              fullWidth
              multiline
              maxRows={4}
              placeholder="Escribe un mensaje"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                // Enter sends; Shift+Enter breaks the line.
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              error={send.isError}
              helperText={send.isError ? normalizeApiError(send.error).message : undefined}
            />
            <IconButton type="submit" color="primary" disabled={!draft.trim()} loading={send.isPending}>
              <SendHorizontal size={20} />
            </IconButton>
          </Box>
        </Box>
      ) : (
        <Typography variant="caption" color="text.secondary" sx={{ p: 1.5, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
          El domicilio terminó: el chat está cerrado.
        </Typography>
      )}
    </Stack>
  );
}

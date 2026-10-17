import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { expenseAttachmentKeys, expenseAttachmentsApi } from '../api/expense-attachments.api';
import { expenseKeys } from '../api/expenses.keys';

export function useExpenseAttachments(expenseId: string | null) {
  return useQuery({
    queryKey: expenseAttachmentKeys.list(expenseId ?? ''),
    queryFn: () => expenseAttachmentsApi.list(expenseId as string),
    enabled: Boolean(expenseId),
  });
}

/** Subir o quitar un comprobante cambia la lista del gasto y el conteo que muestra la tabla. */
function useAttachmentMutation<TVariables, TResult>(mutationFn: (variables: TVariables) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expense-attachments'] });
      queryClient.invalidateQueries({ queryKey: expenseKeys.all });
    },
  });
}

export function useUploadExpenseAttachments() {
  return useAttachmentMutation(async ({ expenseId, files }: { expenseId: string; files: File[] }) => {
    // Uno por uno: si alguno falla, los anteriores ya quedaron y se sabe cuál fue.
    const failed: string[] = [];
    for (const file of files) {
      try {
        await expenseAttachmentsApi.upload(expenseId, file);
      } catch {
        failed.push(file.name);
      }
    }
    return { failed };
  });
}

export function useRemoveExpenseAttachment() {
  return useAttachmentMutation(({ expenseId, id }: { expenseId: string; id: string }) =>
    expenseAttachmentsApi.remove(expenseId, id),
  );
}

/** El archivo pide la sesión, así que no basta un enlace: se descarga y se abre desde la memoria. */
export function useViewExpenseAttachment() {
  return useMutation({
    mutationFn: async ({ expenseId, id }: { expenseId: string; id: string }) => {
      const blob = await expenseAttachmentsApi.getFileBlob(expenseId, id);
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank', 'noopener,noreferrer');
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    },
  });
}

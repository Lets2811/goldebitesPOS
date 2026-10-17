import { useRef } from 'react';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { ExternalLink, FileText, ImageIcon, Paperclip, Trash2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import LoadingSkeleton from '../../../components/common/LoadingSkeleton';
import { Can } from '../../../modules/auth/components/can';
import {
  ACCEPTED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  formatFileSize,
} from '../../../modules/finances/api/expense-attachments.api';
import {
  useExpenseAttachments,
  useRemoveExpenseAttachment,
  useUploadExpenseAttachments,
  useViewExpenseAttachment,
} from '../../../modules/finances/hooks/use-expense-attachments';
import type { Expense } from '../../../modules/finances/types/expense.types';

interface ExpenseAttachmentsDialogProps {
  expense: Expense | null;
  onClose: () => void;
}

/** Los comprobantes de una compra: verlos, agregar más o quitar uno equivocado. */
export default function ExpenseAttachmentsDialog({ expense, onClose }: ExpenseAttachmentsDialogProps) {
  const { enqueueSnackbar } = useSnackbar();
  const expenseId = expense?.id ?? null;
  const { data: attachments, isLoading } = useExpenseAttachments(expenseId);
  const upload = useUploadExpenseAttachments();
  const remove = useRemoveExpenseAttachment();
  const view = useViewExpenseAttachment();
  const fileInput = useRef<HTMLInputElement>(null);

  const addFiles = (list: FileList | null) => {
    if (!expenseId || !list) return;
    const files = Array.from(list);
    const valid = files.filter((f) => ACCEPTED_ATTACHMENT_TYPES.split(',').includes(f.type) && f.size <= MAX_ATTACHMENT_BYTES);
    if (valid.length < files.length) {
      enqueueSnackbar('Algunos archivos no se subieron: solo PDF o imágenes de hasta 10 MB.', { variant: 'warning' });
    }
    if (valid.length === 0) return;
    upload.mutate(
      { expenseId, files: valid },
      {
        onSuccess: ({ failed }) =>
          failed.length > 0
            ? enqueueSnackbar(`No se pudo subir: ${failed.join(', ')}`, { variant: 'error' })
            : enqueueSnackbar('Comprobante agregado', { variant: 'success' }),
      },
    );
  };

  return (
    <Dialog open={Boolean(expense)} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Comprobantes · {expense?.name ?? expense?.description}</DialogTitle>
      <DialogContent>
        {isLoading ? (
          <LoadingSkeleton variant="list" />
        ) : (attachments ?? []).length === 0 ? (
          <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', py: 1 }}>
            Esta compra no tiene comprobantes.
          </Typography>
        ) : (
          <Stack spacing={1}>
            {(attachments ?? []).map((attachment) => (
              <Stack
                key={attachment.id}
                direction="row"
                spacing={1.5}
                sx={{ alignItems: 'center', px: 1.5, py: 1, border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
              >
                {attachment.mimeType === 'application/pdf' ? <FileText size={18} /> : <ImageIcon size={18} />}
                <Typography variant="body2" noWrap sx={{ flex: 1, minWidth: 0 }}>
                  {attachment.fileName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(attachment.sizeBytes)}
                </Typography>
                <Tooltip title="Abrir">
                  <IconButton
                    size="small"
                    aria-label={`Abrir ${attachment.fileName}`}
                    onClick={() =>
                      view.mutate(
                        { expenseId: attachment.expenseId, id: attachment.id },
                        { onError: () => enqueueSnackbar('No se pudo abrir el archivo', { variant: 'error' }) },
                      )
                    }
                  >
                    <ExternalLink size={15} />
                  </IconButton>
                </Tooltip>
                <Can permission="finances.manage">
                  <Tooltip title="Quitar">
                    <IconButton
                      size="small"
                      aria-label={`Quitar ${attachment.fileName}`}
                      disabled={remove.isPending}
                      onClick={() => remove.mutate({ expenseId: attachment.expenseId, id: attachment.id })}
                    >
                      <Trash2 size={15} />
                    </IconButton>
                  </Tooltip>
                </Can>
              </Stack>
            ))}
          </Stack>
        )}
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_ATTACHMENT_TYPES}
          multiple
          hidden
          onChange={(e) => {
            addFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </DialogContent>
      <DialogActions>
        <Can permission="finances.manage">
          <Button
            startIcon={<Paperclip size={15} />}
            loading={upload.isPending}
            onClick={() => fileInput.current?.click()}
            sx={{ mr: 'auto' }}
          >
            Agregar comprobante
          </Button>
        </Can>
        <Button onClick={onClose}>Cerrar</Button>
      </DialogActions>
    </Dialog>
  );
}

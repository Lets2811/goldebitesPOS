import { useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Collapse from '@mui/material/Collapse';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { Code2, Download, Eye, FileUp, HelpCircle, Trash2 } from 'lucide-react';
import { useSnackbar } from 'notistack';
import StatusChip from '../../../components/common/StatusChip';
import { apiClient } from '../../../lib/api/api-client';
import type { ApiResponse } from '../../../lib/api/api-types';
import { normalizeApiError } from '../../../lib/api/api-error';
import { useAuthStore } from '../../../modules/auth/store/auth.store';
import { useCurrentBusiness } from '../../../modules/businesses/hooks/use-current-business';
import type { Business } from '../../../modules/businesses/types/business.types';
import { usePublicMenu } from '../../../modules/public-menu/hooks/use-public-menu';
import { brand } from '../../../theme/palette';
import ComboTemplateStudio from './ComboTemplateStudio';
import {
  COMBO_TEMPLATE_EXAMPLE,
  COMBO_TEMPLATE_GUIDE,
} from '../../public-menu/combo-template/combo-template-example';

const MAX_TEMPLATE_BYTES = 200_000;
const templateKey = ['businesses', 'me', 'combo-template'] as const;

function download(name: string, html: string) {
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * The business's own look for "Arma tu combo": an HTML/CSS template with
 * markers, uploaded here, previewed with the real products before saving.
 * Without one, customers see the default view.
 */
export default function ComboTemplateCard({
  canEdit,
  openEditorRequest = 0,
}: {
  canEdit: boolean;
  /** Bumped from elsewhere (the live preview) to open the editor. */
  openEditorRequest?: number;
}) {
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const { data: business } = useCurrentBusiness();
  const branchId = useAuthStore((s) => s.user?.branchId ?? undefined);
  const hasTemplate = business?.hasComboBuilderTemplate ?? false;
  const { data: current } = useQuery({
    queryKey: templateKey,
    queryFn: async () =>
      (
        await apiClient.get<ApiResponse<{ html: string | null }>>(
          '/businesses/me/combo-builder/template',
        )
      ).data.data.html,
    enabled: hasTemplate,
  });
  const save = useMutation({
    mutationFn: async (html: string | null) =>
      (
        await apiClient.put<ApiResponse<Business>>('/businesses/me/combo-builder/template', {
          html,
        })
      ).data.data,
    onSuccess: (updated, html) => {
      queryClient.setQueryData(['businesses', 'me'], updated);
      queryClient.setQueryData(templateKey, html);
      queryClient.invalidateQueries({ queryKey: ['public-menu'] });
    },
  });
  const { data: menu } = usePublicMenu(business?.id, branchId);

  const fileRef = useRef<HTMLInputElement>(null);
  /** The template shown in the preview: one just uploaded (not saved yet), or the saved one. */
  /** What the editor opened with: the saved template, an uploaded file or the example. */
  const [studioHtml, setStudioHtml] = useState<string | null>(null);
  const [seenRequest, setSeenRequest] = useState(openEditorRequest);
  if (openEditorRequest !== seenRequest) {
    setSeenRequest(openEditorRequest);
    setStudioHtml(hasTemplate ? (current ?? '') : COMBO_TEMPLATE_EXAMPLE);
  }
  const [guideOpen, setGuideOpen] = useState(false);

  const onFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > MAX_TEMPLATE_BYTES) {
      enqueueSnackbar('La plantilla es muy grande (máximo 200 KB). Pon las imágenes por URL.', {
        variant: 'error',
      });
      return;
    }
    setStudioHtml(await file.text());
  };

  const persist = (html: string | null, done: string) =>
    save.mutate(html, {
      onSuccess: () => {
        enqueueSnackbar(done, { variant: 'success' });
        setStudioHtml(null);
      },
      onError: (error) => enqueueSnackbar(normalizeApiError(error).message, { variant: 'error' }),
    });

  return (
    <Card variant="outlined" sx={{ p: 2 }}>
      <Stack
        direction="row"
        spacing={1}
        sx={{ alignItems: 'center', mb: 0.5, flexWrap: 'wrap', rowGap: 1 }}
      >
        <Code2 size={17} color={brand.gold} />
        <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
          Diseño propio (plantilla HTML)
        </Typography>
        <StatusChip
          label={hasTemplate ? 'Plantilla propia' : 'Vista por defecto'}
          tone={hasTemplate ? 'gold' : 'neutral'}
        />
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
        Sube un archivo .html con tu diseño y los marcadores donde van los productos. El carrito,
        las opciones de cada producto y el botón «Agregar combo» los pone el sistema. Sin plantilla
        se usa la vista por defecto.
      </Typography>

      <input ref={fileRef} type="file" accept=".html,.htm,text/html" hidden onChange={onFile} />
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {canEdit && (
          <Button
            size="small"
            variant="contained"
            startIcon={<FileUp size={15} />}
            onClick={() => fileRef.current?.click()}
          >
            {hasTemplate ? 'Reemplazar con un archivo' : 'Subir plantilla'}
          </Button>
        )}
        {!hasTemplate && canEdit && (
          <Button
            size="small"
            startIcon={<Eye size={15} />}
            onClick={() => setStudioHtml(COMBO_TEMPLATE_EXAMPLE)}
          >
            Empezar desde el ejemplo
          </Button>
        )}
        {hasTemplate && current && (
          <>
            <Button
              size="small"
              variant="outlined"
              startIcon={<Eye size={15} />}
              onClick={() => setStudioHtml(current)}
            >
              {canEdit ? 'Editar y ver' : 'Vista previa'}
            </Button>
            <Button
              size="small"
              startIcon={<Download size={15} />}
              onClick={() => download('arma-tu-combo.html', current)}
            >
              Descargar la actual
            </Button>
          </>
        )}
        <Button
          size="small"
          startIcon={<Download size={15} />}
          onClick={() => download('plantilla-ejemplo-arma-tu-combo.html', COMBO_TEMPLATE_EXAMPLE)}
        >
          Descargar ejemplo
        </Button>
        <Button
          size="small"
          startIcon={<HelpCircle size={15} />}
          onClick={() => setGuideOpen((open) => !open)}
        >
          Marcadores
        </Button>
        {canEdit && hasTemplate && (
          <Button
            size="small"
            color="error"
            startIcon={<Trash2 size={15} />}
            loading={save.isPending}
            onClick={() => persist(null, 'Volvió a la vista por defecto')}
          >
            Usar la vista por defecto
          </Button>
        )}
      </Stack>

      <Collapse in={guideOpen}>
        <Stack spacing={1} sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover' }}>
          {COMBO_TEMPLATE_GUIDE.map((row) => (
            <Box key={row.marker}>
              <Typography variant="body2" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {row.marker}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {row.meaning}
              </Typography>
            </Box>
          ))}
          <Typography variant="caption" color="text.secondary">
            La plantilla se muestra aislada: puede usar CSS, fuentes e imágenes por URL y su propio
            JavaScript, pero no puede conectarse a otros servidores ni acceder a la sesión del
            cliente.
          </Typography>
        </Stack>
      </Collapse>

      <ComboTemplateStudio
        open={studioHtml !== null}
        initialHtml={studioHtml ?? ''}
        savedHtml={hasTemplate ? (current ?? null) : null}
        menu={menu}
        canEdit={canEdit}
        saving={save.isPending}
        onSave={(html) => persist(html, 'Plantilla guardada: así lo verán tus clientes')}
        onDownload={(html) => download('arma-tu-combo.html', html)}
        onClose={() => setStudioHtml(null)}
      />
    </Card>
  );
}

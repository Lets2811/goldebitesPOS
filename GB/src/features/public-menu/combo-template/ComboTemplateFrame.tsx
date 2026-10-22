import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import {
  buildComboTemplateDocument,
  type ComboTemplateData,
  type ComboTemplateOptions,
  type ComboTemplateState,
} from './combo-template-runtime';

interface ComboTemplateFrameProps {
  /** The business's HTML/CSS template. */
  template: string;
  data: ComboTemplateData;
  state: ComboTemplateState;
  onPick: (productId: string) => void;
  onRemove: (productId: string) => void;
  /** A product's options to choose inside the template; a new `seq` shows them. */
  optionsRequest?: { seq: number; options: ComboTemplateOptions } | null;
  /** What the customer chose there (checked by the caller before adding). */
  onChoose?: (productId: string, optionItemIds: string[], noneGroupIds: string[]) => void;
}

interface FrameMessage {
  source?: string;
  type?: string;
  productId?: unknown;
  height?: unknown;
  optionItemIds?: unknown;
  noneGroupIds?: unknown;
}

const isStringList = (value: unknown): value is string[] =>
  Array.isArray(value) && value.length <= 100 && value.every((item) => typeof item === 'string');

/**
 * A business's "Arma tu combo" template, isolated: a sandboxed iframe (only
 * scripts, an opaque origin) that cannot touch the app, its storage or the
 * customer's session. It gets the products by message and asks for picks the
 * same way; a pick is honored only for a product that is in the combo.
 */
export default function ComboTemplateFrame({
  template,
  data,
  state,
  onPick,
  onRemove,
  optionsRequest,
  onChoose,
}: ComboTemplateFrameProps) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [height, setHeight] = useState(480);
  const [ready, setReady] = useState(false);
  const srcDoc = useMemo(() => buildComboTemplateDocument(template), [template]);
  const productIds = useMemo(
    () =>
      new Set(data.secciones.flatMap((section) => section.productos.map((product) => product.id))),
    [data],
  );

  // The latest handlers, so the listener below never sees stale ones.
  const handlers = useRef({ onPick, onRemove, onChoose, productIds });
  useEffect(() => {
    handlers.current = { onPick, onRemove, onChoose, productIds };
  });

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (!frameRef.current || event.source !== frameRef.current.contentWindow) return;
      const message = event.data as FrameMessage | null;
      if (!message || message.source !== 'gb-combo') return;
      const {
        onPick: pick,
        onRemove: remove,
        onChoose: choose,
        productIds: known,
      } = handlers.current;
      if (message.type === 'ready') {
        setReady(true);
      } else if (message.type === 'height' && typeof message.height === 'number') {
        setHeight(Math.min(Math.max(message.height, 200), 20000));
      } else if (typeof message.productId === 'string' && known.has(message.productId)) {
        if (message.type === 'pick') pick(message.productId);
        if (message.type === 'remove') remove(message.productId);
        if (
          message.type === 'choose' &&
          isStringList(message.optionItemIds) &&
          isStringList(message.noneGroupIds)
        ) {
          choose?.(message.productId, message.optionItemIds, message.noneGroupIds);
        }
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // A new template is a new document: it says when it is ready again.
  const [shownDoc, setShownDoc] = useState(srcDoc);
  if (shownDoc !== srcDoc) {
    setShownDoc(srcDoc);
    setReady(false);
  }

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage({ source: 'gb-parent', type: 'data', data }, '*');
  }, [ready, data]);

  useEffect(() => {
    if (!ready) return;
    frameRef.current?.contentWindow?.postMessage(
      { source: 'gb-parent', type: 'state', state },
      '*',
    );
  }, [ready, state]);

  useEffect(() => {
    if (!ready || !optionsRequest) return;
    frameRef.current?.contentWindow?.postMessage(
      { source: 'gb-parent', type: 'options', options: optionsRequest.options },
      '*',
    );
  }, [ready, optionsRequest]);

  return (
    <Box
      component="iframe"
      ref={frameRef}
      title={data.combo.nombre}
      srcDoc={srcDoc}
      sandbox="allow-scripts"
      referrerPolicy="no-referrer"
      sx={{ width: '100%', height, border: 0, display: 'block', bgcolor: 'transparent' }}
    />
  );
}

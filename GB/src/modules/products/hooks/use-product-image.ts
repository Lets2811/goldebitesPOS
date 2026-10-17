import { useMutation, useQueryClient } from '@tanstack/react-query';
import { productsApi } from '../api/products.api';
import { productKeys } from '../api/products.keys';
import type { Product } from '../types/product.types';

function useRefreshProduct() {
  const queryClient = useQueryClient();
  return (product: Product) => {
    queryClient.invalidateQueries({ queryKey: productKeys.lists() });
    queryClient.invalidateQueries({ queryKey: productKeys.detail(product.id) });
  };
}

export function useUploadProductImage() {
  const refresh = useRefreshProduct();
  return useMutation({
    mutationFn: ({ id, file }: { id: string; file: File }) => productsApi.uploadImage(id, file),
    onSuccess: refresh,
  });
}

export function useRemoveProductImage() {
  const refresh = useRefreshProduct();
  return useMutation({
    mutationFn: (id: string) => productsApi.removeImage(id),
    onSuccess: refresh,
  });
}

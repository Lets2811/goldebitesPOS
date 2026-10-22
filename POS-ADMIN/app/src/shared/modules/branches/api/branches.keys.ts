export const branchesKeys = {
  all: ['branches'] as const,
  detail: (id: string) => [...branchesKeys.all, 'detail', id] as const,
};

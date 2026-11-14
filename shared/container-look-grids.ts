import type { ContainerGridDimensions } from './containers.ts';

/**
 * Loot grids for single looks (sprite styles), keyed by look id such as `drawer_v2` or `police`. A look listed
 * here uses its own grid; any other look uses its kind's grid (CONTAINER_GRID_SIZE). Written by the Dev bench's
 * Save (tools/vite-dev-sync.ts); hand edits are kept only until the next save.
 */
export const CONTAINER_LOOK_GRID_SIZE: Readonly<Record<string, ContainerGridDimensions>> = {
};

import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';

interface FootprintUpdate {
  readonly width: number;
  readonly height: number;
}

interface ContainerDimensionsUpdate {
  readonly cols: number;
  readonly rows: number;
  readonly blocked?: readonly { readonly x: number; readonly y: number }[];
}

interface DevInventorySavePayload {
  readonly target: 'items' | 'containers';
  readonly footprints?: Record<string, FootprintUpdate>;
  readonly containerSizes?: Record<string, ContainerDimensionsUpdate>;
}

function parseJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(body) as T);
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', (err) => reject(err));
  });
}

function updateItemFootprintsFile(projectRoot: string, footprints: Record<string, FootprintUpdate>): boolean {
  const filePath = path.resolve(projectRoot, 'shared/grid-inventory.ts');
  const source = readFileSync(filePath, 'utf8');

  const startMarker = 'export const ITEM_FOOTPRINTS: Record<string, GridFootprint> = {';
  const endMarker = '};';

  const startIndex = source.indexOf(startMarker);
  const isStartMissing = startIndex === -1;
  if (isStartMissing) return false;

  const afterStart = source.slice(startIndex + startMarker.length);
  const relativeEndIndex = afterStart.indexOf(endMarker);
  const isEndMissing = relativeEndIndex === -1;
  if (isEndMissing) return false;

  const endIndex = startIndex + startMarker.length + relativeEndIndex;

  const keys = Object.keys(footprints).sort();
  const lines: string[] = [''];
  for (const key of keys) {
    const { width, height } = footprints[key];
    lines.push(`  ${key}: { width: ${width}, height: ${height} },`);
  }

  const replacementBlock = lines.join('\n') + '\n';
  const updatedSource = source.slice(0, startIndex + startMarker.length) + replacementBlock + source.slice(endIndex);

  writeFileSync(filePath, updatedSource, 'utf8');
  return true;
}

function updateContainerGridSizeFile(projectRoot: string, sizes: Record<string, ContainerDimensionsUpdate>): boolean {
  const filePath = path.resolve(projectRoot, 'shared/containers.ts');
  const source = readFileSync(filePath, 'utf8');

  const startMarker = 'export const CONTAINER_GRID_SIZE: Partial<Record<ContainerKind, ContainerGridDimensions>> = {';
  const endMarker = '};';

  const startIndex = source.indexOf(startMarker);
  const isStartMissing = startIndex === -1;
  if (isStartMissing) return false;

  const afterStart = source.slice(startIndex + startMarker.length);
  const relativeEndIndex = afterStart.indexOf(endMarker);
  const isEndMissing = relativeEndIndex === -1;
  if (isEndMissing) return false;

  const endIndex = startIndex + startMarker.length + relativeEndIndex;

  const keys = Object.keys(sizes).sort();
  const lines: string[] = [''];
  for (const key of keys) {
    const { cols, rows, blocked } = sizes[key];
    const hasBlocked = blocked && blocked.length > 0;
    const blockedStr = hasBlocked
      ? `, blocked: [${[...blocked].sort((a, b) => a.y - b.y || a.x - b.x).map((p) => `{ x: ${p.x}, y: ${p.y} }`).join(', ')}]`
      : '';
    lines.push(`  ${key}: { cols: ${cols}, rows: ${rows}${blockedStr} },`);
  }

  const replacementBlock = lines.join('\n') + '\n';
  const updatedSource = source.slice(0, startIndex + startMarker.length) + replacementBlock + source.slice(endIndex);

  writeFileSync(filePath, updatedSource, 'utf8');
  return true;
}

export function devInventorySync(projectRoot: string): Plugin {
  return {
    name: 'uon-dev-inventory-sync',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const isPost = req.method === 'POST';
        const isApiRoute = req.url === '/api/dev/inventory-sync';
        const isTargetEndpoint = isPost && isApiRoute;

        if (!isTargetEndpoint) {
          next();
          return;
        }

        try {
          const payload = await parseJsonBody<DevInventorySavePayload>(req);

          if (payload.target === 'items' && payload.footprints) {
            const success = updateItemFootprintsFile(projectRoot, payload.footprints);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success, target: 'items' }));
            return;
          }

          if (payload.target === 'containers' && payload.containerSizes) {
            const success = updateContainerGridSizeFile(projectRoot, payload.containerSizes);
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ success, target: 'containers' }));
            return;
          }

          res.statusCode = 400;
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ error: 'Invalid payload target or missing data' }));
        } catch (err: unknown) {
          res.statusCode = 500;
          res.setHeader('Content-Type', 'application/json');
          const message = err instanceof Error ? err.message : String(err);
          res.end(JSON.stringify({ error: message }));
        }
      });
    },
  };
}

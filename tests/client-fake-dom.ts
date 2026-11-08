import { vi } from 'vitest';

/** Just enough browser for the renderer and controller to run under Node. */

export interface FakeCanvas {
  width: number;
  height: number;
  style: Record<string, string>;
  getContext(): FakeContext;
  getBoundingClientRect(): { left: number; top: number };
  toDataURL(): string;
}

export interface FakeContext {
  canvas: FakeCanvas;
  drawImageCalls: number;
  [key: string]: unknown;
}

function isFakeCanvas(value: unknown): value is FakeCanvas {
  return typeof value === 'object' && value !== null && 'getContext' in value;
}

function fakeContext(canvas: FakeCanvas): FakeContext {
  const target: FakeContext = {
    canvas,
    drawImageCalls: 0,
    globalAlpha: 1,
    globalCompositeOperation: 'source-over',
    fillStyle: '#000',
    imageSmoothingEnabled: true,
    createRadialGradient: () => ({ addColorStop() {} }),
    createImageData: (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    getImageData: (_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    }),
    drawImage(source: unknown, ...coords: number[]) {
      target.drawImageCalls += 1;
      if (!isFakeCanvas(source)) throw new Error('drawImage source is not a canvas');
      for (const value of coords) {
        if (!Number.isInteger(value)) throw new Error(`drawImage at a non-integer coordinate: ${coords.join(', ')}`);
      }
    },
    fillRect(...coords: number[]) {
      for (const value of coords) {
        if (!Number.isFinite(value)) throw new Error(`fillRect with a bad coordinate: ${coords.join(', ')}`);
      }
    },
  };
  return new Proxy(target, {
    get: (object, key) => (key in object ? object[key as string] : () => {}),
    set: (object, key, value) => {
      object[key as string] = value;
      return true;
    },
  });
}

export function fakeCanvas(): FakeCanvas {
  const canvas: FakeCanvas = {
    width: 300,
    height: 150,
    style: {},
    getContext: () => context,
    getBoundingClientRect: () => ({ left: 0, top: 0 }),
    toDataURL: () => 'data:image/png;base64,',
  };
  const context = fakeContext(canvas);
  return canvas;
}

type Listener = (event: never) => void;

export interface FakeBrowser {
  readonly listeners: Map<string, Set<Listener>>;
  /** The next animation frame callback, run with the given timestamp. */
  runFrame(ms: number): void;
  dispatch(type: string, event: object): void;
}

function makeTarget(listeners: Map<string, Set<Listener>>) {
  return {
    addEventListener(type: string, listener: Listener) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(listener);
    },
    removeEventListener(type: string, listener: Listener) {
      listeners.get(type)?.delete(listener);
    },
  };
}

export function installFakeBrowser(): FakeBrowser {
  const listeners = new Map<string, Set<Listener>>();
  let pendingFrame: ((ms: number) => void) | null = null;

  class FakeImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number;
    readonly height: number;

    constructor(data: Uint8ClampedArray, width: number, height: number) {
      this.data = data;
      this.width = width;
      this.height = height;
    }
  }

  vi.stubGlobal('ImageData', FakeImageData);
  vi.stubGlobal('HTMLInputElement', class {});
  vi.stubGlobal('HTMLTextAreaElement', class {});
  vi.stubGlobal('HTMLButtonElement', class {});
  vi.stubGlobal('requestAnimationFrame', (callback: (ms: number) => void) => {
    pendingFrame = callback;
    return 1;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    pendingFrame = null;
  });
  vi.stubGlobal('document', {
    hidden: false,
    createElement: () => fakeCanvas(),
    // The run writes the UI unit and the survivor's spot here (view-fit.ts, player-anchor.ts).
    documentElement: { style: { setProperty() {}, removeProperty() {} }, dataset: {} },
    ...makeTarget(new Map()),
  });
  vi.stubGlobal('window', {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 1,
    location: { hostname: 'localhost', protocol: 'http:' },
    matchMedia: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
    ...makeTarget(listeners),
  });

  return {
    listeners,
    runFrame(ms) {
      const callback = pendingFrame;
      pendingFrame = null;
      callback?.(ms);
    },
    dispatch(type, event) {
      for (const listener of listeners.get(type) ?? []) listener(event as never);
    },
  };
}

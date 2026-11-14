import type { LightBands } from './light-dither.ts';
import type { LightField } from './light-field.ts';

// The lightmap's quantise-and-dither pass, moved to the GPU. The CPU still adds the lamps and beams into
// float cells (LightField); this shader does the per-pixel work LightField.write does on the CPU: pick the
// two levels of each cell's hue, then stipple between them with the 4x4 Bayer matrix. The arithmetic
// mirrors light-field.ts, so the picture matches it up to float rounding.

const VERTEX = `#version 300 es
void main() {
  // One oversized triangle covers the whole canvas; no vertex buffer is needed.
  vec2 corner = vec2(float((gl_VertexID << 1) & 2), float(gl_VertexID & 2));
  gl_Position = vec4(corner * 2.0 - 1.0, 0.0, 1.0);
}`;

const FRAGMENT = `#version 300 es
precision highp float;
precision highp int;
uniform highp sampler2D uCells;
uniform sampler2D uLevels;
uniform ivec2 uOffset;
uniform ivec2 uOrigin;
uniform int uHeight;
out vec4 outColor;

const int BAYER[16] = int[16](0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5);
const float DITHER_STEPS = 16.0;

void main() {
  int px = int(gl_FragCoord.x);
  int py = uHeight - 1 - int(gl_FragCoord.y);
  ivec2 cell = ivec2((px + uOffset.x) >> 1, (py + uOffset.y) >> 1);
  vec3 light = texelFetch(uCells, cell, 0).rgb;

  float peak = max(max(light.r, light.g), max(light.b, 0.001));
  float value = min(peak, 255.0);
  vec2 levels = floor(texelFetch(uLevels, ivec2(int(value), 0), 0).rg * 255.0 + 0.5);
  float low = levels.x;
  float high = levels.y;
  vec3 lowColor = floor(light * (low / peak));
  vec3 highColor = floor(light * (high / peak));
  float steps = floor(((value - low) / (high - low)) * DITHER_STEPS + 0.5);

  int bayer = (((py + uOrigin.y) & 3) << 2) | ((px + uOrigin.x) & 3);
  bool useHigh = float(BAYER[bayer]) < steps;
  outColor = vec4((useHigh ? highColor : lowColor) / 255.0, 1.0);
}`;

/** A texture with no mipmaps and no filtering. The default filter would leave it incomplete and read as black. */
function plainTexture(gl: WebGL2RenderingContext): WebGLTexture | null {
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return texture;
}

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  const ok = gl.getShaderParameter(shader, gl.COMPILE_STATUS) as boolean;
  if (ok) return shader;
  gl.deleteShader(shader);
  return null;
}

export interface LightGlFrame {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** Draws a LightField's quantised lightmap through WebGL2 onto its own canvas. */
export class LightGl {
  private program: WebGLProgram | null = null;
  private cellsTexture: WebGLTexture | null = null;
  private levelsTexture: WebGLTexture | null = null;
  private cellData = new Float32Array(0);
  private cellCols = 0;
  private cellRows = 0;
  private uploadedLevels: LightBands | null = null;
  private lost = false;

  private constructor(private readonly canvas: HTMLCanvasElement, private readonly gl: WebGL2RenderingContext) {
    canvas.addEventListener('webglcontextlost', this.onLost);
    canvas.addEventListener('webglcontextrestored', this.onRestored);
    this.setUp();
  }

  /** The GPU lightmap, or null where WebGL2 is missing or the shader will not build. */
  static create(canvas: HTMLCanvasElement): LightGl | null {
    const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, depth: false, stencil: false }) as WebGL2RenderingContext | null;
    // instanceof, not duck typing: a 2D context must never be taken for WebGL.
    const isWebGl2 = typeof WebGL2RenderingContext !== 'undefined' && gl instanceof WebGL2RenderingContext;
    if (!isWebGl2) return null;
    const light = new LightGl(canvas, gl);
    if (light.program) return light;
    light.dispose();
    return null;
  }

  private setUp(): void {
    const gl = this.gl;
    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX);
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT);
    if (!vertex || !fragment) return;
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vertex);
    gl.attachShader(program, fragment);
    gl.linkProgram(program);
    gl.deleteShader(vertex);
    gl.deleteShader(fragment);
    const linked = gl.getProgramParameter(program, gl.LINK_STATUS) as boolean;
    if (!linked) {
      gl.deleteProgram(program);
      return;
    }
    this.program = program;
    this.cellsTexture = plainTexture(gl);
    this.levelsTexture = plainTexture(gl);
    this.uploadedLevels = null;
    this.cellCols = 0;
    this.cellRows = 0;
  }

  private readonly onLost = (event: Event): void => {
    event.preventDefault();
    this.lost = true;
  };

  private readonly onRestored = (): void => {
    this.lost = false;
    this.program = null;
    this.setUp();
  };

  /** Quantises the field's light into the canvas. Does nothing while the context is lost. */
  draw(field: LightField, frame: LightGlFrame): void {
    const gl = this.gl;
    if (this.lost || !this.program) return;
    const { width, height } = frame;
    if (this.canvas.width !== width) this.canvas.width = width;
    if (this.canvas.height !== height) this.canvas.height = height;
    const cols = field.cellCols;
    const rows = field.cellRows;
    const cells = cols * rows;
    if (this.cellData.length !== cells * 4) this.cellData = new Float32Array(cells * 4);
    field.packCells(this.cellData);

    gl.useProgram(this.program);
    gl.bindVertexArray(null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.cellsTexture);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    // Cells are read with texelFetch, so no filtering: the size changes only with the view.
    if (cols !== this.cellCols || rows !== this.cellRows) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, cols, rows, 0, gl.RGBA, gl.FLOAT, this.cellData);
      this.cellCols = cols;
      this.cellRows = rows;
    } else {
      gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, cols, rows, gl.RGBA, gl.FLOAT, this.cellData);
    }
    gl.uniform1i(gl.getUniformLocation(this.program, 'uCells'), 0);

    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.levelsTexture);
    const levels = field.levels;
    if (levels !== this.uploadedLevels) {
      const pairs = new Uint8Array(256 * 2);
      for (let i = 0; i < 256; i += 1) {
        pairs[i * 2] = levels.low[i];
        pairs[i * 2 + 1] = levels.high[i];
      }
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG8, 256, 1, 0, gl.RG, gl.UNSIGNED_BYTE, pairs);
      this.uploadedLevels = levels;
    }
    gl.uniform1i(gl.getUniformLocation(this.program, 'uLevels'), 1);

    gl.uniform2i(gl.getUniformLocation(this.program, 'uOffset'), frame.left & 1, frame.top & 1);
    gl.uniform2i(gl.getUniformLocation(this.program, 'uOrigin'), frame.left, frame.top);
    gl.uniform1i(gl.getUniformLocation(this.program, 'uHeight'), height);

    gl.viewport(0, 0, width, height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private dispose(): void {
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
  }
}

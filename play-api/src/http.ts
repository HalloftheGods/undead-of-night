import { LOBBY_BODY_MAX_BYTES } from '../../shared/lobby/lobby-http.ts';

/** A Lobby answer the Worker turns into a Response. Plain data, so it crosses DO RPC. */
export interface Reply {
  readonly status: number;
  readonly body: unknown;
}

export const reply = (status: number, body: unknown): Reply => ({ status, body });
export const refusal = (status: number, error: string): Reply => ({ status, body: { error } });

export function toResponse(answer: Reply, headers: HeadersInit = {}): Response {
  return Response.json(answer.body, { status: answer.status, headers });
}

/** The parsed JSON body, or undefined when it is missing, too big or not JSON. */
export async function readJson(request: Request): Promise<unknown> {
  const declared = Number(request.headers.get('content-length') ?? 0);
  const isDeclaredTooBig = declared > LOBBY_BODY_MAX_BYTES;
  if (isDeclaredTooBig) return undefined;
  const text = await request.text();
  const isEmptyOrTooBig = !text || new TextEncoder().encode(text).length > LOBBY_BODY_MAX_BYTES;
  if (isEmptyOrTooBig) return undefined;
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

/**
 * A browser cannot read the status of a refused upgrade, only a close code. So a refusal
 * accepts the socket and closes it at once with the code the client knows how to explain.
 */
export function closedSocket(code: number, reason = ''): Response {
  const pair = new WebSocketPair();
  pair[1].accept();
  pair[1].close(code, reason);
  return new Response(null, { status: 101, webSocket: pair[0] });
}

/** A socket close the runtime will accept back: 1005 and 1006 are reserved for "no code". */
export const echoable = (code: number): number => (code === 1005 || code === 1006 || code < 1000 ? 1000 : code);

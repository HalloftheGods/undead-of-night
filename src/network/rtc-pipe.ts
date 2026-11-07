// A guest's pipe to a host tab: the Room DO's signal socket carries the offer, answer and ICE, then one
// negotiated, ordered, reliable data channel carries the game packets, the same semantics as a WebSocket.
import { CLOSE } from '../../shared/close-codes.ts';
import { parseToGuestSignal, type GuestSignal, type IceCandidate, type IceServer } from '../../shared/lobby/lobby-protocol.ts';
import { PROTOCOL_VERSION } from '../../shared/protocol.ts';
import { DROPPED, type PacketPipe, type PipeHandlers } from './packet-pipe.ts';
import { socketUrl } from './play-api.ts';

/** The one game channel, set up the same way on both ends so no in-band negotiation is needed. */
export const GAME_CHANNEL: RTCDataChannelInit = { negotiated: true, id: 0, ordered: true };

export function rtcConfig(iceServers: readonly IceServer[], relayOnly: boolean): RTCConfiguration {
  return {
    iceServers: iceServers.map((server) => ({ ...server, urls: typeof server.urls === 'string' ? server.urls : [...server.urls] })),
    // Public rooms are relay only, so strangers see Cloudflare's addresses instead of each other's.
    iceTransportPolicy: relayOnly ? 'relay' : 'all',
  };
}

export const candidateOf = (event: RTCPeerConnectionIceEvent): IceCandidate | null =>
  event.candidate?.candidate ? { candidate: event.candidate.candidate, sdpMid: event.candidate.sdpMid, sdpMLineIndex: event.candidate.sdpMLineIndex } : null;

/** What a pipe builds its sockets and connections with, so a test can hand in fakes. */
export interface RtcDeps {
  readonly socket: (url: string) => WebSocket;
  readonly peer: (config: RTCConfiguration) => RTCPeerConnection;
}

export const browserRtc: RtcDeps = {
  socket: (url) => new WebSocket(url),
  peer: (config) => new RTCPeerConnection(config),
};

export class RtcGuestPipe implements PacketPipe {
  private handlers: PipeHandlers | null = null;
  private signal: WebSocket | null = null;
  private pc: RTCPeerConnection | null = null;
  private channel: RTCDataChannel | null = null;
  /** Candidates that arrived before the answer, added once it is set. */
  private early: IceCandidate[] = [];
  private answered = false;

  constructor(
    private readonly api: string,
    private readonly code: string,
    private readonly deps: RtcDeps = browserRtc,
  ) {}

  open(handlers: PipeHandlers): void {
    this.handlers = handlers;
    const signal = this.deps.socket(socketUrl(this.api, `/v1/rooms/${this.code}/guest?protocol=${PROTOCOL_VERSION}`));
    this.signal = signal;
    signal.onmessage = (event) => void this.fromRoom(event.data);
    // Before the channel opens, the Room's close code is the answer: full, locked, needs an update, ended.
    signal.onclose = (event) => {
      const isBeforeOpen = this.channel?.readyState !== 'open';
      if (isBeforeOpen) this.fail(event.code, event.reason);
    };
  }

  send(text: string): void {
    const channel = this.channel;
    const isChannelOpen = channel?.readyState === 'open';
    if (isChannelOpen) channel.send(text);
  }

  close(): void {
    this.handlers = null;
    this.teardown();
  }

  private async fromRoom(raw: unknown): Promise<void> {
    const signal = parseToGuestSignal(raw);
    if (!signal) return;
    try {
      if (signal.type === 'admitted') await this.offer(signal.iceServers, signal.relayOnly);
      else if (signal.type === 'answer') await this.answer(signal.sdp);
      else if (signal.type === 'ice') await this.addIce(signal.ice);
      // The host dropped this half-open try (it reloaded, or gave up on it).
      else this.fail(CLOSE.serverBusy, 'host away');
    } catch {
      this.fail(DROPPED, '');
    }
  }

  private async offer(iceServers: readonly IceServer[], relayOnly: boolean): Promise<void> {
    const pc = this.deps.peer(rtcConfig(iceServers, relayOnly));
    this.pc = pc;
    const channel = pc.createDataChannel('game', GAME_CHANNEL);
    this.channel = channel;
    channel.onopen = () => {
      // Signaling is done; the Room keeps nothing about this guest past its window.
      this.signal?.close(1000, 'connected');
    };
    channel.onmessage = (event) => {
      const isText = typeof event.data === 'string';
      if (isText) this.handlers?.message(event.data);
    };
    channel.onclose = () => this.fail(DROPPED, '');
    pc.onicecandidate = (event) => {
      const ice = candidateOf(event);
      if (ice) this.tell({ type: 'ice', ice });
    };
    pc.onconnectionstatechange = () => {
      const isFailed = pc.connectionState === 'failed';
      if (isFailed) this.fail(DROPPED, '');
    };
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    this.tell({ type: 'offer', sdp: offer.sdp ?? '' });
  }

  private async answer(sdp: string): Promise<void> {
    const pc = this.pc;
    const cannotAnswer = !pc || this.answered;
    if (cannotAnswer) return;
    await pc.setRemoteDescription({ type: 'answer', sdp });
    this.answered = true;
    const early = this.early;
    this.early = [];
    for (const ice of early) await pc.addIceCandidate(ice);
  }

  private async addIce(ice: IceCandidate): Promise<void> {
    const pc = this.pc;
    const isEarlyIce = !pc || !this.answered;
    if (isEarlyIce) {
      this.early.push(ice);
      return;
    }
    await pc.addIceCandidate(ice);
  }

  private tell(message: GuestSignal): void {
    const signal = this.signal;
    const isSignalOpen = signal?.readyState === WebSocket.OPEN;
    if (isSignalOpen) signal.send(JSON.stringify(message));
  }

  private fail(code: number, reason: string): void {
    const handlers = this.handlers;
    this.handlers = null;
    this.teardown();
    handlers?.closed(code, reason);
  }

  private teardown(): void {
    const { signal, pc, channel } = this;
    this.signal = null;
    this.pc = null;
    this.channel = null;
    if (signal) {
      signal.onmessage = null;
      signal.onclose = null;
      const isSignalLive = signal.readyState === WebSocket.OPEN || signal.readyState === WebSocket.CONNECTING;
      if (isSignalLive) signal.close(1000, 'bye');
    }
    if (channel) {
      channel.onopen = null;
      channel.onmessage = null;
      channel.onclose = null;
      channel.close();
    }
    pc?.close();
  }
}

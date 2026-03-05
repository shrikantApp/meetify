# Meetify — WebRTC Video Conferencing

A full-stack video conferencing app built with **NestJS** (backend signaling), **React + TypeScript** (frontend), and **WebRTC** for peer-to-peer media.

## Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL running (or use Docker Compose)

### 1. Start the Database

```bash
docker-compose up -d postgres redis
```

### 2. Backend

```bash
cd backend
cp .env.example .env   # or edit .env directly
npm install
npm run start:dev       # http://localhost:3000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env   # or edit .env directly
npm install
npm run dev             # http://localhost:5173
```

### 4. Test

Open **two browser tabs** (or an incognito window), log in with different users, and join the same meeting room. Both participants should see and hear each other.

---

## Environment Variables

### Backend (`.env`)

| Variable | Default | Description |
|---|---|---|
| `PORT` | `3000` | Server port |
| `DB_HOST` | `localhost` | PostgreSQL host |
| `DB_PORT` | `5432` | PostgreSQL port |
| `DB_USER` | `postgres` | PostgreSQL user |
| `DB_PASSWORD` | `password` | PostgreSQL password |
| `DB_NAME` | `meetify` | Database name |
| `JWT_SECRET` | — | Secret for signing JWTs |
| `JWT_EXPIRATION` | `7d` | Token expiry |
| `FRONTEND_URL` | `http://localhost:5173` | CORS origin |

### Frontend (`.env`)

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:3000/api` | Backend API URL |
| `VITE_SOCKET_URL` | `http://localhost:3000` | Socket.IO URL |
| `VITE_STUN_URL` | `stun:stun.l.google.com:19302` | STUN server |
| `VITE_TURN_URL` | *(none)* | TURN server URL |
| `VITE_TURN_USERNAME` | *(none)* | TURN username |
| `VITE_TURN_CREDENTIAL` | *(none)* | TURN credential |

---

## TURN Server Setup (Production)

STUN alone fails behind symmetric NATs and corporate firewalls. For production, deploy a TURN server:

1. **Self-hosted**: Install [coturn](https://github.com/coturn/coturn) on a public server.
2. **Cloud**: Use [Twilio Network Traversal](https://www.twilio.com/stun-turn) or [Xirsys](https://xirsys.com).
3. Set the `VITE_TURN_*` env vars in the frontend `.env`.

---

## Architecture

### Signaling Flow (Socket.IO)

```
Joiner (B)                    Server                    Existing (A)
    │                            │                            │
    ├── join-room ──────────────►│                            │
    │                            ├── user-joined ────────────►│
    │◄── room-participants ──────┤                            │
    │                            │                            │
    ├── offer (to A) ──────────►│── offer ──────────────────►│
    │                            │                            │
    │◄── answer ─────────────────┤◄── answer (to B) ─────────┤
    │                            │                            │
    │◄── ice-candidate ─────────┤◄── ice-candidate ──────────┤
    ├── ice-candidate ──────────►│── ice-candidate ──────────►│
    │                            │                            │
    │         P2P media established                          │
```

**Key design decision**: Only the **joiner** creates offers. Existing peers create their `RTCPeerConnection` only when they receive an offer. This eliminates dual-offer race conditions.

### Socket Events

| Event | Direction | Payload |
|---|---|---|
| `join-room` | Client → Server | `{ roomId, userName }` |
| `room-participants` | Server → Client | `[{ socketId, userId, userName, mediaState }]` |
| `user-joined` | Server → Broadcast | `{ socketId, userId, userName }` |
| `user-left` | Server → Broadcast | `{ socketId, userId, userName }` |
| `offer` | Client → Server → Client | `{ targetSocketId, sdp }` / `{ fromSocketId, sdp }` |
| `answer` | Client → Server → Client | `{ targetSocketId, sdp }` / `{ fromSocketId, sdp }` |
| `ice-candidate` | Client → Server → Client | `{ targetSocketId, candidate }` / `{ fromSocketId, candidate }` |
| `media-state-change` | Client → Server → Broadcast | `{ roomId, type, enabled }` |
| `screen-share-start` | Client → Server → Broadcast | `{ roomId }` |
| `screen-share-stop` | Client → Server → Broadcast | `{ roomId, isCamOn }` |
| `renegotiate-request` | Client → Server → Client | `{ targetSocketId }` / `{ fromSocketId }` |

---

## Production Notes

### Scaling Beyond 8 Participants

P2P mesh (every peer connects to every other peer) works well for up to ~8 participants but CPU/bandwidth grows as **O(n²)**. For larger rooms, use a **Selective Forwarding Unit (SFU)**:

- **[mediasoup](https://mediasoup.org/)** — Node.js-based, production-proven
- **[Janus](https://janus.conf.meetecho.com/)** — C-based, very fast
- **[LiveKit](https://livekit.io/)** — Full platform with SDKs

### Security

- **JWT socket auth** is implemented: the token is passed in `socket.handshake.auth.token` and verified on `handleConnection`.
- For production, use short-lived tokens and validate the user has permission to join the specific room.

### Multi-Instance Scaling

For horizontal scaling of the NestJS backend, use the **Redis Socket.IO adapter**:

```bash
npm install @socket.io/redis-adapter redis
```

```typescript
// main.ts
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';

const pubClient = createClient({ url: 'redis://localhost:6379' });
const subClient = pubClient.duplicate();
await Promise.all([pubClient.connect(), subClient.connect()]);
io.adapter(createAdapter(pubClient, subClient));
```

### Network Reliability

- **ICE restart**: If `iceConnectionState` becomes `"failed"`, the hook calls `pc.restartIce()` automatically.
- **`replaceTrack`** is used for camera/mic toggling — no renegotiation needed, so media switches are instant.
- For severe disconnections, implement exponential backoff reconnection in the Socket.IO client config.

---

## License

MIT

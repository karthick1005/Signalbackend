# Signal Backend

A production-ready, end-to-end encrypted real-time chat backend built with Node.js, TypeScript, Express, Socket.IO, and MongoDB — inspired by the [Signal Protocol](https://signal.org/docs/).

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Features](#features)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the Server](#running-the-server)
- [API Reference](#api-reference)
  - [User Endpoints](#user-endpoints)
  - [Key Management Endpoints](#key-management-endpoints)
  - [Group Endpoints](#group-endpoints)
- [WebSocket Events](#websocket-events)
  - [Client → Server Events](#client--server-events)
  - [Server → Client Events](#server--client-events)
- [Data Models](#data-models)
- [Security](#security)
- [Scaling & Redis](#scaling--redis)
- [Firebase Media Storage](#firebase-media-storage)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

Signal Backend is a secure, scalable messaging server that implements Signal Protocol-style cryptography for end-to-end encrypted (E2EE) communication. The server acts as a **relay only** — it never has access to plaintext message content. All encryption and decryption happens exclusively on client devices.

Key design goals:
- **Zero-knowledge messaging** — the server stores only opaque encrypted blobs
- **Forward secrecy** — per-session ephemeral key exchange via pre-keys
- **Real-time delivery** — Socket.IO with optional Redis adapter for horizontal scaling
- **Offline resilience** — undelivered messages are persisted and replayed on reconnect

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                        Clients                          │
│         (Mobile / Web - perform E2EE locally)           │
└─────────────┬───────────────────────────┬───────────────┘
              │  REST (HTTPS)             │  WebSocket (WSS)
              ▼                           ▼
┌─────────────────────────────────────────────────────────┐
│                   Express + Socket.IO                   │
│              (Rate limiting, CORS, Helmet)              │
└──────┬──────────────────────────────────────┬───────────┘
       │                                      │
       ▼                                      ▼
┌─────────────┐                     ┌─────────────────────┐
│   MongoDB   │                     │  Redis (optional)   │
│  (Mongoose) │                     │  Socket.IO adapter  │
│  User Keys  │                     │  for clustering     │
│  Messages   │                     └─────────────────────┘
│  Groups     │
└─────────────┘
       │
       ▼
┌─────────────────────┐
│  Firebase Storage   │
│  (Media / Files)    │
└─────────────────────┘
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js ≥ 18 |
| Language | TypeScript |
| Web Framework | Express 4 |
| Real-time | Socket.IO 4 |
| Database | MongoDB via Mongoose 8 |
| Cache / Pub-Sub | Redis 5 (optional) |
| Media Storage | Firebase Admin SDK / Firebase Storage |
| Authentication | JSON Web Tokens (JWT) |
| File Uploads | Multer (memory storage) |
| Security | Helmet, express-rate-limit, bcryptjs |
| Dev Tools | tsx (watch mode), nodemon |

---

## Features

- 🔐 **Signal Protocol-style E2EE** — identity keys, signed pre-keys, one-time pre-keys (X3DH)
- 📨 **Direct messaging** — real-time delivery with offline message queue
- 👥 **Group messaging** — WhatsApp-style room-based encrypted group chat
- 🔑 **Pre-key management** — upload, consume, and rotate pre-keys; automatic low-key notifications
- 🔄 **Key rotation** — server-initiated key rotation via Socket.IO event
- 🗑️ **Message deletion** — owner-only deletion propagated to all room members
- 😀 **Encrypted reactions** — emoji reactions stored and forwarded as encrypted blobs
- 📞 **Direct calls** — signalling events for peer-to-peer audio/video calls
- 🖼️ **Media upload** — encrypted file upload to Firebase Storage with proxy streaming
- 🟢 **Presence tracking** — online/offline status and `lastActive` timestamps
- 🚀 **Horizontal scaling** — Redis adapter support for multi-instance deployments
- 🛡️ **Production security** — rate limiting, CORS, Helmet HTTP headers, JWT auth

---

## Project Structure

```
Signalbackend/
├── src/
│   ├── index.ts                    # App entry point, middleware setup
│   ├── controller/
│   │   ├── saveUserController.ts   # User registration & lookup
│   │   ├── prekeycontroller.ts     # Pre-key upload & consumption
│   │   ├── keyRotationController.ts# Key rotation trigger
│   │   ├── groupController.ts      # Group creation & retrieval
│   │   └── mediaupload.ts          # Firebase media upload & proxy
│   ├── routes/
│   │   ├── saveUser.ts             # /api/user routes
│   │   ├── keyRotation.ts          # /api/keys routes
│   │   └── groupRoutes.ts          # /api/groups routes
│   ├── socket/
│   │   ├── socket.ts               # Socket.IO server logic
│   │   └── activeUsers.ts          # In-memory userId → socketId map
│   ├── models/
│   │   ├── UserModel.ts            # User schema (keys, presence)
│   │   ├── GroupModel.ts           # Group schema
│   │   ├── MessageModel.ts         # Group message schema
│   │   ├── DirectMessageModel.ts   # Direct message (offline queue)
│   │   ├── RoomModel.ts            # Chat room schema
│   │   └── ChatRelationship.ts     # Tracks last interaction between users
│   ├── lib/
│   │   ├── db.ts                   # MongoDB connection helper
│   │   └── firebase-admin.ts       # Firebase Admin SDK initialisation
│   └── Secret/
│       └── firebase-service-account.json  # Firebase credentials (not committed)
├── types/
│   └── express/index.d.ts          # Express type augmentations
├── .env                            # Environment variables (not committed)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

---

## Getting Started

### Prerequisites

| Requirement | Version |
|---|---|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| MongoDB | Atlas or self-hosted |
| Redis | ≥ 6 (optional — for clustering) |
| Firebase project | With Storage enabled |

### Installation

```bash
# Clone the repository
git clone https://github.com/karthick1005/Signalbackend.git
cd Signalbackend

# Install dependencies
npm install
```

### Environment Variables

Create a `.env` file in the project root. **Never commit this file.**

```env
# Server
PORT=8000

# MongoDB
MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>

# JWT secret — use a long, random string in production
JWT_SECRET=your-super-secret-jwt-key

# Firebase Storage download token
TOKEN=your-firebase-storage-download-token
```

> **Firebase credentials**: Place your Firebase service account JSON at `src/Secret/firebase-service-account.json`. This file is excluded from version control via `.gitignore`.

### Running the Server

```bash
# Development (hot-reload via tsx watch)
npm run dev

# Build for production
npm run build

# Start production build
npm start
```

The server starts on `http://localhost:8000` (or the `PORT` you configured).

---

## API Reference

All REST endpoints are prefixed with the base URL:
```
http://localhost:8000
```

> **Authentication**: Endpoints that modify user data should include the JWT returned at registration in the `Authorization: Bearer <token>` header.

---

### User Endpoints

Base path: `/api/user`

#### `POST /api/user/`
Register a new user or update an existing user's cryptographic keys.

**Request body**
```json
{
  "username": "alice",
  "registrationId": "12345",
  "identityKey": "<base64-public-key>",
  "signedPreKey": {
    "keyId": "1",
    "publicKey": "<base64-public-key>",
    "signature": "<base64-signature>"
  },
  "preKeys": [
    { "keyId": "101", "publicKey": "<base64-public-key>" },
    { "keyId": "102", "publicKey": "<base64-public-key>" }
  ]
}
```

**Response `201 Created` (new user) / `200 OK` (existing user)**
```json
{
  "user": { "userId": "uuid", "username": "alice", "..." },
  "token": "<jwt>"
}
```

---

#### `POST /api/user/details`
Retrieve another user's public key bundle for initiating an E2EE session. Atomically consumes one pre-key and triggers a `generate_prekey` socket event when fewer than 10 remain.

**Request body**
```json
{ "userId": "target-user-uuid" }
```

**Response `200 OK`**
```json
{
  "userId": "uuid",
  "username": "bob",
  "registrationId": "67890",
  "identityKey": "<base64>",
  "signedPreKey": { "keyId": "1", "publicKey": "<base64>", "signature": "<base64>" },
  "preKey": { "keyId": "101", "publicKey": "<base64>", "used": false }
}
```

---

#### `POST /api/user/get-user`
Retrieve a user's full profile by `userId`.

**Request body**
```json
{ "userId": "uuid" }
```

**Response `200 OK`**: Full user document.

---

#### `POST /api/user/get-all`
List all registered users (returns `userId`, `username`, and `image` only).

**Response `200 OK`**
```json
[
  { "_id": "...", "userId": "uuid", "username": "alice", "image": null }
]
```

---

#### `POST /api/user/upload-prekeys`
Replenish the pre-key pool for a user.

**Request body**
```json
{
  "userId": "uuid",
  "preKeys": [
    { "keyId": "103", "publicKey": "<base64>" }
  ]
}
```

**Response `200 OK`**
```json
{ "success": true, "message": "PreKeys uploaded successfully" }
```

---

#### `POST /api/user/request-prekey`
Request a single unused pre-key for a user (low-level — prefer `/details`).

**Request body**
```json
{ "userId": "uuid" }
```

**Response `200 OK`**: Returns `identityKey`, `registrationId`, `signedPreKey`, and one `preKey`.

---

#### `POST /api/user/media-upload`
Upload an encrypted media file to Firebase Storage.

**Request**: `multipart/form-data` with field `file`.

**Response `200 OK`**
```json
{
  "url": "https://firebasestorage.googleapis.com/v0/b/…/o/…?alt=media",
  "name": "original-filename.jpg"
}
```

---

#### `GET /api/user/proxy?url=<encoded-firebase-url>`
Proxy-stream a Firebase Storage file to the client, appending the download token server-side to avoid leaking it to the frontend.

| Query Param | Required | Description |
|---|---|---|
| `url` | Yes | URL-encoded Firebase Storage URL (without token) |

**Response**: Streams the file bytes with the appropriate `Content-Type`.

---

### Key Management Endpoints

Base path: `/api/keys`

#### `POST /api/keys/rotate`
Trigger a key rotation for a user. Clears existing pre-keys and sets `needsPreKeyUpload = true`. If the user is online, emits a `key:rotate` Socket.IO event.

**Request body**
```json
{ "userId": "uuid" }
```

**Response `200 OK`**
```json
{ "success": true, "message": "Key rotation initiated" }
```

---

### Group Endpoints

Base path: `/api/groups`

#### `POST /api/groups/create`
Create a new group with a server-generated 256-bit AES group key.

**Request body**
```json
{
  "name": "Dev Team",
  "adminId": "uuid",
  "members": ["uuid2", "uuid3"]
}
```

**Response `201 Created`**
```json
{
  "groupId": "group_1234567890",
  "name": "Dev Team",
  "members": ["uuid", "uuid2", "uuid3"],
  "admin": "uuid",
  "groupKey": "<base64-256bit-key>",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

---

#### `GET /api/groups/:userId`
Get all groups a user belongs to.

**Response `200 OK`**: Array of group documents.

---

## WebSocket Events

The Socket.IO server is mounted at path `/websocket`.

```
ws://localhost:8000/websocket
```

### Client → Server Events

#### `user_connected`
Authenticate the socket connection after connecting. Must be called before any messaging events.

```json
{ "userId": "uuid", "username": "alice" }
```

---

#### `announce_groups`
Join Socket.IO rooms for all groups the user is a member of.

```json
{
  "groups": [
    { "groupId": "group_123", "name": "Dev Team" }
  ]
}
```

---

#### `direct_message`
Send an encrypted direct message to another user. If the recipient is offline, the message is persisted and delivered on their next connection.

```json
{
  "senderId": "uuid",
  "receiverId": "uuid",
  "senderName": "alice",
  "encryptedMessage": { /* Signal Protocol ciphertext */ }
}
```

---

#### `group_message`
Send an encrypted message to a group room.

```json
{
  "senderId": "uuid",
  "senderName": "alice",
  "room": "group_123",
  "messageId": "unique-message-id",
  "timestamp": 1700000000000,
  "encryptedMessage": { /* per-member encrypted blobs */ }
}
```

---

#### `acknowledge_message`
Notify the sender that a message was delivered or read.

```json
{
  "messageId": "unique-message-id",
  "senderId": "uuid",
  "receiverId": "uuid",
  "status": "delivered" 
}
```

`status` values: `"delivered"` | `"read"`

---

#### `delete_message`
Delete a message (only the original sender can delete).

```json
{
  "messageId": "unique-message-id",
  "room": "group_123"
}
```

---

#### `send_reaction`
Send an encrypted reaction to a message.

```json
{
  "messageId": "unique-message-id",
  "encryptedReaction": "<base64-encrypted-emoji>",
  "senderId": "uuid",
  "room": "group_123"
}
```

---

#### `direct_call`
Initiate a call signalling event to another user.

```json
{
  "senderId": "uuid",
  "receiverId": "uuid",
  "senderName": "alice",
  "encryptedMessage": { /* call signalling payload */ }
}
```

---

#### `group_created`
Announce a new group to all invited members (P2P-style, server relays invitations).

```json
{
  "groupMetadata": {
    "groupId": "group_123",
    "name": "Dev Team",
    "createdBy": "uuid",
    "members": [{ "userId": "uuid2" }]
  },
  "timestamp": 1700000000000
}
```

---

#### `group_invitation`
Forward a group invitation to a specific user.

```json
{
  "targetUserId": "uuid",
  "groupMetadata": { /* ... */ },
  "timestamp": 1700000000000
}
```

---

#### `group_metadata_update`
Propagate group metadata changes (name, member list, etc.) to all group members.

```json
{
  "groupId": "group_123",
  "action": "member_added",
  "details": { /* ... */ },
  "metadata": {
    "members": [{ "userId": "uuid" }]
  },
  "timestamp": 1700000000000
}
```

---

### Server → Client Events

| Event | Description | Payload |
|---|---|---|
| `direct_message` | Incoming direct message (real-time or offline replay) | `{ senderId, senderName, encryptedMessage, timestamp }` |
| `group_message` | Incoming encrypted group message | `{ senderId, senderName, room, messageId, encryptedMessage, timestamp }` |
| `acknowledge_message` | Delivery/read receipt from recipient | `{ messageId, senderId, status, timestamp }` |
| `message_deleted` | A message was deleted by its sender | `{ messageId }` |
| `new_reaction` | A new encrypted reaction on a message | `{ messageId, encryptedReaction, senderId, room }` |
| `direct_call` | Incoming call signalling payload | `{ senderId, senderName, encryptedMessage, timestamp }` |
| `group_invitation` | Received a group invitation | `{ groupMetadata, invitedBy, timestamp }` |
| `group_metadata_update` | Group metadata changed | `{ groupId, metadata, action, details, fromMember, timestamp }` |
| `generate_prekey` | Server requests the client to generate more pre-keys | `{ type: "prekey" }` |
| `key:rotate` | Server requests the client to rotate all keys | — |
| `error` | An error occurred processing an event | `{ message: string }` |

---

## Data Models

### User
| Field | Type | Description |
|---|---|---|
| `userId` | String (unique) | UUID assigned at registration |
| `username` | String | Display name |
| `registrationId` | String | Signal Protocol registration ID |
| `identityKey` | String | Long-term identity public key (base64) |
| `signedPreKey` | Object | `{ keyId, publicKey, signature }` |
| `preKeys` | Array | One-time pre-keys `{ keyId, publicKey, used }` |
| `socketId` | String \| null | Current Socket.IO connection ID |
| `isOnline` | Boolean | Presence status |
| `lastActive` | Date | Last seen timestamp |
| `needsPreKeyUpload` | Boolean | Flag to request new pre-keys from client |

### Group
| Field | Type | Description |
|---|---|---|
| `groupId` | String (unique) | `group_<timestamp>` |
| `name` | String | Group display name |
| `members` | String[] | Array of member `userId`s |
| `admin` | String | Admin `userId` |
| `groupKey` | String | Server-generated 256-bit AES key (base64) |

### Message (Group)
Stores opaque encrypted content — plaintext is never visible to the server.

### DirectMessage
Offline message queue. Documents are deleted once delivered to the recipient.

---

## Security

| Control | Implementation |
|---|---|
| HTTP security headers | `helmet` middleware |
| Rate limiting | `express-rate-limit` — 100 req / 15 min per IP |
| CORS | Explicit allowlist (`localhost:3000`, `localhost:8000`, production URL) |
| Authentication | JWT signed with `JWT_SECRET`, 7-day expiry |
| Transport | HTTPS / WSS in production (terminate TLS at load balancer or reverse proxy) |
| E2EE | Server never decrypts messages — only relays ciphertext |
| Pre-key atomicity | MongoDB transactions prevent double-consumption of one-time pre-keys |
| Sender verification | Socket events validate that `senderId` matches the authenticated session |

### Production Hardening Checklist

- [ ] Set a strong, random `JWT_SECRET` (≥ 32 bytes)
- [ ] Use a dedicated MongoDB user with least-privilege access
- [ ] Enable MongoDB TLS/authentication
- [ ] Restrict CORS `origin` to production domains only
- [ ] Run behind a reverse proxy (nginx / Caddy) with TLS termination
- [ ] Store `firebase-service-account.json` via secrets management (not on disk)
- [ ] Rotate the Firebase storage `TOKEN` regularly
- [ ] Enable MongoDB Atlas IP allowlist

---

## Scaling & Redis

By default the server runs as a single process. To scale horizontally across multiple instances, provide a Redis server at `redis://localhost:6379`. The server will automatically use the Socket.IO Redis adapter for pub/sub message broadcasting across nodes.

If Redis is unavailable at startup, the server falls back gracefully to single-node mode with a console warning — no manual configuration required.

```env
# Redis connection (optional — defaults to redis://localhost:6379)
REDIS_URL=redis://localhost:6379
```

> **Note**: The Redis URL is currently hardcoded in `src/socket/socket.ts`. For production, externalise it to an environment variable.

---

## Firebase Media Storage

Media files are uploaded as `application/octet-stream` to a `chat_attachments/` prefix in Firebase Storage. Clients should encrypt files before uploading.

The `/api/user/proxy` endpoint prevents leaking the Firebase download token to end clients by appending it server-side when proxying file downloads.

**Setup**:
1. Create a Firebase project and enable Cloud Storage.
2. Generate a service account key (JSON) and save to `src/Secret/firebase-service-account.json`.
3. Set `TOKEN` in `.env` to your Firebase Storage download token.

---

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Commit your changes: `git commit -m 'feat: add your feature'`
4. Push the branch: `git push origin feature/your-feature`
5. Open a pull request

Please follow [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.

---

## License

This project is licensed under the [ISC License](https://opensource.org/licenses/ISC).

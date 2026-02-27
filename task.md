# Task List: Video Calling Web Application

## 1. Project Setup
- [x] Initialize NestJS backend project
- [x] Initialize React (Vite/TypeScript) frontend project
- [x] Set up Docker and docker-compose.yml

## 2. Database & Core Entities (Backend)
- [x] Install PostgreSQL, TypeORM dependencies
- [ ] Set up database connection using environment variables
- [ ] Create `User`, `Meeting`, and `MeetingParticipant` entities

## 3. Authentication (Backend)
- [ ] Implement JWT strategy and Guards
- [ ] Create Auth Controller (register, login, profile)
- [ ] Implement password hashing (bcrypt)
- [ ] Set up user validation (class-validator)

## 4. Meeting Management (Backend)
- [ ] Create Meeting module, controller, and service
- [ ] Implement create meeting logic
- [ ] Implement logic to track meeting participants
- [ ] Implement unique meeting code generation

## 5. Signaling Server (Backend - Socket.IO)
- [ ] Set up WebSockets Gateway in NestJS
- [ ] Implement room logic (join-room, leave-room)
- [ ] Implement WebRTC signaling (offer, answer, ice-candidate)
- [ ] Broadcast events (user-joined, user-left)

## 6. Frontend Setup & UI
- [ ] Install TailwindCSS (if applicable or standard responsive layout design)
- [ ] Set up Router (React Router)
- [ ] Create context for Auth
- [ ] Create context for Socket.IO
- [ ] Create common layouts and basic pages (Login, Register, Dashboard)

## 7. Frontend Features
- [ ] Implement Login & Register forms
- [ ] Implement Dashboard to create/join meetings
- [ ] Create Meeting Room UI (Video grid, controls)

## 8. WebRTC Integration (Frontend)
- [ ] Implement custom hook for WebRTC connection
- [ ] Handle `getUserMedia` (camera, mic)
- [ ] Handle `getDisplayMedia` (screen sharing)
- [ ] Integrate WebRTC peer connections with Socket.IO signaling
- [ ] Handle track adding, peer connection states, and stream rendering

## 9. Final Review & Polish
- [ ] Ensure all features work cleanly
- [ ] Address any CORS or security issues
- [ ] Add explanatory comments
- [ ] Test Docker setup

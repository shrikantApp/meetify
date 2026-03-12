# ---------- BUILD STAGE ----------
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

COPY tsconfig*.json ./

# Install ALL dependencies including dev
RUN npm install

# Copy all source code + tsconfig.json
COPY . .

# Build NestJS
RUN npm run build

# ---------- PRODUCTION STAGE ----------
FROM node:20-alpine

WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy built dist from builder
COPY --from=builder /app/dist ./dist

EXPOSE 4001

CMD ["node", "dist/main.js"]

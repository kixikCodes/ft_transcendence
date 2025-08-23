# --- DEV stage ---
FROM node:18-alpine AS dev
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci || npm i
EXPOSE 5173
CMD ["npm","run","dev"]

# --- PROD build ---
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install
COPY src/ ./src/
COPY public/ ./public/
RUN npm run build

# --- PROD serve ---
FROM nginx:stable-alpine
COPY --from=builder /app/dist/ /usr/share/nginx/html/
EXPOSE 80

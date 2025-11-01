# --- DEV stage ---
FROM node:18-alpine
WORKDIR /app

# Workspaces: root + FE + shared
COPY package.json package-lock.json ./
COPY services/frontend/package.json services/frontend/tsconfig.json ./services/frontend/
COPY packages/shared/package.json packages/shared/tsconfig.json ./packages/shared/

RUN npm ci || npm i

# Sourcecode comes via volume
EXPOSE 5173
WORKDIR /app/services/frontend

# Important: Building shared first (source comes via volume)
CMD ["sh","-c","npm -w @app/shared run build && npm run dev -- --host 0.0.0.0"]
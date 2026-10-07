FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.17.1 --activate
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm build
ENV NODE_ENV=production HOST=0.0.0.0 PORT=10000
EXPOSE 10000
CMD ["node", "tools/server.mjs"]

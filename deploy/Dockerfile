FROM node:24-bookworm-slim AS build
RUN corepack enable && corepack prepare pnpm@10.26.1 --activate
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile && pnpm build

FROM node:24-bookworm-slim
WORKDIR /app
COPY --from=build /app/server /app/server
COPY --from=build /app/packages /app/packages
COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/ui/dist /app/ui/dist
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DATABASE_PATH=/data/database.sqlite ATTACHMENT_DIR=/data/attachments
RUN mkdir -p /data && chown node:node /data
USER node
WORKDIR /app/server
CMD ["node", "dist/main.js"]

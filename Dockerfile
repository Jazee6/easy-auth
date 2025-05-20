FROM node:22-alpine

WORKDIR /app

RUN corepack enable pnpm && corepack install -g pnpm

ADD pnpm-lock.yaml ./

RUN pnpm fetch --prod

ADD . ./
RUN pnpm install -r --offline --prod
RUN pnpm build:server

EXPOSE 3000
CMD [ "node", "--env-file=apps/server/.env.production", "apps/server/dist/index.js" ]

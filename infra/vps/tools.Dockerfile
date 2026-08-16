# CMC EDU — tools image (VPS seed runner). tsx + explicit workspace symlinks
# (pnpm --filter does not link @cmc/db / @cmc/auth into root node_modules).
FROM node:22-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/auth/package.json packages/auth/
COPY packages/auth/src packages/auth/src
COPY packages/db/package.json packages/db/
COPY packages/db/tsconfig.json packages/db/
COPY packages/db/prisma packages/db/prisma
COPY packages/db/src packages/db/src
COPY apps/api/package.json apps/api/
COPY apps/api/src apps/api/src
COPY scripts scripts
RUN corepack enable \
    && pnpm install --frozen-lockfile --filter @cmc/db... --filter @cmc/auth... 2>&1 | tail -2 \
    && ln -sfn /app/packages/db /app/node_modules/@cmc/db \
    && ln -sfn /app/packages/auth /app/node_modules/@cmc/auth \
    && pnpm --filter @cmc/db build 2>&1 | tail -2 \
    && pnpm add -D tsx 2>&1 | tail -2
CMD ["node"]

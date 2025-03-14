FROM oven/bun

WORKDIR /app

COPY package.json .
COPY bun.lockb .

RUN bun install 

COPY . .
COPY tsconfig.json .
# COPY public public

ENV NODE_ENV production
CMD ["bun", "run", "src/index.ts"]

EXPOSE 5000
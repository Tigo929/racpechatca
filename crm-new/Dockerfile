FROM node:22-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── production image ──────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

# Шрифты для листа согласования. Текст на нём рисует sharp через SVG, а в
# alpine нет ни одного шрифта: без этой строки вся кириллица на макете
# превращается в пустые квадраты. DejaVu берём ради полного кириллического
# набора, fontconfig — чтобы шрифт нашёлся по имени.
RUN apk add --no-cache fontconfig ttf-dejavu poppler-utils && fc-cache -f

COPY package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY --from=builder /app/src/generated ./src/generated

EXPOSE 3000
CMD ["node", "dist/src/main"]

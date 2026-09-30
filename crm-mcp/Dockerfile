# MCP-сервер над CRM. Нужен, когда агент живёт не на ноутбуке владельца,
# а рядом с остальными контейнерами: тогда сервер поднимается с PORT и
# слушает внутреннюю сеть.
#
# Сборка в два этапа: в готовый образ не попадают ни TypeScript, ни tsx,
# ни тесты — только собранный код и рабочие зависимости.
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist

# Не root: серверу нужно только соединение с базой на чтение.
USER node

# Без PORT сервер поднимается в stdio и в контейнере бесполезен, поэтому
# порт задан по умолчанию.
ENV PORT=3333
# 0.0.0.0 здесь — это сеть докера, а не интернет: иначе соседний контейнер
# до сервера не дотянется. Порт наружу публиковать НЕ нужно — доступ к нему
# равен доступу ко всей базе CRM на чтение. В compose оставляйте его без
# `ports:`, агент обращается по имени сервиса.
ENV HOST=0.0.0.0
EXPOSE 3333

CMD ["node", "dist/index.js"]

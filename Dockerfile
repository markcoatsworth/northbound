FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY server ./server
COPY --from=build /app/dist ./dist
ENV PORT=8080
EXPOSE 8080
CMD ["node", "server/index.js"]

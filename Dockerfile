# 1-bosqich: build
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
# VITE_API_URL bo'sh — brauzer joriy sayt orqali /api/v1 ga murojaat qiladi (Nginx proxy)
RUN npm run build

# 2-bosqich: statik fayllar + /api, /ws proxy
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://localhost/ >/dev/null || exit 1

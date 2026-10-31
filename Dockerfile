# Multi-stage production image for the Chatly React + Vite frontend.
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies first to maximize Docker layer cache reuse.
COPY package*.json ./
RUN npm install

COPY . .

# Vite exposes only VITE_* variables to browser code at build time.
ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_ANON_KEY
ARG VITE_YOUTUBE_API_KEY
ENV VITE_SUPABASE_URL=${VITE_SUPABASE_URL}
ENV VITE_SUPABASE_ANON_KEY=${VITE_SUPABASE_ANON_KEY}
ENV VITE_YOUTUBE_API_KEY=${VITE_YOUTUBE_API_KEY}

RUN npm run build

FROM nginx:1.27-alpine AS runtime

COPY docker/nginx/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/health || exit 1

CMD ["nginx", "-g", "daemon off;"]

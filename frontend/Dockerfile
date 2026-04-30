# Stage 1: Build
FROM node:18 AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY angular.json tsconfig.json tsconfig.app.json tsconfig.spec.json ./
COPY src ./src

RUN npx ng build --configuration production

# Stage 2: Serve (Nginx)
FROM nginx:alpine

COPY --from=build /app/dist/f1-fantasy-app/browser /usr/share/nginx/html

RUN mkdir -p /usr/share/nginx/html/assets/drivers
COPY src/assets/ /usr/share/nginx/html/assets/

COPY nginx.conf /etc/nginx/conf.d/default.conf

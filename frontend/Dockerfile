# Stage 1: Build
FROM node:18 as build

WORKDIR /app

# Instalar Angular CLI
RUN npm install -g @angular/cli

# Criar projeto
RUN ng new f1-fantasy-app --directory ./ --skip-git --skip-tests --style=css --routing=false

# Instalar libs gráficas
RUN npm install chart.js ng2-charts three @types/three --legacy-peer-deps

# Copiar todo o código fonte
COPY ./src ./src

# Instalar dependências
RUN npm install --legacy-peer-deps

# REMOVER LIMITES DE TAMANHO (Budget)
# Isso evita o erro de "exceeded maximum budget" por causa do CSS bonito
RUN node -e "const fs=require('fs'); const p='angular.json'; const d=JSON.parse(fs.readFileSync(p)); d.projects['f1-fantasy-app'].architect.build.configurations.production.budgets=[]; fs.writeFileSync(p, JSON.stringify(d));"

# Build de Produção
RUN ng build --configuration production

# Stage 2: Serve (Nginx)
FROM nginx:alpine

# 1. Copia o site compilado do Stage 1
COPY --from=build /app/dist/f1-fantasy-app/browser /usr/share/nginx/html

# 2. GARANTIA DE FOTOS: Cria a pasta explicitamente
RUN mkdir -p /usr/share/nginx/html/assets/drivers

# 3. Copia as imagens manualmente para dentro da pasta do servidor
COPY ./src/assets/ /usr/share/nginx/html/assets/

# 4. Copia configuração do Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf
FROM node:20-alpine AS base
WORKDIR /app

COPY package*.json ./
COPY crickeon-backend ./crickeon-backend
COPY README.md ./

RUN npm install
RUN npm run build:mvp

ENV NODE_ENV=production
ENV PORT=10000
EXPOSE 10000

CMD ["npm", "run", "start:mvp"]

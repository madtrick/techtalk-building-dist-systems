FROM node:16.17.1-slim AS base

WORKDIR /app

COPY package.json /app/package.json
COPY init.js /app/init.js

RUN npm i

CMD ["./init.js"]

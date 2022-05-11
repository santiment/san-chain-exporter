FROM node:16.5-buster-slim AS builder

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN apt-get update; \
    apt-get install -y bash \
      g++ \
      ca-certificates \
      musl-dev \
      make \
      git \
      python3

WORKDIR /opt

COPY package.json package-lock.json* ./

RUN npm ci --production
RUN npm cache clean --force

FROM node:16.5-buster-slim

RUN apt-get update; \
    apt-get install -y openssl netcat-openbsd

WORKDIR /opt/app

ENV PATH /opt/node_modules/.bin:$PATH

COPY --from=builder /opt/node_modules /opt/node_modules

COPY . /opt/app

EXPOSE 3000

CMD npm start

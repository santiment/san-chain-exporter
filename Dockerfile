FROM node:9.11.1-alpine AS builder

ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

RUN apk --no-cache add \
      bash \
      g++ \
      ca-certificates \
      lz4-dev \
      musl-dev \
      cyrus-sasl-dev \
      openssl-dev \
      make \
      python \
      git

RUN apk add --no-cache --virtual .build-deps gcc zlib-dev libc-dev bsd-compat-headers py-setuptools bash

WORKDIR /app

COPY package.json package-lock.json /app/

RUN npm install

FROM node:9.11.1-alpine

RUN apk --no-cache add libsasl openssl lz4-libs

WORKDIR /app

COPY --from=builder /app/node_modules /app/node_modules

COPY . /app

EXPOSE 3000

CMD npm start

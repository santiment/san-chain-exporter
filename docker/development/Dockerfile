FROM node:10.14.1-alpine AS builder

ARG NODE_ENV=development
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

WORKDIR /opt/node_app

COPY package.json package-lock.json* ./

RUN npm ci
RUN npm cache clean --force

FROM node:10.14.1-alpine

RUN apk --no-cache add libsasl openssl lz4-libs netcat-openbsd

WORKDIR /opt/node_app/app

ENV PATH /opt/node_app/node_modules/.bin:$PATH

COPY --from=builder /opt/node_app/node_modules /opt/node_app/node_modules

COPY . .

EXPOSE 3000

CMD ["docker/development/startup.sh"]

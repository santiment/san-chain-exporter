FROM node:15.12.0-alpine AS builder

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

WORKDIR /opt

COPY package.json package-lock.json* ./

RUN npm ci --production
RUN npm cache clean --force

FROM node:15.12.0-alpine

RUN apk --no-cache add libsasl openssl lz4-libs netcat-openbsd

WORKDIR /opt/app

ENV PATH /opt/node_modules/.bin:$PATH

COPY . /opt/app

COPY --from=builder /opt/node_modules /opt/node_modules

EXPOSE 3000

CMD npm start

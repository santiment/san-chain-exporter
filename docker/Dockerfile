FROM node:18.1.0-buster-slim AS builder

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

RUN npm ci --${NODE_ENV}
RUN npm cache clean --force

FROM node:18.1.0-buster-slim

RUN apt-get update; \
    apt-get install -y openssl netcat-openbsd

WORKDIR /opt/app

ENV PATH /opt/node_modules/.bin:$PATH

COPY --from=builder /opt/node_modules /opt/node_modules

#
# Reason for multipe COPY commands is Docker CP limitation, it copies <src> contents only not preserving the directory
#
COPY package.json AUTHORS LICENSE index.js /opt/app/
COPY blockchains /opt/app/blockchains
COPY lib/ /opt/app/lib
COPY test /opt/app/test
COPY docker/wait_for_services.sh /opt/app/docker/wait_for_services.sh

EXPOSE 3000

CMD ["node", "index.js"]

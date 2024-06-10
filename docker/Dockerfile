FROM node:21.4.0-slim AS builder

ARG BUILD_ENV=production
ENV BUILD_ENV=${BUILD_ENV}

RUN apt-get update && \
    apt-get install -y bash g++ ca-certificates musl-dev make git python3

WORKDIR /opt

COPY package.json package-lock.json tsconfig.json copy_assets.sh .mocharc.js ./
COPY src ./src

RUN echo "BUILD_ENV is $BUILD_ENV" && npm ci && npm run build

# Verify that directories are created. Then prepare 'app' directory
RUN ls -la /opt && \
    ls -la /opt/built && \
    mkdir /opt/app && \
    mv /opt/built /opt/app/built && \
    if [ "$BUILD_ENV" = "production" ]; then \
        npm prune --omit=dev; \
    else \
        mv /opt/src /opt/app/src; \
    fi && \
    cp package.json package-lock.json tsconfig.json .mocharc.js /opt/app



FROM node:21.4.0-slim

RUN apt-get update && \
    apt-get install -y openssl netcat-openbsd

WORKDIR /opt/app

ENV PATH /opt/node_modules/.bin:$PATH

COPY --from=builder /opt/node_modules /opt/node_modules
COPY --from=builder /opt/app /opt/app

#
# Reason for multipe COPY commands is Docker CP limitation, it copies <src> contents only not preserving the directory
#
COPY package.json AUTHORS LICENSE /opt/app/

COPY docker/wait_for_services.sh /opt/app/docker/wait_for_services.sh

EXPOSE 3000

CMD ["node", "/opt/app/built/index.js"]

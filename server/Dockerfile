FROM node:24-alpine
WORKDIR /app
COPY server.mjs ./server.mjs
RUN mkdir /data && chown node:node /data
USER node
ENV PSGI_HOST=0.0.0.0 PORT=8787 PSGI_DATABASE=/data/psgi.sqlite
VOLUME ["/data"]
EXPOSE 8787
CMD ["node", "server.mjs"]

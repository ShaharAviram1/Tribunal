# The Tribunal as one container, for the owner's host behind Caddy (deploy/docker-compose.yml).
# No build step and no install step: the pinned Node strips TypeScript natively and package.json
# declares no dependency, so the image is the base image plus the repository.
FROM node:24.11.1-slim

WORKDIR /app
COPY . .

# The deliberations live on a volume mounted here, not in the image. Docker gives a fresh named
# volume the ownership of the image path it is mounted over, so this chown is what lets the
# unprivileged user write a deliberation.
RUN mkdir -p /data/runs && chown -R node:node /data/runs /app
USER node

ENV PORT=8888
EXPOSE 8888

# node:slim carries neither wget nor curl; the runtime's own fetch is already here.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8888)+'/').then(r=>process.exit(r.ok?0:1),()=>process.exit(1))"

CMD ["node", "server/serve.ts"]

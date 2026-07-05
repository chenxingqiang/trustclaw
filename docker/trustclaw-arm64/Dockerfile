# TrustClaw ARM64 runtime layer. Build base first via scripts/build-arm64.sh.
ARG IMAGE_PLATFORM=linux/arm64
FROM --platform=${IMAGE_PLATFORM} trustclaw-openclaw-base:arm64

USER root
COPY docker/trustclaw-arm64/scripts/entrypoint.sh /usr/local/bin/trustclaw-entrypoint.sh
COPY docker/trustclaw-arm64/scripts/init-config.mjs /opt/trustclaw/init-config.mjs
COPY docker/trustclaw-arm64/config/openclaw.json.seed /opt/trustclaw/config/openclaw.json.seed
# Full product tree (~1.5MB): ptds schema/seeds, agents, runtime, workspace, ui/dist fallback.
COPY trustclaw /app/trustclaw
# Bundled plugin resolves UI from dist/extensions/.../dist/ui (see ui-routes.ts).
RUN mkdir -p /app/dist/extensions/trustclaw-ptds/dist/ui /app/dist/extensions/dist/ui && \
    if [ -d /app/extensions/trustclaw-ptds/dist/ui ]; then \
      cp -R /app/extensions/trustclaw-ptds/dist/ui/. /app/dist/extensions/trustclaw-ptds/dist/ui/ && \
      cp -R /app/extensions/trustclaw-ptds/dist/ui/. /app/dist/extensions/dist/ui/; \
    elif [ -d /app/trustclaw/ui/dist ]; then \
      cp -R /app/trustclaw/ui/dist/. /app/dist/extensions/trustclaw-ptds/dist/ui/ && \
      cp -R /app/trustclaw/ui/dist/. /app/dist/extensions/dist/ui/; \
    fi
RUN chmod 755 /usr/local/bin/trustclaw-entrypoint.sh /opt/trustclaw/init-config.mjs

USER node
WORKDIR /app

EXPOSE 19001

ENV OPENCLAW_DISABLE_BONJOUR=1 \
    NODE_ENV=production \
    OPENCLAW_STATE_DIR=/home/node/.openclaw \
    OPENCLAW_CONFIG_PATH=/home/node/.openclaw/openclaw.json \
    OPENCLAW_CONFIG_DIR=/home/node/.openclaw \
    OPENCLAW_WORKSPACE_DIR=/home/node/.openclaw/workspace

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=5 \
  CMD node -e "fetch('http://127.0.0.1:19001/healthz').then((r)=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

ENTRYPOINT ["tini", "-s", "--", "/usr/local/bin/trustclaw-entrypoint.sh"]
CMD []

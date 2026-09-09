# docker build --tag cmdb-release --file scripts/release/Dockerfile scripts/release

# docker run --rm cmdb-release node --version
# docker run --rm cmdb-release yarn --version
# docker run --rm cmdb-release node -p "process.report.getReport().header.glibcVersionRuntime"

# replicate uberspace environment.

# Release-build image for GitHub Actions and local developer verification.
# Build from the repository root with:
#   docker build --tag cmdb-release --file scripts/release/Dockerfile scripts/release
# Run build.mjs inside this image; do not use it as the deployed application image.
# It supplies the CentOS 7 / glibc 2.17 userland matching Uberspace 7.
# Digest resolved from quay.io/pypa/manylinux2014_x86_64.
# Actions themselves run on Ubuntu; application commands run in this old userland.
FROM quay.io/pypa/manylinux2014_x86_64@sha256:493d2032114d757aaa761a9385ad8497f391503bf71acef9abeeb66682ca5d90

# glibc
# Standard nodejs.org Linux binaries require newer glibc. Use the Node project's
# glibc-217 build, with its published SHA256 pinned here.
RUN curl --fail --location --retry 3 https://unofficial-builds.nodejs.org/download/release/v18.20.8/node-v18.20.8-linux-x64-glibc-217.tar.xz -o /tmp/node.tar.xz \
    && echo '37517caab02095e96ad3ae4198777b1c365adaad53cb071e6014867c2e9fb127  /tmp/node.tar.xz' | sha256sum --check - \
    && mkdir -p /opt/cmdb-node \
    && tar -xJf /tmp/node.tar.xz --strip-components=1 -C /opt/cmdb-node \
    && rm /tmp/node.tar.xz

# Yarn
RUN curl --fail --location --retry 3 https://registry.npmjs.org/yarn/-/yarn-1.22.22.tgz -o /tmp/yarn.tgz \
    && echo 'c17d3797fb9a9115bf375e31bfd30058cac6bc9c3b8807a3d8cb2094794b51ca  /tmp/yarn.tgz' | sha256sum --check - \
    && mkdir -p /opt/cmdb-yarn \
    && tar -xzf /tmp/yarn.tgz --strip-components=1 -C /opt/cmdb-yarn \
    && rm /tmp/yarn.tgz

ENV PATH="/opt/cmdb-node/bin:/opt/cmdb-yarn/bin:${PATH}"
ENV NEXT_TELEMETRY_DISABLED=1
ENV HUSKY=0

# Verify installations
RUN test "$(node --version)" = v18.20.8 \
    && test "$(yarn --version)" = 1.22.22 \
    && test "$(node -p 'process.report.getReport().header.glibcVersionRuntime')" = 2.17 \
    && git config --system --add safe.directory /workspace

WORKDIR /workspace

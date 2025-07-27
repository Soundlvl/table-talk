// client/src/config.ts

// This is more robust for containerized/proxied environments.
const { protocol, hostname } = window.location;

// The server is expected to be running on port 3001 on the same host.
// Using the page's protocol and hostname ensures we point to the right place.
const SOCKET_SERVER_URL = `${protocol}//${hostname}:3001`;

export { SOCKET_SERVER_URL };

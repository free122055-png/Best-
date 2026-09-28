const https = require('https');
const { spawnSync } = require('child_process');
// We need to use gcloud to list databases, but gcloud isn't authenticated here.

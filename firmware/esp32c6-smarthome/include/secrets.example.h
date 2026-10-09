#pragma once
// Copy this file to include/secrets.h (never commit that file).
#define CLOUD_BASE_URL "https://YOUR-PROJECT.supabase.co"
// Public publishable key (NOT the secret/service-role key).
#define SUPABASE_PUBLISHABLE_KEY "sb_publishable_REPLACE"
// PEM root certificate which validates YOUR Supabase HTTPS endpoint.
// Obtain the current trusted CA certificate chain from a trusted source.
// Do NOT replace with setInsecure() or disable certificate checks.
static const char CLOUD_ROOT_CA[] PROGMEM = R"CERT(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_REAL_CA_PEM_BASE64
-----END CERTIFICATE-----
)CERT";

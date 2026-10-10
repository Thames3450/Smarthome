#pragma once
// Copy this file to include/secrets.h (never commit that file).
#define CLOUD_BASE_URL "https://yosatolcfeafqpicnvyy.supabase.co"
// Public publishable key (NOT the secret/service-role key).
#define SUPABASE_PUBLISHABLE_KEY "sb_publishable_9IKqX2_Ejds4IJKL7RNMag_NE-cVAlC"
// PEM root certificate which validates YOUR Supabase HTTPS endpoint.
// Obtain the current trusted CA certificate chain from a trusted source.
// Do NOT replace with setInsecure() or disable certificate checks.
// Replace the root CA PEM below with the current certificate authority trusted for this endpoint.
static const char CLOUD_ROOT_CA[] PROGMEM = R"CERT(
-----BEGIN CERTIFICATE-----
REPLACE_WITH_REAL_CA_PEM_BASE64
-----END CERTIFICATE-----
)CERT";

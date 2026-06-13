import { env } from "../../config/env";
import * as fs from "fs";
import * as path from "path";

// Token storage path
const TOKEN_FILE_PATH = path.join(env.DATA_DIR, "upstox_token.json");

let activeToken = env.UPSTOX_ACCESS_TOKEN;

// Initialize directory if not exists
function ensureDataDirectory() {
  const dir = path.dirname(TOKEN_FILE_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Returns the base URL based on the trading mode
 */
export function getBaseUrl(): string {
  return env.TRADING_MODE === "live"
    ? "https://api.upstox.com/v2"
    : "https://api-sandbox.upstox.com/v2";
}

/**
 * Generates the OAuth login URL for the user to visit
 */
export function getAuthUrl(): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: env.UPSTOX_API_KEY,
    redirect_uri: env.UPSTOX_REDIRECT_URI,
  });
  return `https://api.upstox.com/v2/login/authorization/dialog?${params.toString()}`;
}

/**
 * Loads the access token from the file system
 */
export function loadStoredToken(): string {
  ensureDataDirectory();
  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      const raw = fs.readFileSync(TOKEN_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.access_token) {
        activeToken = parsed.access_token;
        env.UPSTOX_ACCESS_TOKEN = parsed.access_token; // Keep in sync
        return activeToken;
      }
    }
  } catch (err) {
    console.error("[Auth] Error reading stored token file:", err);
  }
  return "";
}

/**
 * Saves a new access token to the file system
 */
export function saveToken(tokenData: any): void {
  ensureDataDirectory();
  try {
    const expiresIn = tokenData.expires_in || 86400; // default to 24 hours
    const expiresAt = Date.now() + (expiresIn * 1000);
    const dataToStore = {
      ...tokenData,
      expires_at: expiresAt,
    };
    fs.writeFileSync(TOKEN_FILE_PATH, JSON.stringify(dataToStore, null, 2), "utf-8");
    activeToken = tokenData.access_token;
    env.UPSTOX_ACCESS_TOKEN = tokenData.access_token;
    console.log("[Auth] Access token stored successfully.");
  } catch (err) {
    console.error("[Auth] Error writing token file:", err);
  }
}

/**
 * Checks if the stored access token is expired or within the 5-minute buffer
 * @returns true if expired or within buffer, false otherwise
 */
export function isTokenExpired(): boolean {
  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      const raw = fs.readFileSync(TOKEN_FILE_PATH, "utf-8");
      const parsed = JSON.parse(raw);
      if (parsed.expires_at) {
        const bufferMs = 5 * 60 * 1000; // 5 minutes buffer
        return Date.now() >= (parsed.expires_at - bufferMs);
      }
    }
  } catch (err) {
    console.error("[Auth] Error checking token expiry:", err);
  }
  return false;
}

/**
 * Exchanges the OAuth auth code for an access token
 */
export async function exchangeCodeForToken(code: string): Promise<string> {
  const baseUrl = getBaseUrl();
  const url = "https://api.upstox.com/v2/login/authorization/token";
  
  const body = new URLSearchParams({
    code,
    client_id: env.UPSTOX_API_KEY,
    client_secret: env.UPSTOX_API_SECRET,
    redirect_uri: env.UPSTOX_REDIRECT_URI,
    grant_type: "authorization_code",
  });

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });

    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`Failed to exchange code: ${res.statusText} - ${errorText}`);
    }

    const data = await res.json();
    if (data.access_token) {
      saveToken(data);
      return data.access_token;
    } else {
      throw new Error(`Invalid response token structure: ${JSON.stringify(data)}`);
    }
  } catch (err) {
    console.error("[Auth] Token exchange failed:", err);
    throw err;
  }
}

/**
 * Retrieves the currently active access token
 */
export function getAccessToken(): string {
  if (isTokenExpired()) {
    console.error("[Auth] CRITICAL: Access token expired. Manual re-authentication required.");
    return "";
  }
  if (env.UPSTOX_ACCESS_TOKEN) {
    return env.UPSTOX_ACCESS_TOKEN;
  }
  if (!activeToken) {
    loadStoredToken();
  }
  if (isTokenExpired()) {
    console.error("[Auth] CRITICAL: Access token expired. Manual re-authentication required.");
    return "";
  }
  return activeToken;
}

/**
 * Clears the active token from cache and disk (logout)
 */
export function clearToken(): void {
  activeToken = "";
  env.UPSTOX_ACCESS_TOKEN = "";
  try {
    if (fs.existsSync(TOKEN_FILE_PATH)) {
      fs.unlinkSync(TOKEN_FILE_PATH);
    }
    console.log("[Auth] Access token cleared.");
  } catch (err) {
    console.error("[Auth] Error deleting token file:", err);
  }
}

/**
 * Helper to build Upstox API headers
 */
export function getHeaders(): HeadersInit {
  const token = getAccessToken();
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
}

/**
 * Checks if a valid token is loaded in memory
 */
export function hasValidToken(): boolean {
  return !!getAccessToken();
}

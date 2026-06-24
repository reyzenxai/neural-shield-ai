import axios from "axios";
import * as SecureStore from "expo-secure-store";

export const API_BASE = "https://backend-jade-five-17.vercel.app/api";

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync("access_token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  async (err) => {
    if (err.response?.status === 401) {
      await SecureStore.deleteItemAsync("access_token");
    }
    return Promise.reject(err);
  }
);

export async function scanContent(type: string, content: string) {
  const { data } = await api.post(`/scan/${type}`, { content });
  return data.data;
}

export async function scanImage(type: "screenshot" | "qr", uri: string, mimeType: string) {
  const form = new FormData();
  form.append("image", { uri, name: "image.jpg", type: mimeType } as any);
  const { data } = await api.post(`/scan/${type}`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data.data;
}

export async function getScanHistory(page = 0, limit = 20) {
  const { data } = await api.get("/scan/history", { params: { page, limit } });
  return data.data;
}

export async function getProfile() {
  const { data } = await api.get("/auth/profile");
  return data.data;
}

export async function submitFeedback(scanId: string, isAccurate: boolean, comment?: string) {
  const { data } = await api.post("/report", { scanId, isAccurate, comment });
  return data.data;
}

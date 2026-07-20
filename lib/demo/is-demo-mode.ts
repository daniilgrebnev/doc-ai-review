/** Demo mode when Yandex Cloud credentials are not configured */
export function isDemoMode(): boolean {
  return !process.env.YC_API_KEY || !process.env.YC_FOLDER_ID;
}

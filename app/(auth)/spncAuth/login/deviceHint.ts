// Client-side only. Chromium browsers (Chrome, Edge, Samsung Internet, Opera) can reveal the real
// phone model through User-Agent Client Hints. Returns "" when the browser doesn't offer it
// (Safari, Firefox, iPhone/iPad).

type UAData = {
  platform?: string;
  getHighEntropyValues?: (hints: string[]) => Promise<{ model?: string; platformVersion?: string }>;
};

export async function getDeviceHint(): Promise<string> {
  try {
    const uad = (navigator as Navigator & { userAgentData?: UAData }).userAgentData;
    if (!uad?.getHighEntropyValues) return "";

    const v = await uad.getHighEntropyValues(["model", "platformVersion"]);
    const model = (v.model ?? "").trim();
    if (model) return model; // phones and tablets, e.g. "itel C671L"

    const platform = uad.platform ?? "";
    if (platform === "Windows") {
      const major = parseInt((v.platformVersion ?? "0").split(".")[0], 10);
      return major >= 13 ? "Windows 11" : "Windows 10";
    }
    return platform; // "macOS", "Linux", "Android", ...
  } catch {
    return "";
  }
}
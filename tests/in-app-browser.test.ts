import { describe, it, expect } from "vitest";
import { detectInAppBrowser } from "@/lib/in-app-browser";

describe("detectInAppBrowser", () => {
  it("จับเบราว์เซอร์ในแอปที่ Google บล็อกการล็อกอิน", () => {
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 musical_ly_35.1.0 JsSdk/2.0 NetType/WIFI Channel/App Store ByteLocale/th Region/TH BytedanceWebview/d8a21c6"
      )
    ).toBe("TikTok");
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A.231005.007; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0.6613.127 Mobile Safari/537.36 trill_360403 JsSdk/1.0 NetType/WIFI Channel/googleplay AppName/musical_ly"
      )
    ).toBe("TikTok");
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 345.0.0.0 (iPhone15,3; iOS 17_5; th_TH)"
      )
    ).toBe("Instagram");
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/475.0.0.0]"
      )
    ).toBe("Facebook");
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Safari Line/14.13.0"
      )
    ).toBe("LINE");
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/128.0 Mobile Safari/537.36"
      )
    ).toBe("แอป");
  });

  it("เบราว์เซอร์ปกติ → null (ล็อกอินได้ตามปกติ)", () => {
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1"
      )
    ).toBeNull();
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36"
      )
    ).toBeNull();
    expect(
      detectInAppBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
      )
    ).toBeNull();
    expect(detectInAppBrowser(null)).toBeNull();
  });
});

const API_ROOT = "https://api.valueclouds.com";

interface Device {
  pn: string;
  sn: string;
  devcode: string;
  devaddr: string;
}

interface LoginResponse {
  success: boolean;
  code: number;
  data?: {
    token: string;
    secret: string;
    userId: number;
  };
}

interface OneDataItem {
  id: number;
  title: string;
  unit: string;
  val: string;
  packet: number;
  packetname: string;
  date: string;
  type: number;
}

interface SPMicroData {
  pars: {
    [group: string]: Array<{ id: number; par: string; val: string; unit: string }>;
  };
}

interface EnergyFlowData {
  bt_status: Array<{ par: string; val: string; unit: string }>;
  pv_status: Array<{ par: string; val: string; unit: string }>;
  gd_status: Array<{ par: string; val: string; unit: string }>;
  bc_status: Array<{ par: string; val: string; unit: string }>;
}

async function sha1hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const hash = await crypto.subtle.digest("SHA-1", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(
  key: string,
  message: string
): Promise<string> {
  const keyData = new TextEncoder().encode(key);
  const msgData = new TextEncoder().encode(message);
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, msgData);
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class ValueCloudsClient {
  private token: string | null = null;
  private secret: string | null = null;
  private auth: string | null = null;
  private device: Device;

  constructor(
    private account: string,
    private password: string,
    device: { pn: string; sn: string; devcode: string; devaddr: string }
  ) {
    this.device = device;
  }

  async login(retries = 4): Promise<void> {
    const sha1pass = await sha1hex(this.password);

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const res = await fetch(
          `${API_ROOT}/ppr/web/login/login`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              account: this.account,
              password: sha1pass,
              project: "IOT",
            }),
          }
        );

        const authHeader = res.headers.get("auth");
        const json: LoginResponse = await res.json();

        if (json.code === 0 && json.data) {
          this.token = json.data.token;
          this.secret = json.data.secret;
          this.auth = authHeader || null;
          return;
        }

        throw new Error(`Login failed: code=${json.code}`);
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
      }
    }
  }

  private async headers(url: string): Promise<Record<string, string>> {
    if (!this.token || !this.secret) {
      await this.login();
    }

    const path = new URL(url).pathname;
    const sign = await hmacSha256Hex(this.secret!, path);

    return {
      Token: this.token!,
      project: "IOT",
      i18n: "en_US",
      sign,
      Auth: this.auth || "",
      "Content-Type": "application/x-www-form-urlencoded",
    };
  }

  private async get<T>(url: string, retries = 3): Promise<T> {
    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        const headers = await this.headers(url);
        const res = await fetch(url, { headers });
        const json = await res.json();

        if (json.code === 303) {
          this.token = null;
          this.secret = null;
          this.auth = null;
          await this.login();
          continue;
        }

        if (json.code !== 0) {
          throw new Error(`API error: code=${json.code}`);
        }

        return json.data as T;
      } catch (err) {
        if (attempt === retries - 1) throw err;
        await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
      }
    }
    throw new Error("Max retries exceeded");
  }

  private deviceParams(): string {
    return new URLSearchParams({
      pn: this.device.pn,
      sn: this.device.sn,
      devcode: this.device.devcode,
      devaddr: this.device.devaddr,
    }).toString();
  }

  async oneData(): Promise<OneDataItem[]> {
    const url = `${API_ROOT}/ppe/api/auth/web/queryDeviceOneDataxxx?${this.deviceParams()}`;
    return this.get<OneDataItem[]>(url);
  }

  async spMicroLastData(): Promise<SPMicroData> {
    const url = `${API_ROOT}/ppe/api/auth/web/querySPMicroLastData?${this.deviceParams()}`;
    return this.get<SPMicroData>(url);
  }

  async energyFlow(): Promise<EnergyFlowData> {
    const url = `${API_ROOT}/ppe/api/auth/web/queryDeviceEnergyFlow?${this.deviceParams()}`;
    return this.get<EnergyFlowData>(url);
  }
}

export interface FlatReading {
  field_id: string;
  title: string;
  unit: string;
  val: number | null;
  val_text: string | null;
}

export function flattenReadings(data: OneDataItem[]): FlatReading[] {
  return data
    .filter((item) => item.id != null)
    .map((item) => {
      const numVal = parseFloat(item.val);
      const isNumeric = !isNaN(numVal) && item.val !== "";
      return {
        field_id: String(item.id),
        title: item.title || "",
        unit: item.unit || "",
        val: isNumeric ? numVal : null,
        val_text: isNumeric ? null : item.val,
      };
    });
}

export function flattenSPMicro(data: SPMicroData): FlatReading[] {
  const rows: FlatReading[] = [];
  for (const [, items] of Object.entries(data.pars || {})) {
    for (const item of items) {
      const numVal = parseFloat(item.val);
      const isNumeric = !isNaN(numVal) && item.val !== "";
      rows.push({
        field_id: item.par,
        title: item.par,
        unit: item.unit || "",
        val: isNumeric ? numVal : null,
        val_text: isNumeric ? null : item.val,
      });
    }
  }
  return rows;
}

export function flattenFlow(data: EnergyFlowData): FlatReading[] {
  const rows: FlatReading[] = [];
  const groups: Record<string, Array<{ par: string; val: string; unit: string }>> = {
    bt_status: data.bt_status || [],
    pv_status: data.pv_status || [],
    gd_status: data.gd_status || [],
    bc_status: data.bc_status || [],
  };

  for (const [group, items] of Object.entries(groups)) {
    for (const item of items) {
      const fieldId = `${group}.${item.par}`;
      const numVal = parseFloat(item.val);
      const isNumeric = !isNaN(numVal) && item.val !== "";
      rows.push({
        field_id: fieldId,
        title: fieldId,
        unit: item.unit || "",
        val: isNumeric ? numVal : null,
        val_text: isNumeric ? null : item.val,
      });
    }
  }
  return rows;
}

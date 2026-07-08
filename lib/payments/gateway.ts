import {
  GoPayFastInitiateArgs,
  GoPayFastCallbackPayload,
} from "@/types/payments.types";

export interface GatewayInitiationResult {
  action: string; // endpoint URL
  method: "POST" | "GET";
  fields: { name: string; value: string }[];
}

export interface GatewayImplementation {
  code: string; // short identifier e.g. 'gopayfast'
  initiate(args: GoPayFastInitiateArgs): Promise<GatewayInitiationResult>;
  verifyCallback(payload: GoPayFastCallbackPayload): Promise<{
    ok: boolean;
    reason?: string;
    normalizedStatus?: string; // internal mapped status candidate
    rawStatus?: string;
    transactionId?: string;
  }>;
}

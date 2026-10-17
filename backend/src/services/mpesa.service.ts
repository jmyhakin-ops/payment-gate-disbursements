import axios, { AxiosInstance } from 'axios';
import { env } from '../config/env';
import { logger } from '../config/logger';
import { AppError } from '../utils/AppError';
import { cacheGet, cacheSet } from '../config/redis';

// ─── M-Pesa Access Token Cache ────────────────────────────────────────────────
const TOKEN_CACHE_KEY = 'mpesa:access_token';

async function getMpesaAccessToken(credentials?: {
  consumerKey: string;
  consumerSecret: string;
  baseUrl: string;
}): Promise<string> {
  const cacheKey = credentials ? `mpesa:token:${credentials.consumerKey}` : TOKEN_CACHE_KEY;
  const cached = await cacheGet<string>(cacheKey);
  if (cached) return cached;

  const key = credentials?.consumerKey || env.MPESA_CONSUMER_KEY || '';
  const secret = credentials?.consumerSecret || env.MPESA_CONSUMER_SECRET || '';
  const base = credentials?.baseUrl || env.MPESA_BASE_URL;
  const auth = Buffer.from(`${key}:${secret}`).toString('base64');

  try {
    const res = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const token = res.data.access_token as string;
    const expiresIn = parseInt(res.data.expires_in, 10) - 30;
    await cacheSet(cacheKey, token, expiresIn);
    return token;
  } catch (err: unknown) {
    logger.error('M-Pesa token fetch failed:', err);
    throw new AppError('Failed to get M-Pesa access token', 502, 'MPESA_AUTH_FAILED');
  }
}

function getMpesaTimestamp(): string {
  return new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
}

function getMpesaPassword(shortcode: string, passkey: string, timestamp: string): string {
  return Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
}

// ─── STK Push (Lipa Na M-Pesa) ───────────────────────────────────────────────
export async function initiateStkPush(params: {
  phoneNumber: string;
  amount: number;
  accountReference: string;
  transactionDesc: string;
  callbackUrl?: string;
  credentials?: { consumerKey: string; consumerSecret: string; passkey: string; shortcode: string; baseUrl: string };
}): Promise<{ checkoutRequestId: string; merchantRequestId: string; responseCode: string }> {
  const creds = params.credentials;
  const baseUrl = creds?.baseUrl || env.MPESA_BASE_URL;
  const shortcode = creds?.shortcode || env.MPESA_SHORTCODE || '';
  const passkey = creds?.passkey || env.MPESA_PASSKEY || '';
  const callbackUrl = params.callbackUrl || env.MPESA_CALLBACK_URL || '';

  const token = await getMpesaAccessToken(creds ? { consumerKey: creds.consumerKey, consumerSecret: creds.consumerSecret, baseUrl: creds.baseUrl } : undefined);
  const timestamp = getMpesaTimestamp();
  const password = getMpesaPassword(shortcode, passkey, timestamp);

  const phone = params.phoneNumber.replace(/^0/, '254').replace(/^\+/, '');

  try {
    const res = await axios.post(
      `${baseUrl}/mpesa/stkpush/v1/processrequest`,
      {
        BusinessShortCode: shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(params.amount),
        PartyA: phone,
        PartyB: shortcode,
        PhoneNumber: phone,
        CallBackURL: callbackUrl,
        AccountReference: params.accountReference,
        TransactionDesc: params.transactionDesc,
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return {
      checkoutRequestId: res.data.CheckoutRequestID,
      merchantRequestId: res.data.MerchantRequestID,
      responseCode: res.data.ResponseCode,
    };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.errorMessage || err.message : 'STK Push failed';
    throw new AppError(msg, 502, 'MPESA_STK_PUSH_FAILED');
  }
}

// ─── B2C (Business to Customer) ──────────────────────────────────────────────
export async function sendB2C(params: {
  phoneNumber: string;
  amount: number;
  occasion?: string;
  remarks?: string;
  callbackUrl?: string;
  credentials?: { consumerKey: string; consumerSecret: string; initiatorName: string; initiatorPassword: string; shortcode: string; baseUrl: string };
}): Promise<{ conversationId: string; originatorConversationId: string }> {
  const creds = params.credentials;
  const baseUrl = creds?.baseUrl || env.MPESA_BASE_URL;
  const initiatorName = creds?.initiatorName || env.MPESA_INITIATOR_NAME || '';
  const initiatorPassword = creds?.initiatorPassword || env.MPESA_INITIATOR_PASSWORD || '';
  const shortcode = creds?.shortcode || env.MPESA_B2C_SHORTCODE || env.MPESA_SHORTCODE || '';
  const callbackUrl = params.callbackUrl || env.MPESA_CALLBACK_URL || '';

  const token = await getMpesaAccessToken(creds ? { consumerKey: creds.consumerKey, consumerSecret: creds.consumerSecret, baseUrl } : undefined);
  const securityCredential = Buffer.from(initiatorPassword).toString('base64');
  const phone = params.phoneNumber.replace(/^0/, '254').replace(/^\+/, '');

  try {
    const res = await axios.post(
      `${baseUrl}/mpesa/b2c/v3/paymentrequest`,
      {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayment',
        Amount: Math.round(params.amount),
        PartyA: shortcode,
        PartyB: phone,
        Remarks: params.remarks || 'Payment',
        QueueTimeOutURL: `${callbackUrl}/timeout`,
        ResultURL: callbackUrl,
        Occasion: params.occasion || 'Payment',
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return {
      conversationId: res.data.ConversationID,
      originatorConversationId: res.data.OriginatorConversationID,
    };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.errorMessage || err.message : 'B2C payment failed';
    throw new AppError(msg, 502, 'MPESA_B2C_FAILED');
  }
}

// ─── B2B Paybill Payment ──────────────────────────────────────────────────────
export async function sendB2BPaybill(params: {
  receiverShortcode: string;
  amount: number;
  accountReference: string;
  remarks?: string;
  callbackUrl?: string;
  credentials?: { consumerKey: string; consumerSecret: string; initiatorName: string; initiatorPassword: string; shortcode: string; baseUrl: string };
}): Promise<{ conversationId: string; originatorConversationId: string }> {
  const creds = params.credentials;
  const baseUrl = creds?.baseUrl || env.MPESA_BASE_URL;
  const initiatorName = creds?.initiatorName || env.MPESA_INITIATOR_NAME || '';
  const initiatorPassword = creds?.initiatorPassword || env.MPESA_INITIATOR_PASSWORD || '';
  const shortcode = creds?.shortcode || env.MPESA_SHORTCODE || '';
  const callbackUrl = params.callbackUrl || env.MPESA_CALLBACK_URL || '';

  const token = await getMpesaAccessToken(creds ? { consumerKey: creds.consumerKey, consumerSecret: creds.consumerSecret, baseUrl } : undefined);
  const securityCredential = Buffer.from(initiatorPassword).toString('base64');

  try {
    const res = await axios.post(
      `${baseUrl}/mpesa/b2b/v1/paymentrequest`,
      {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessPayBill',
        SenderIdentifierType: '4',
        RecieverIdentifierType: '4',
        Amount: Math.round(params.amount),
        PartyA: shortcode,
        PartyB: params.receiverShortcode,
        AccountReference: params.accountReference,
        Remarks: params.remarks || 'B2B Payment',
        QueueTimeOutURL: `${callbackUrl}/timeout`,
        ResultURL: callbackUrl,
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return {
      conversationId: res.data.ConversationID,
      originatorConversationId: res.data.OriginatorConversationID,
    };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.errorMessage || err.message : 'B2B Paybill failed';
    throw new AppError(msg, 502, 'MPESA_B2B_PAYBILL_FAILED');
  }
}

// ─── B2B Buy Goods Till ───────────────────────────────────────────────────────
export async function sendB2BTill(params: {
  tillNumber: string;
  amount: number;
  remarks?: string;
  callbackUrl?: string;
  credentials?: { consumerKey: string; consumerSecret: string; initiatorName: string; initiatorPassword: string; shortcode: string; baseUrl: string };
}): Promise<{ conversationId: string; originatorConversationId: string }> {
  const creds = params.credentials;
  const baseUrl = creds?.baseUrl || env.MPESA_BASE_URL;
  const initiatorName = creds?.initiatorName || env.MPESA_INITIATOR_NAME || '';
  const initiatorPassword = creds?.initiatorPassword || env.MPESA_INITIATOR_PASSWORD || '';
  const shortcode = creds?.shortcode || env.MPESA_SHORTCODE || '';
  const callbackUrl = params.callbackUrl || env.MPESA_CALLBACK_URL || '';

  const token = await getMpesaAccessToken(creds ? { consumerKey: creds.consumerKey, consumerSecret: creds.consumerSecret, baseUrl } : undefined);
  const securityCredential = Buffer.from(initiatorPassword).toString('base64');

  try {
    const res = await axios.post(
      `${baseUrl}/mpesa/b2b/v1/paymentrequest`,
      {
        InitiatorName: initiatorName,
        SecurityCredential: securityCredential,
        CommandID: 'BusinessBuyGoods',
        SenderIdentifierType: '4',
        RecieverIdentifierType: '2',
        Amount: Math.round(params.amount),
        PartyA: shortcode,
        PartyB: params.tillNumber,
        AccountReference: params.tillNumber,
        Remarks: params.remarks || 'Buy Goods Payment',
        QueueTimeOutURL: `${callbackUrl}/timeout`,
        ResultURL: callbackUrl,
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return {
      conversationId: res.data.ConversationID,
      originatorConversationId: res.data.OriginatorConversationID,
    };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.errorMessage || err.message : 'B2B Till failed';
    throw new AppError(msg, 502, 'MPESA_B2B_TILL_FAILED');
  }
}

// ─── Query STK Push Status ────────────────────────────────────────────────────
export async function queryStkPushStatus(checkoutRequestId: string, credentials?: {
  consumerKey: string; consumerSecret: string; passkey: string; shortcode: string; baseUrl: string;
}): Promise<{ resultCode: string; resultDesc: string }> {
  const baseUrl = credentials?.baseUrl || env.MPESA_BASE_URL;
  const shortcode = credentials?.shortcode || env.MPESA_SHORTCODE || '';
  const passkey = credentials?.passkey || env.MPESA_PASSKEY || '';
  const token = await getMpesaAccessToken(credentials ? { consumerKey: credentials.consumerKey, consumerSecret: credentials.consumerSecret, baseUrl } : undefined);
  const timestamp = getMpesaTimestamp();
  const password = getMpesaPassword(shortcode, passkey, timestamp);

  const res = await axios.post(
    `${baseUrl}/mpesa/stkpushquery/v1/query`,
    { BusinessShortCode: shortcode, Password: password, Timestamp: timestamp, CheckoutRequestID: checkoutRequestId },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return { resultCode: res.data.ResultCode, resultDesc: res.data.ResultDesc };
}

// ─── Parse M-Pesa Callback ────────────────────────────────────────────────────
export function parseMpesaCallback(body: Record<string, unknown>): {
  conversationId?: string;
  transactionId?: string;
  amount?: number;
  phone?: string;
  resultCode: number;
  resultDesc: string;
  receiptNumber?: string;
} {
  // B2C / B2B Result
  if (body.Result) {
    const result = body.Result as Record<string, unknown>;
    const items = (result.ResultParameters as { ResultParameter: Array<{ Key: string; Value: unknown }> })?.ResultParameter || [];
    const get = (key: string) => items.find((i) => i.Key === key)?.Value;
    return {
      conversationId: result.ConversationID as string,
      resultCode: result.ResultCode as number,
      resultDesc: result.ResultDesc as string,
      transactionId: get('TransactionID') as string,
      amount: get('TransactionAmount') as number,
      phone: get('ReceiverPartyPublicName') as string,
      receiptNumber: get('TransactionID') as string,
    };
  }

  // STK Push callback
  const stk = body.Body as { stkCallback: { MerchantRequestID: string; CheckoutRequestID: string; ResultCode: number; ResultDesc: string; CallbackMetadata?: { Item: Array<{ Name: string; Value?: unknown }> } } };
  const cb = stk?.stkCallback;
  if (!cb) return { resultCode: -1, resultDesc: 'Unknown callback' };

  const items = cb.CallbackMetadata?.Item || [];
  const getItem = (name: string) => items.find((i) => i.Name === name)?.Value;

  return {
    resultCode: cb.ResultCode,
    resultDesc: cb.ResultDesc,
    receiptNumber: getItem('MpesaReceiptNumber') as string,
    amount: getItem('Amount') as number,
    phone: getItem('PhoneNumber') as string,
    transactionId: cb.CheckoutRequestID,
  };
}

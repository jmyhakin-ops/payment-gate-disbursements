import axios from 'axios';
import { env } from '../config/env';
import { AppError } from '../utils/AppError';
import { logger } from '../config/logger';
import { cacheGet, cacheSet } from '../config/redis';

// ─── PesaLink Transfer ────────────────────────────────────────────────────────
export async function sendPesaLink(params: {
  amount: number;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  reference: string;
  narration?: string;
  callbackUrl?: string;
  credentials?: { clientId: string; clientSecret: string; baseUrl: string };
}): Promise<{ transactionRef: string; status: string; message: string }> {
  const creds = params.credentials;
  const baseUrl = creds?.baseUrl || env.PESALINK_BASE_URL || 'https://api.pesalink.co.ke';
  const clientId = creds?.clientId || env.PESALINK_CLIENT_ID || '';
  const clientSecret = creds?.clientSecret || env.PESALINK_CLIENT_SECRET || '';

  // Get access token
  const tokenKey = `pesalink:token:${clientId}`;
  let token = await cacheGet<string>(tokenKey);
  if (!token) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await axios.post(
      `${baseUrl}/oauth/token`,
      'grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    token = tokenRes.data.access_token;
    await cacheSet(tokenKey, token, parseInt(tokenRes.data.expires_in, 10) - 30);
  }

  try {
    const res = await axios.post(
      `${baseUrl}/api/v1/transfers`,
      {
        amount: params.amount,
        currency: 'KES',
        destinationBankCode: params.bankCode,
        destinationAccountNumber: params.accountNumber,
        destinationAccountName: params.accountName,
        reference: params.reference,
        narration: params.narration || 'PesaLink Transfer',
        callbackUrl: params.callbackUrl || env.PESALINK_CALLBACK_URL,
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return {
      transactionRef: res.data.transactionReference || res.data.id,
      status: res.data.status,
      message: res.data.message || 'Transfer initiated',
    };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.message || err.message : 'PesaLink transfer failed';
    logger.error('PesaLink error:', err);
    throw new AppError(msg, 502, 'PESALINK_FAILED');
  }
}

// ─── Equity Jenga API — Bank Transfer ────────────────────────────────────────
export async function sendEquityJenga(params: {
  amount: number;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  reference: string;
  narration?: string;
  credentials?: { apiKey: string; merchantCode: string; consumerSecret: string; baseUrl: string };
}): Promise<{ transactionRef: string; status: string; message: string }> {
  const creds = params.credentials;
  const baseUrl = creds?.baseUrl || env.JENGA_BASE_URL || 'https://uat.jengahq.io';
  const apiKey = creds?.apiKey || env.JENGA_API_KEY || '';
  const merchantCode = creds?.merchantCode || env.JENGA_MERCHANT_CODE || '';

  const tokenKey = `jenga:token:${merchantCode}`;
  let token = await cacheGet<string>(tokenKey);
  if (!token) {
    const tokenRes = await axios.post(
      `${baseUrl}/authentication/api/v3/identity/oidc/token`,
      `grant_type=client_credentials&apiKey=${apiKey}&merchantCode=${merchantCode}`,
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    token = tokenRes.data.access_token;
    await cacheSet(tokenKey, token, 3500);
  }

  try {
    const res = await axios.post(
      `${baseUrl}/transaction/v3/remittance`,
      {
        source: { countryCode: 'KE', name: 'KenyaPay', accountNumber: merchantCode },
        destination: {
          type: 'bank',
          countryCode: 'KE',
          name: params.accountName,
          bankCode: params.bankCode,
          accountNumber: params.accountNumber,
        },
        transfer: {
          type: 'EFT',
          amount: params.amount.toString(),
          currencyCode: 'KES',
          reference: params.reference,
          date: new Date().toISOString().split('T')[0],
          description: params.narration || 'Bank Transfer',
        },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return {
      transactionRef: res.data.transactionReference || res.data.data?.transactionId,
      status: res.data.status || 'initiated',
      message: res.data.description || 'Transfer initiated',
    };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.message || err.message : 'Jenga transfer failed';
    logger.error('Jenga error:', err);
    throw new AppError(msg, 502, 'JENGA_TRANSFER_FAILED');
  }
}

// ─── KCB Open Banking — Bank Transfer ────────────────────────────────────────
export async function sendKCBTransfer(params: {
  amount: number;
  accountNumber: string;
  bankCode: string;
  accountName: string;
  reference: string;
  narration?: string;
  credentials?: { clientId: string; clientSecret: string; baseUrl: string };
}): Promise<{ transactionRef: string; status: string; message: string }> {
  const creds = params.credentials;
  const baseUrl = creds?.baseUrl || env.KCB_BASE_URL || 'https://openapi.kcbgroup.com';
  const clientId = creds?.clientId || env.KCB_CLIENT_ID || '';
  const clientSecret = creds?.clientSecret || env.KCB_CLIENT_SECRET || '';

  const tokenKey = `kcb:token:${clientId}`;
  let token = await cacheGet<string>(tokenKey);
  if (!token) {
    const auth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const tokenRes = await axios.post(
      `${baseUrl}/oauth2/v1/token`,
      'grant_type=client_credentials',
      { headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    token = tokenRes.data.access_token;
    await cacheSet(tokenKey, token, parseInt(tokenRes.data.expires_in, 10) - 30);
  }

  try {
    const res = await axios.post(
      `${baseUrl}/inter-bank/v1/transfers`,
      {
        amount: params.amount,
        currency: 'KES',
        creditAccount: params.accountNumber,
        creditBankCode: params.bankCode,
        creditAccountName: params.accountName,
        reference: params.reference,
        remarks: params.narration || 'KCB Transfer',
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
    );

    return {
      transactionRef: res.data.transactionId || res.data.reference,
      status: res.data.status || 'pending',
      message: res.data.message || 'Transfer initiated',
    };
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err) ? err.response?.data?.message || err.message : 'KCB transfer failed';
    logger.error('KCB error:', err);
    throw new AppError(msg, 502, 'KCB_TRANSFER_FAILED');
  }
}

// ─── Kenyan Bank Code Directory ───────────────────────────────────────────────
export const KENYAN_BANKS: Record<string, { name: string; pesaLinkCode: string; swiftCode?: string }> = {
  '01': { name: 'Kenya Commercial Bank (KCB)', pesaLinkCode: '01', swiftCode: 'KCBLKENX' },
  '02': { name: 'Standard Chartered Bank', pesaLinkCode: '02', swiftCode: 'SCBLKENX' },
  '03': { name: 'Barclays Bank / ABSA Kenya', pesaLinkCode: '03', swiftCode: 'BARCKENX' },
  '05': { name: 'Bank of India', pesaLinkCode: '05' },
  '07': { name: 'National Bank of Kenya', pesaLinkCode: '07', swiftCode: 'NBKEKENX' },
  '10': { name: 'Prime Bank', pesaLinkCode: '10' },
  '11': { name: 'Co-operative Bank of Kenya', pesaLinkCode: '11', swiftCode: 'KCOOKENA' },
  '12': { name: 'National Industrial Credit Bank', pesaLinkCode: '12' },
  '14': { name: 'Oriental Commercial Bank', pesaLinkCode: '14' },
  '16': { name: 'Citibank N.A. Kenya', pesaLinkCode: '16', swiftCode: 'CITIKENA' },
  '18': { name: 'Middle East Bank Kenya', pesaLinkCode: '18' },
  '19': { name: 'Bank of Africa Kenya', pesaLinkCode: '19' },
  '23': { name: 'Consolidated Bank of Kenya', pesaLinkCode: '23' },
  '25': { name: 'Credit Bank', pesaLinkCode: '25' },
  '26': { name: 'Trans-National Bank Kenya', pesaLinkCode: '26' },
  '30': { name: 'Chase Bank Kenya (In Receivership)', pesaLinkCode: '30' },
  '31': { name: 'CfC Stanbic Bank', pesaLinkCode: '31', swiftCode: 'SBICKENX' },
  '35': { name: 'African Banking Corporation', pesaLinkCode: '35' },
  '39': { name: 'Imperial Bank Kenya (In Receivership)', pesaLinkCode: '39' },
  '41': { name: 'NIC Bank / NCBA Bank', pesaLinkCode: '41', swiftCode: 'CBAFKENX' },
  '43': { name: 'Housing Finance Bank', pesaLinkCode: '43' },
  '49': { name: 'Equity Bank Kenya', pesaLinkCode: '49', swiftCode: 'EQBLKENA' },
  '50': { name: 'Paramount Universal Bank', pesaLinkCode: '50' },
  '51': { name: 'Jamii Bora Bank / Kingdom Bank', pesaLinkCode: '51' },
  '54': { name: 'Victoria Commercial Bank', pesaLinkCode: '54' },
  '55': { name: 'Guardian Bank', pesaLinkCode: '55' },
  '57': { name: 'I&M Bank Kenya', pesaLinkCode: '57', swiftCode: 'IMBLKENA' },
  '61': { name: 'Habib Bank AG Zurich', pesaLinkCode: '61' },
  '63': { name: 'Diamond Trust Bank Kenya', pesaLinkCode: '63', swiftCode: 'DTKEKENA' },
  '66': { name: 'Sidian Bank', pesaLinkCode: '66' },
  '68': { name: 'Equity Bank (formerly K-Rep)', pesaLinkCode: '68' },
  '70': { name: 'Family Bank', pesaLinkCode: '70', swiftCode: 'FABLKENA' },
  '72': { name: 'Gulf African Bank', pesaLinkCode: '72' },
  '74': { name: 'First Community Bank', pesaLinkCode: '74' },
  '76': { name: 'UBA Kenya Bank', pesaLinkCode: '76' },
  '78': { name: 'Ecobank Kenya', pesaLinkCode: '78', swiftCode: 'ECOCKENX' },
};

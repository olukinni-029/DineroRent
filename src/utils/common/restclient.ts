
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';


export interface IBaseResponse {
  status: string;
  success: boolean;
  data?: any;
  message?: string;
}

export interface IWalletResponse extends IBaseResponse {
  userId: string;
  encryptedData: string;
  internalWalletAccountNumber: string;
  wallets: string[];
}


export const restClientWithHeaders = async <T extends IBaseResponse>(
  method: AxiosRequestConfig['method'],
  url: string,
  payload?: object,
  headers?: AxiosRequestConfig['headers'],
): Promise<T> => {
  const config: AxiosRequestConfig = {
    method,
    url,
    headers,
    maxRedirects: 0,
    transitional: { clarifyTimeoutError: true },
    ...(method?.toLowerCase() === 'get' ? { params: payload } : { data: payload }),
  };

  try {
    const response: AxiosResponse = await axios(config);
    return response.data as T;
  } catch (error: any) {
    // Log full error
    console.error("❌ Axios error:", {
      url,
      method,
      status: error.response?.status,
      headers: error.response?.headers,
      data: error.response?.data,
      message: error.message,
    });

    // Return a default error object to prevent undefined
    return {
      success: false,
      message: error.response?.data?.message || error.message || "Unknown error",
      ...error.response?.data,
    } as T;
  }
};

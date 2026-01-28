
/* eslint-disable @typescript-eslint/no-explicit-any */
import axios, { AxiosRequestConfig, AxiosResponse } from 'axios';


export interface IBaseResponse {
  status: string;
  success: boolean;
  data?: any;
  entity?:any;
  result?: any; 
  message?: string;
}

export interface IWalletResponse extends IBaseResponse {
  userId: string;
  encryptedData: string;
  internalWalletAccountNumber: string;
  wallets: string[];
}


export const restClientWithHeaders = async <T>(
  method: AxiosRequestConfig['method'],
  url: string,
  payload?: object,
  headers?: AxiosRequestConfig['headers'],
): Promise<T> => {
  const config: AxiosRequestConfig = {
    method,
    url,
    headers,
    ...(method?.toLowerCase() === 'get'
      ? { params: payload }
      : { data: payload }),
  };

  try {
    const response = await axios(config);
    return response.data as T;
  } catch (error: any) {
    console.error('❌ Axios error:', {
      url,
      method,
      status: error.response?.status,
      data: error.response?.data,
    });
    throw error;
  }
};

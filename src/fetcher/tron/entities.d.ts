/**
 * Частый, но не постоянный формат ответа от TronScan
 */
export interface ITronScanResponse<T> {
  status: {
    code: number;
    message: string;
  };
  data?: Array<T>;
  count?: number;
  total?: number;
}

/**
 * Типичное представление информации о токене в API
 */
export interface IToken {
  tokenId: string;
  tokenAbbr: string;
  tokenName: string;
  tokenDecimal: number;
  tokenCanShow: number;
  tokenType: string;
  tokenLogo: string;
  tokenLevel: string;
  vip: boolean;
}

/**
 * Представление токенов в ответах на запросы по кошелькам
 */
export interface IWalletToken {
  token_price_in_usd: string;
  frozen_token_value_in_usd: string;
  level: number;
  frozen: number;
  token_value: string;
  token_type: number;
  token_price: string;
  token_value_in_usd: string;
  token_id: string;
  token_abbr: string;
  token_name: string;
  paid_id: number;
  vip: boolean;
  token_decimal: number;
  balance: string;
  token_url: string;
  nrOfTokenHolders?: number;
  transferCount?: number;
}

/**
 * Возвращаемые данные по кошельку через TronScanAPI
 */
export interface IContract {
  address: string;
  name: string;
  description: string;
  balance: number;
  balanceInUsd: number;
  trxCount: number;
  date_created: number;
  vip: boolean;
  announcement: string;
  tag1: string;
  tag1Url: string;
  creator: {
    address: string;
    address_is_contract: boolean;
    txHash: string;
    token_balance: number;
    energy_remaining: number;
  };
  call_token_info: {
    tokenInfo: IToken;
  };
  methodMap: {
    [index: string]: string;
  };
  tokenInfo: IToken;
  balanceWithTokens: number;
  balanceWithTokensInUsd: number;
}

/**
 * Возвращаемые данные по транзакции через TronScanAPI
 */
export interface ITransaction {
  transactionHash: string;
  timestamp: number;
  transferFromAddress: string;
  transferToAddress: string;
  riskTransaction: boolean;
  confirmed: boolean;
  cheatStatus: boolean;
  tokenInfo: IToken;
  contractRet: string;
  data: string;
  amount: number;
  revert: boolean;
}

/**
 * Представление кошелька в TronScanAPI
 */
export interface IWallet {
  data: Array<IWalletToken> | null;
  count?: number;
}

import axios from 'axios';
import type {
  IContract,
  ITransaction,
  ITronScanResponse,
  IWallet
} from './tron/entities.js';

type TransactionResponse = {
  total: number;
  data: Array<ITransaction>;
};

class TronScanAPIParser {
  private readonly _apiKey: string;
  private static readonly _endpoints = {
    contractData: 'https://apilist.tronscanapi.com/api/contract',
    transactionsList: 'https://apilist.tronscanapi.com/api/transfer',
    walletData: 'https://apilist.tronscanapi.com/api/account/wallet'
  };

  /**
   *
   * @param apiKey API ключ для доступа к TronScanAPI
   */
  constructor(apiKey: string) {
    this._apiKey = apiKey;
  }

  private async _makeRequest<T>(
    url: string,
    params: object
  ): Promise<undefined | T> {
    try {
      const response = await axios.get<T>(url, {
        params,
        headers: {
          'TRON-PRO-API-KEY': this._apiKey
        }
      });

      if (response.status !== 200) {
        throw new Error('request failed');
      }

      return response.data;
    } catch (error) {
      return undefined;
    }
  }

  /**
   *
   * @param address адрес контракта
   * @returns данные о контракте, если он существует и запрос пройдет
   */
  public async getContract(address: string): Promise<undefined | IContract> {
    try {
      const contract = await this._makeRequest<ITronScanResponse<IContract>>(
        TronScanAPIParser._endpoints.contractData,
        {
          contract: address
        }
      );

      return contract
        ? contract.data
          ? contract.data[0]
          : undefined
        : undefined;
    } catch (error) {
      return undefined;
    }
  }

  /**
   *
   * @param address адрес контракта или кошелька
   * @returns список связанных транзакций
   */
  public async getTransactions(
    address: string,
    loaded?: Array<ITransaction>
  ): Promise<undefined | Array<ITransaction>> {
    try {
      const transactions = await this._makeRequest<TransactionResponse>(
        TronScanAPIParser._endpoints.transactionsList,
        {
          address,
          page: loaded ? loaded.length / 10000 : 0,
          start: loaded ? loaded.length : 0
        }
      );

      if (transactions === undefined) {
        return undefined;
      }

      if (transactions.total >= 10000) {
        const result = loaded
          ? loaded.concat(transactions.data)
          : transactions.data;

        return await this.getTransactions(address, result);
      } else {
        return transactions.data;
      }
    } catch (error) {
      return undefined;
    }
  }

  /**
   *
   * @param address адрес кошелька
   * @returns данные о кошельке
   */
  public async getWalletData(address: string): Promise<undefined | IWallet> {
    try {
      const wallet = await this._makeRequest<IWallet>(
        TronScanAPIParser._endpoints.walletData,
        {
          address
        }
      );

      return wallet;
    } catch (error) {
      return undefined;
    }
  }
}

export default TronScanAPIParser;

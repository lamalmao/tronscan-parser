import { type PrismaClient, Prisma } from '@prisma/client';
import type TronScanAPIParser from '../fetcher/index.js';
import kue from 'kue';
import express from 'express';

export type Jobs = 'contract' | 'transactions' | 'wallet' | 'track-wallets';

interface JobParams {
  target: string;
  [index: string]: unknown;
}

type JobData<T extends JobParams> = {
  data: T;
};

class TronScanAPIWorker {
  private readonly _parser: TronScanAPIParser;
  private _lastDate = new BigUint64Array([BigInt(Date.now())]);
  private _queue: kue.Queue;
  private _loaded: {
    objects: Array<string>;
    transactions: Array<string>;
  } = {
    objects: [],
    transactions: []
  };
  private _dbClient: PrismaClient;

  constructor(
    parser: TronScanAPIParser,
    dbClient: PrismaClient,
    redisOptions:
      | {
          host: string;
          port: number;
          auth?: string;
          options?: object;
        }
      | string,
    runKueServer = false
  ) {
    this._dbClient = dbClient;
    this._dbClient.$connect().catch(err => {
      console.log((err as Error).message);
      process.exit(-1);
    });

    this._parser = parser;

    const queue = kue.createQueue({
      redis: redisOptions
    });
    process.once('SIGTERM', () => {
      queue.shutdown(5000, err => {
        console.log('Kue shutdown: ', err || '');
        process.exit(0);
      });
    });
    this._queue = queue;

    if (runKueServer) {
      const app = express();
      app.use('/jobs', kue.app);
      app.listen(3111, 'localhost', () =>
        console.log('Kue jobs dispatcher running at http://localhost:3111/jobs')
      );
    }

    this._queue.process(
      'wallet',
      100,
      (
        job: JobData<{
          target: string;
          parseNested: boolean;
        }>,
        done
      ) => {
        try {
          const walletAddress = job.data.target;

          this._parser
            .getWalletData(job.data.target)
            .then(async wallet => {
              done();
              if (!wallet || !wallet.data) {
                this.enqueue('wallet', {
                  target: walletAddress
                });
                return;
              }

              const walletInstance = await this._dbClient.wallet.findFirst({
                where: {
                  address: walletAddress
                }
              });

              let walletAmountInUsd = 0;
              let tokensAmount = 0;
              const tokens: {
                [index: string]: unknown;
              } = {};
              for (const token of wallet.data) {
                walletAmountInUsd += Number(token.token_price_in_usd);
                tokensAmount++;
                tokens[token.token_abbr] = token;
              }

              const now = new Date();

              if (!walletInstance) {
                await this._dbClient.wallet.create({
                  data: {
                    address: walletAddress,
                    lastUpdate: now
                  }
                });
              }

              const snapshot = await this._dbClient.walletSnapshot.create({
                data: {
                  tokens: tokens as Prisma.JsonObject,
                  walletAddress,
                  walletAmountInUsd,
                  tokensAmount,
                  loadDate: now
                }
              });

              await this._dbClient.wallet.update({
                where: {
                  address: walletAddress
                },
                data: {
                  currentSnapshotId: snapshot.id
                }
              });
            })
            .catch(error => console.log((error as Error).message));

          if (job.data.parseNested) {
            this.enqueueTransactionsIfNotLoaded({
              target: walletAddress,
              parseNested: false
            });
          }
        } catch (error) {
          console.log((error as Error).message);
        }
      }
    );

    this._queue.process(
      'transactions',
      100,
      (
        job: JobData<{
          target: string;
          parseNested: boolean;
        }>,
        done
      ) => {
        try {
          this._parser
            .getTransactions(job.data.target)
            .then(async transactions => {
              try {
                done();
                if (!transactions || transactions.length === 0) {
                  return;
                }

                for (const transaction of transactions) {
                  const now = new Date();

                  await this._dbClient.wallet.upsert({
                    create: {
                      address: transaction.transferFromAddress,
                      lastUpdate: now
                    },
                    where: {
                      address: transaction.transferFromAddress
                    },
                    update: {}
                  });

                  await this._dbClient.wallet.upsert({
                    create: {
                      address: transaction.transferToAddress,
                      lastUpdate: now
                    },
                    where: {
                      address: transaction.transferToAddress
                    },
                    update: {}
                  });

                  this.enqueueIfNotLoaded('wallet', {
                    target: transaction.transferFromAddress,
                    parseNested: job.data.parseNested
                  });
                  this.enqueueIfNotLoaded('wallet', {
                    target: transaction.transferToAddress,
                    parseNested: job.data.parseNested
                  });

                  this._dbClient.transaction
                    .create({
                      data: {
                        amount: transaction.amount,
                        confirmed: transaction.confirmed,
                        hash: transaction.transactionHash,
                        revert: transaction.revert,
                        from: transaction.transferFromAddress,
                        to: transaction.transferToAddress,
                        transactionDate: new Date(transaction.timestamp)
                      }
                    })
                    .catch(() => null);
                }
              } catch (error) {
                console.log((error as Error).message);
              }
            })
            .catch(error => console.log((error as Error).message));
        } catch (error) {
          console.log((error as Error).message);
        }
      }
    );

    this._queue.process(
      'contract',
      100,
      (
        job: JobData<{
          target: string;
        }>,
        done
      ) => {
        try {
          const contractAddress = job.data.target;
          this._parser
            .getContract(contractAddress)
            .then(async contract => {
              try {
                done();
                if (!contract) {
                  return;
                }

                if (!contract.creator.address_is_contract) {
                  const now = new Date();
                  await this._dbClient.wallet.upsert({
                    create: {
                      address: contract.creator.address,
                      lastUpdate: now
                    },
                    where: {
                      address: contract.creator.address
                    },
                    update: {}
                  });
                }

                this.enqueueIfNotLoaded(
                  contract.creator.address_is_contract ? 'contract' : 'wallet',
                  {
                    target: contract.creator.address,
                    parseNested: true
                  }
                );

                const data = {
                  address: contractAddress,
                  description: contract.description,
                  name: contract.name,
                  token: contract.tokenInfo as object,
                  creatorAddress: contract.creator.address_is_contract
                    ? contract.creator.address
                    : undefined,
                  vip: contract.vip,
                  balance: contract.balance,
                  balanceInUsd: contract.balanceInUsd,
                  balanceWithTokens: contract.balanceWithTokens,
                  trxCount: contract.trxCount,
                  dateCreated: new Date(contract.date_created)
                };

                this._dbClient.contract
                  .upsert({
                    create: {
                      ...data
                    },
                    update: {
                      ...data
                    },
                    where: {
                      address: data.address
                    }
                  })
                  .catch(() => null);

                this.enqueueTransactionsIfNotLoaded({
                  target: contractAddress,
                  parseNested: true
                });
              } catch (error) {
                console.log((error as Error).message);
              }
            })
            .catch(error => console.log((error as Error).message));
        } catch (error) {
          console.log((error as Error).message);
        }
      }
    );

    this._queue.process(
      'track-wallets',
      async (job: { data: { delay: number } }) => {
        try {
          this.resetLoaded();
          this.resetDate();

          const wallets = await this._dbClient.wallet.findMany({
            select: {
              address: true
            }
          });

          wallets.forEach(wallet => {
            this.enqueueIfNotLoaded('wallet', {
              target: wallet.address,
              parseNested: false
            });
          });
        } catch (error) {
          console.log((error as Error).message);
        } finally {
          this._queue
            .create('track-wallets', {
              delay: job.data.delay,
              parseNested: true
            })
            .priority('high')
            .delay(new Date(Date.now() + job.data.delay * 60 * 1000))
            .save();
        }
      }
    );
  }

  /**
   * Добавляет задачу для получения связанных с target транзакций, если это еще не было сделано
   * @param params параметры задачи
   */
  public enqueueTransactionsIfNotLoaded(params: JobParams) {
    if (!this._loaded.transactions.includes(params.target)) {
      this._loaded.transactions.push(params.target);
      this.enqueue('transactions', params);
    }
  }

  /**
   * Добавляет задачу в очередь, если target не был уже отправлен в работу
   * @param jobName название задачи
   * @param params параметры задачи
   */
  public enqueueIfNotLoaded(jobName: Jobs, params: JobParams) {
    if (!this._loaded.objects.includes(params.target)) {
      this._loaded.objects.push(params.target);
      this.enqueue(jobName, params);
    }
  }

  /**
   * Добавляет задачу в очередь
   * @param jobName название задачи
   * @param params параметры задачи
   */
  public enqueue(jobName: Jobs, params: JobParams) {
    const now = Date.now();

    const current = Atomics.load(this._lastDate, 0);
    const compare = current - BigInt(now);
    if (current - BigInt(now) > 0) {
      Atomics.add(this._lastDate, 0, 350n);
    } else {
      Atomics.exchange(
        this._lastDate,
        0,
        Math.abs(Number(compare)) >= 200 ? BigInt(now) : BigInt(now + 210)
      );
    }

    const date = new Date(Number(Atomics.load(this._lastDate, 0)));

    this._queue.create(jobName, params).priority('high').delay(date).save();
  }

  /**
   * Сбрасывает счетчик запущенных задач
   */
  public resetDate(): void {
    Atomics.exchange(this._lastDate, 0, 0n);
  }

  /**
   * Сбрасывает список обработанных объектов
   */
  public resetLoaded(): void {
    this._loaded = {
      objects: [],
      transactions: []
    };
  }

  /**
   * Выгружает указанные контракты через API в базу данных
   * @param contracts список адресов контрактов
   */
  public getContracts(contracts: Array<string>) {
    contracts.forEach(contract => {
      this.enqueueIfNotLoaded('contract', {
        target: contract
      });
    });
  }

  public trackWallets(delay: number) {
    this._queue
      .create('track-wallets', {
        delay
      })
      .priority('high')
      .save();
  }
}

export default TronScanAPIWorker;

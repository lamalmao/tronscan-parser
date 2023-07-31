/* eslint-disable no-case-declarations */
import { config } from 'dotenv';
import TronScanAPIParser from './fetcher/index.js';
import { PrismaClient } from '@prisma/client';
import TronScanAPIWorker from './worker/index.js';
import fs from 'fs';
import path from 'path';

(async () => {
  if (process.argv.length === 2) {
    console.log(
      `\x1b[33myarn start [from-file {filename}/from-db] \nyarn start track-wallets {delay (minutes)}\x1b[0m`
    );
    process.exit(0);
  }

  config();
  const apiKey = process.env['API_KEY'] as string | undefined;
  if (!apiKey) {
    throw new Error('TronScan API key not loaded');
  }

  const dispatcher = process.env['KUE_DISPATCHER']
    ? process.env['KUE_DISPATCHER'] === 'on'
      ? true
      : false
    : false;

  const dbClient = new PrismaClient();
  await dbClient.$connect();

  const worker = new TronScanAPIWorker(
    new TronScanAPIParser(apiKey),
    dbClient,
    {
      host: 'localhost',
      port: 6379
    },
    dispatcher
  );

  let contracts: Array<string> = [];
  switch (process.argv[2]) {
    case 'from-file':
      const filename = process.argv[3];
      if (!filename) {
        console.log('Specify the file');
        process.exit(0);
      }

      const filePath = path.resolve(filename);
      if (!fs.existsSync(filePath)) {
        console.log('File not found');
        process.exit(0);
      }

      const data = fs.readFileSync(path.resolve(filename)).toString();
      contracts = data.split(/\s/g);
      if (contracts.length === 0) {
        console.log('No data specified');
        process.exit(0);
      }

      for (const contract of contracts) {
        worker.enqueueIfNotLoaded('contract', {
          target: contract
        });
      }
      worker.getContracts(contracts);
      break;
    case 'from-db':
      const contractsInstances = await dbClient.contract.findMany({
        select: {
          address: true
        }
      });
      for (const contractsInstance of contractsInstances) {
        contracts.push(contractsInstance.address);
      }
      worker.getContracts(contracts);
      break;
    case 'track-wallets':
      const delay = Number(process.argv[3]);
      if (Number.isNaN(delay)) {
        console.log('Task delay not provided');
        process.exit(0);
      }

      worker.trackWallets(delay);
      break;
    default:
      console.log('Unknown command');
      process.exit(0);
  }
})();

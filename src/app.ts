import { config } from 'dotenv';
import TronAPIParser from './fetcher/index.js';

// const requestQueue = (
//   func: (...any) => unknown,
//   params: Parameters<typeof func>,
//   interval = 200
// ) => {
//   const result = new Promise(resolve => {
//     let i = 0;
//     const timer = setInterval(() => {
//       if (i === params.length) {
//         clearInterval(timer);
//         resolve(params);
//       }
//       func(params[i]);
//       i++;
//     }, interval);
//   });

//   return result;
// };

(async () => {
  config();
  const apiKey = process.env['API_KEY'] as string | undefined;
  if (!apiKey) {
    throw new Error('TronScan API key not loaded');
  }

  const contracts = [
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t',
    'TThzxNRLrW2Brp9DcTQU8i4Wd9udCWEdZ3',
    'TBwVjuct1dTMQsYbXeEBmY5NbRQCLcsT1n',
    'TZ7trrn98aT26UGTLUSieq2GRfwjfmn7Lq',
    'TEkxiTehnzSmSe2XqrBj4w32RUN966rdz8',
    'TRwptGFfX3fuffAMbWDDLJZAZFmP6bGfqL',
    'TGMQP9qdoX6vn3xCoP9p4tWMDz98PrgmKX',
    'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t'
  ];
  const parser = new TronAPIParser(apiKey);
  parser.getContract(contracts[0]);
  // requestQueue(parser.getContract, contracts);
})();

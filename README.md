## TronScan API Парсер

### Настройка:

Файл .env:

```env
DATABASE_URL="mysql://user:password@host:port/db"
API_KEY="TRON-API-KEY"
REDIS="redis://localhost:6379"
KUE_DISPATCHER="on" # Запускает сервер с отображением задач Kue
```

### Установка

> yarn install
> yarn run generate
> yarn run build

### Запуск

> yarn start from-file {filename}

Загружает из указанного файла список контрактов и парсит их. Контракты указываются через пробел или перенос строки.

> yarn start from-db

Парсит контракты, имеющиеся в базе данных

> yarn start track-wallets {delay}

Раз в {delay} минут парсит кошельки, находящиеся в базе данных, обновляет информацию и делает снапшоты.

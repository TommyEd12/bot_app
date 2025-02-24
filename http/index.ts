const axios = require("axios").default;
export const instance = axios.create({
  baseURL: "https://rest.coinapi.io/v1",
  timeout: 5000,
  headers: { Accept: "text/plain", "X-CoinAPI-Key": "70ac55a0-d7bf-489f-86ce-877e6c69d368" },
});
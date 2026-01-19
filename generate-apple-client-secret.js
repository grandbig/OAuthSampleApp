require("dotenv").config({ path: ".env.local" });
const jwt = require("jsonwebtoken");
const fs = require("fs");

// 環境変数から Apple Developer 情報を取得
const TEAM_ID = process.env.APPLE_TEAM_ID;
const SERVICE_ID = process.env.APPLE_SERVICE_ID;
const KEY_ID = process.env.APPLE_KEY_ID;
const PRIVATE_KEY_PATH = process.env.APPLE_PRIVATE_KEY_PATH;

// 必須の環境変数をチェック
if (!TEAM_ID || !SERVICE_ID || !KEY_ID) {
  console.error("エラー: .env.local に必要な環境変数が設定されていません");
  console.error(
    "必要な環境変数: APPLE_TEAM_ID, APPLE_SERVICE_ID, APPLE_KEY_ID"
  );
  process.exit(1);
}

// .p8 ファイルを読み込む
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, "utf8");

// Client Secret JWT を生成（推奨方法: optionsにクレームを渡す）
const token = jwt.sign({}, privateKey, {
  algorithm: "ES256",
  keyid: KEY_ID,
  issuer: TEAM_ID,
  audience: "https://appleid.apple.com",
  subject: SERVICE_ID,
  expiresIn: "180d",
});

// 有効期限を取得（デバッグ用）
const decoded = jwt.decode(token);
const expirationDate = new Date(decoded.exp * 1000);

console.log("=== Apple Client Secret JWT ===");
console.log(token);
console.log("\n生成時刻:", new Date(decoded.iat * 1000).toISOString());
console.log("有効期限:", expirationDate.toISOString());
console.log("\n.env に以下を追加してください:");
console.log(`EXPO_PUBLIC_APPLE_CLIENT_SECRET=${token}`);

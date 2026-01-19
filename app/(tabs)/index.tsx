import { Image } from "expo-image";
import { Button, Platform, StyleSheet, View } from "react-native";

import ParallaxScrollView from "@/components/parallax-scroll-view";
import { ThemedView } from "@/components/themed-view";
import {
  appleAuth,
  appleAuthAndroid,
  AppleButton,
} from "@invertase/react-native-apple-authentication";
import { isSignatureValid } from "@pagopa/io-react-native-jwt";
import {
  CodeChallengeMethod,
  makeRedirectUri,
  useAuthRequest,
} from "expo-auth-session";
import * as Crypto from "expo-crypto";
import { useEffect } from "react";
import "react-native-get-random-values";
import { v4 as uuid } from "uuid";

const discovery = {
  authorizationEndpoint: "https://github.com/login/oauth/authorize",
  tokenEndpoint: "https://github.com/login/oauth/access_token",
  revocationEndpoint: `https://github.com/settings/connections/applications/${process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID!}`,
};

const redirectUri = makeRedirectUri({
  scheme: process.env.EXPO_PUBLIC_REDIRECT_URI_SCHEME,
});

export default function HomeScreen() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID!,
      scopes: ["user:email"],
      redirectUri: redirectUri,
      responseType: "code",
      usePKCE: true,
      codeChallengeMethod: CodeChallengeMethod.S256,
    },
    discovery
  );

  const exchangeCodeForToken = async (code: string, codeVerifier: string) => {
    try {
      const params = new URLSearchParams({
        client_id: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID!,
        client_secret: process.env.EXPO_PUBLIC_GITHUB_CLIENT_SECRET!,
        code: code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
        codeChallengeMethod: CodeChallengeMethod.S256,
      });

      const tokenResponse = await fetch(discovery.tokenEndpoint, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(), //JSON.stringify(bodyParams),
      });

      const tokenData = await tokenResponse.json();
      console.log("Token Response:", tokenData);

      // エラーチェック（GitHubはエラー時もJSONを返すことがあるため）
      if (tokenData.error) {
        console.log("GitHub Error:", tokenData.error_description);
        return;
      }

      if (tokenData.access_token) {
        console.log(`tokenData: ${tokenData.access_token}`);
      }
    } catch (e) {
      console.error("Token Exchange Error:", e);
    }
  };

  useEffect(() => {
    if (request) {
      console.log("--------------------------------------------------");
      console.log("★ 生成された認可URL:");
      console.log(request.url); // ← これがブラウザで開かれるURLです
      console.log("--------------------------------------------------");
    }
    if (response?.type === "success") {
      const { code } = response.params;
      if (request?.codeVerifier) {
        exchangeCodeForToken(code, request.codeVerifier);
      }
    } else {
      console.log(`errorCode: ${response?.type}`);
    }
  }, [response, request]);

  // Apple Authorization Code をAccess Tokenに交換（開発・テスト用のみ）
  const exchangeAppleCodeForToken = async (code: string) => {
    console.log("=== Apple Token Exchange (Development Only) ===");
    console.warn(
      "⚠️ WARNING: This should ONLY be used for development/testing"
    );
    console.warn(
      "⚠️ In production, ALWAYS exchange tokens on your backend server"
    );

    try {
      console.log("Client ID:", process.env.EXPO_PUBLIC_APPLE_SERVICE_ID);
      console.log("Authorization Code length:", code.length);
      console.log(
        "Client Secret (JWT) length:",
        process.env.EXPO_PUBLIC_APPLE_CLIENT_SECRET?.length
      );

      const params = new URLSearchParams({
        client_id: process.env.EXPO_PUBLIC_APPLE_SERVICE_ID!,
        client_secret: process.env.EXPO_PUBLIC_APPLE_CLIENT_SECRET!,
        code: code,
        grant_type: "authorization_code",
        redirect_uri: process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI!,
      });

      console.log("Request params:", params.toString());
      console.log("Requesting token from Apple...");

      const tokenResponse = await fetch(
        "https://appleid.apple.com/auth/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params.toString(),
        }
      );

      console.log("Response status:", tokenResponse.status);
      const responseText = await tokenResponse.text();
      console.log("Raw response:", responseText);

      let tokenData;
      try {
        tokenData = JSON.parse(responseText);
      } catch (e) {
        console.error("❌ Failed to parse response as JSON:", e);
        console.error("Response was:", responseText);
        return null;
      }

      if (tokenData.error) {
        console.error("❌ Apple Token Error:", tokenData.error);
        console.error(
          "Error Description:",
          tokenData.error_description || "No description provided"
        );
        console.error(
          "Full error response:",
          JSON.stringify(tokenData, null, 2)
        );
        return null;
      }

      console.log("✅ Token Exchange Success!");
      console.log("Access Token:", tokenData.access_token);
      console.log("ID Token:", tokenData.id_token);
      console.log("Refresh Token:", tokenData.refresh_token);
      console.log("Expires In:", tokenData.expires_in, "seconds");

      return tokenData;
    } catch (error) {
      console.error("❌ Token Exchange Error:", error);
      return null;
    }
  };

  // Apple JWT検証関数（開発・テスト用）
  const verifyAppleJWT = async (
    identityToken: string,
    rawNonce: string,
    originalState: string
  ) => {
    console.log("=== Apple JWT Verification (Development Only) ===");

    try {
      // 1. JWTをデコード（ヘッダーとペイロード）
      const parts = identityToken.split(".");
      const header = JSON.parse(atob(parts[0]));
      const payload = JSON.parse(atob(parts[1]));

      console.log("JWT Header:", header);
      console.log("JWT Payload:", payload);

      // 2. Appleの公開鍵を取得
      const jwksResponse = await fetch("https://appleid.apple.com/auth/keys");
      const jwks = await jwksResponse.json();
      console.log("Apple JWKS:", jwks);

      // 3. kidに一致する公開鍵を探す
      const key = jwks.keys.find((k: any) => k.kid === header.kid);
      if (!key) {
        throw new Error(`Public key not found for kid: ${header.kid}`);
      }
      console.log("Matching Public Key:", key);

      // 4. JWT署名を検証
      const isValid = await isSignatureValid(identityToken, key);
      console.log(`✅ Signature Valid: ${isValid}`);

      // 5. nonceを検証
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // デバッグ: nonce情報を詳細出力
      console.log("\n--- Nonce Debug Info ---");
      console.log("Raw Nonce:", rawNonce);
      console.log("Hashed Nonce (computed):", hashedNonce);
      console.log("Hashed Nonce length:", hashedNonce.length);
      console.log("JWT Payload Nonce:", payload.nonce);
      console.log("JWT Payload Nonce length:", payload.nonce?.length);
      console.log("Nonces equal:", payload.nonce === hashedNonce);
      console.log(
        "Nonces equal (lowercase):",
        payload.nonce === hashedNonce.toLowerCase()
      );
      console.log("------------------------\n");

      const nonceMatches = payload.nonce === hashedNonce.toLowerCase();
      console.log(`✅ Nonce Matches: ${nonceMatches}`);

      // 6. 基本的なクレーム検証
      const now = Math.floor(Date.now() / 1000);
      const issuerValid = payload.iss === "https://appleid.apple.com";
      const audienceValid =
        payload.aud === process.env.EXPO_PUBLIC_APPLE_SERVICE_ID;
      const notExpired = payload.exp > now;

      console.log(`✅ Issuer Valid: ${issuerValid} (${payload.iss})`);
      console.log(`✅ Audience Valid: ${audienceValid} (${payload.aud})`);
      console.log(
        `✅ Not Expired: ${notExpired} (exp: ${new Date(payload.exp * 1000).toISOString()})`
      );
      console.log(`✅ Subject (User ID): ${payload.sub}`);
      console.log(`✅ Email: ${payload.email || "N/A"}`);

      // 7. 総合判定
      const allValid =
        isValid && nonceMatches && issuerValid && audienceValid && notExpired;

      console.log("\n=== Verification Result ===");
      console.log(`🎯 Overall Valid: ${allValid}`);

      if (allValid) {
        console.log("✅ ALL CHECKS PASSED - Token is valid!");
      } else {
        console.warn("⚠️ VERIFICATION FAILED - Token has issues");
      }

      console.warn("\n⚠️ WARNING: This is for DEVELOPMENT TESTING ONLY");
      console.warn(
        "⚠️ NEVER rely solely on client-side verification in production"
      );
      console.warn("⚠️ Always verify tokens on your backend server");

      return {
        valid: allValid,
        signature: isValid,
        nonce: nonceMatches,
        issuer: issuerValid,
        audience: audienceValid,
        notExpired,
        payload,
      };
    } catch (error) {
      console.error("❌ JWT Verification Error:", error);
      return { valid: false, error };
    }
  };

  // iOS用のApple Sign In
  const handleAppleSignInIOS = async () => {
    try {
      // 1. セキュアなランダム値を生成
      const rawNonce = uuid();
      const state = uuid();

      // 2. nonceをSHA-256でハッシュ化
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce
      );

      // 3. Apple認証リクエストを実行
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
        nonce: hashedNonce, // SHA-256ハッシュ化したnonceを送信
        state, // CSRF対策用のstate
      });

      // 4. 認証状態を確認
      const credentialState = await appleAuth.getCredentialStateForUser(
        appleAuthRequestResponse.user
      );

      if (credentialState === appleAuth.State.AUTHORIZED) {
        console.log("Apple Auth (iOS) Success:", appleAuthRequestResponse);
        console.log("Raw Nonce (for backend verification):", rawNonce);
        console.log("State (for backend verification):", state);

        // 開発用: アプリ側でJWT検証を実行
        if (appleAuthRequestResponse.identityToken) {
          await verifyAppleJWT(
            appleAuthRequestResponse.identityToken,
            rawNonce,
            state
          );
        }

        // 開発用: Authorization Code を Access Token に交換
        if (appleAuthRequestResponse.authorizationCode) {
          console.log("\n🔄 Exchanging authorization code for access token...");
          await exchangeAppleCodeForToken(
            appleAuthRequestResponse.authorizationCode
          );
        }

        // バックエンドに送信するデータ:
        // - appleAuthRequestResponse.identityToken (JWT)
        // - appleAuthRequestResponse.authorizationCode (authorization code)
        // - rawNonce (バックエンドでハッシュ化して検証用)
        // - state (CSRF対策用、appleAuthRequestResponse.stateと一致確認)
      }
    } catch (error) {
      console.error("Apple Sign In Error (iOS):", error);
    }
  };

  // Android用のApple Sign In
  const handleAppleSignInAndroid = async () => {
    try {
      // 1. セキュアなランダム値を生成
      const rawNonce = uuid();
      const state = uuid();

      console.log("=== Android Sign In Setup ===");
      console.log("Generated Raw Nonce:", rawNonce);
      console.log("Generated State:", state);

      // 2. ライブラリがSHA-256ハッシュ化するため、rawNonceをそのまま渡す
      console.log("⚠️ Passing RAW nonce to library (library will hash it)");

      // 3. Apple認証を設定
      appleAuthAndroid.configure({
        clientId: process.env.EXPO_PUBLIC_APPLE_SERVICE_ID!,
        redirectUri: process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI!,
        responseType: appleAuthAndroid.ResponseType.ALL,
        scope: appleAuthAndroid.Scope.ALL,
        nonce: rawNonce, // ライブラリが内部でSHA-256ハッシュ化する
        state,
      });

      console.log("✅ Android configure() completed");

      // 4. サインインを実行
      const response = await appleAuthAndroid.signIn();
      console.log("Apple Auth (Android) Success:", response);
      console.log("Raw Nonce (for verification):", rawNonce);
      console.log("State (for verification):", state);

      // 開発用: アプリ側でJWT検証を実行
      if (response.id_token) {
        console.log("\n🔍 Starting JWT verification with rawNonce:", rawNonce);
        await verifyAppleJWT(response.id_token, rawNonce, state);
      }

      // 開発用: Authorization Code を Access Token に交換
      if (response.code) {
        console.log("\n🔄 Exchanging authorization code for access token...");
        await exchangeAppleCodeForToken(response.code);
      }

      // バックエンドに送信するデータ:
      // - response.id_token (JWT)
      // - response.code (authorization code)
      // - rawNonce (バックエンドでハッシュ化して検証用)
      // - state (CSRF対策用)
    } catch (error) {
      console.error("Apple Sign In Error (Android):", error);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: "#A1CEDC", dark: "#1D3D47" }}
      headerImage={
        <Image
          source={require("@/assets/images/partial-react-logo.png")}
          style={styles.reactLogo}
        />
      }
    >
      <ThemedView style={styles.stepContainer}>
        <Button
          disabled={!request}
          title="GitHub Apps OAuth認証"
          onPress={() => {
            promptAsync();
          }}
        />
        <View style={styles.container}>
          {Platform.OS === "ios" ? (
            <AppleButton
              buttonStyle={AppleButton.Style.BLACK}
              buttonType={AppleButton.Type.SIGN_IN}
              style={styles.button}
              onPress={handleAppleSignInIOS}
            />
          ) : Platform.OS === "android" && appleAuthAndroid.isSupported ? (
            <AppleButton
              buttonStyle={AppleButton.Style.BLACK}
              buttonType={AppleButton.Type.SIGN_IN}
              style={styles.button}
              onPress={handleAppleSignInAndroid}
            />
          ) : null}
        </View>
      </ThemedView>
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  titleContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  stepContainer: {
    gap: 8,
    marginBottom: 8,
  },
  reactLogo: {
    height: 178,
    width: 290,
    bottom: 0,
    left: 0,
    position: "absolute",
  },
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  button: {
    width: 200,
    height: 44,
  },
});

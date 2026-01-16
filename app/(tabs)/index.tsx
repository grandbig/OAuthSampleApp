import { Image } from 'expo-image';
import { Button, Platform, StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import { appleAuth, appleAuthAndroid, AppleButton } from '@invertase/react-native-apple-authentication';
import { CodeChallengeMethod, makeRedirectUri, useAuthRequest } from "expo-auth-session";
import { useEffect } from 'react';
import 'react-native-get-random-values';
import { v4 as uuid } from 'uuid';

const discovery = {
  authorizationEndpoint: 'https://github.com/login/oauth/authorize',
  tokenEndpoint: 'https://github.com/login/oauth/access_token',
  revocationEndpoint: `https://github.com/settings/connections/applications/${process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID!}`,
};

const redirectUri = makeRedirectUri({
  scheme: process.env.EXPO_PUBLIC_REDIRECT_URI_SCHEME,
});

export default function HomeScreen() {
  const [request, response, promptAsync] = useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID!,
      scopes: ['user:email'],
      redirectUri: redirectUri,
      responseType: 'code',
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
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          // 'Content-Type': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),//JSON.stringify(bodyParams),
      });

      const tokenData = await tokenResponse.json();
      console.log('Token Response:', tokenData);

      // エラーチェック（GitHubはエラー時もJSONを返すことがあるため）
      if (tokenData.error) {
        console.log('GitHub Error:', tokenData.error_description);
        return;
      }

      if (tokenData.access_token) {
        console.log(`tokenData: ${tokenData.access_token}`);
      }
    } catch (e) {
      console.error('Token Exchange Error:', e);
    }
  };

  useEffect(() => {
    if (request) {
      console.log('--------------------------------------------------');
      console.log('★ 生成された認可URL:');
      console.log(request.url); // ← これがブラウザで開かれるURLです
      console.log('--------------------------------------------------');
    }
    if (response?.type === 'success') {
      const { code } = response.params;
      if (request?.codeVerifier) {
        exchangeCodeForToken(code, request.codeVerifier);
      }
    } else {
      console.log(`errorCode: ${response?.type}`);
    }
  }, [response, request]);

  // iOS用のApple Sign In
  const handleAppleSignInIOS = async () => {
    try {
      // 1. Apple認証リクエストを実行
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      // 2. 認証状態を確認
      const credentialState = await appleAuth.getCredentialStateForUser(
        appleAuthRequestResponse.user
      );

      if (credentialState === appleAuth.State.AUTHORIZED) {
        console.log('Apple Auth (iOS) Success:', appleAuthRequestResponse);
        // appleAuthRequestResponse.identityToken をバックエンドに送信
      }
    } catch (error) {
      console.error('Apple Sign In Error (iOS):', error);
    }
  };

  // Android用のApple Sign In
  const handleAppleSignInAndroid = async () => {
    try {
      // 1. セキュアなランダム値を生成
      const rawNonce = uuid();
      const state = uuid();

      // 2. Apple認証を設定
      appleAuthAndroid.configure({
        clientId: process.env.EXPO_PUBLIC_APPLE_SERVICE_ID!,
        redirectUri: process.env.EXPO_PUBLIC_APPLE_REDIRECT_URI!,
        responseType: appleAuthAndroid.ResponseType.ALL,
        scope: appleAuthAndroid.Scope.ALL,
        nonce: rawNonce,
        state,
      });

      // 3. サインインを実行
      const response = await appleAuthAndroid.signIn();
      console.log('Apple Auth (Android) Success:', response);
      // response.id_token または response.code をバックエンドに送信
    } catch (error) {
      console.error('Apple Sign In Error (Android):', error);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#A1CEDC', dark: '#1D3D47' }}
      headerImage={
        <Image
          source={require('@/assets/images/partial-react-logo.png')}
          style={styles.reactLogo}
        />
      }>
      <ThemedView style={styles.stepContainer}>
        <Button
          disabled={!request}
          title="GitHub Apps OAuth認証"
          onPress={() => {
            promptAsync();
          }}
        />
        <View style={styles.container}>
          {Platform.OS === 'ios' ? (
            <AppleButton
              buttonStyle={AppleButton.Style.BLACK}
              buttonType={AppleButton.Type.SIGN_IN}
              style={styles.button}
              onPress={handleAppleSignInIOS}
            />
          ) : Platform.OS === 'android' && appleAuthAndroid.isSupported ? (
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
    flexDirection: 'row',
    alignItems: 'center',
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
    position: 'absolute',
  },
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    width: 200,
    height: 44,
  },
});
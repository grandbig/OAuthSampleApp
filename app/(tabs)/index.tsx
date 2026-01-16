import { Image } from 'expo-image';
import { Button, StyleSheet, View } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { ThemedView } from '@/components/themed-view';
import * as AppleAuthentication from 'expo-apple-authentication';
import { CodeChallengeMethod, makeRedirectUri, useAuthRequest } from "expo-auth-session";
import { useEffect } from 'react';

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
          <AppleAuthentication.AppleAuthenticationButton
            buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
            buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
            cornerRadius={5}
            style={styles.button}
            onPress={async () => {
              try {
                const credential = await AppleAuthentication.signInAsync({
                  requestedScopes: [],
                });
                // 成功時の処理
                console.log(credential);
                // credential.identityToken をバックエンドに送る
              } catch (error) {
                console.log(error);
              }
            }}
          />
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
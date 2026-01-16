import { Button, StyleSheet } from 'react-native';

import ParallaxScrollView from '@/components/parallax-scroll-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { GoogleSignin } from '@react-native-google-signin/google-signin';

export default function TabTwoScreen() {
  const exchangeCodeForToken = async (serverAuthCode: string) => {
    try {
      console.log(`code: ${serverAuthCode}, client_id: ${process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!}, client_secret: ${process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_SECRET!}`);
      const params = new URLSearchParams({
        code: serverAuthCode,
        client_id: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID!,
        client_secret: process.env.EXPO_PUBLIC_GOOGLE_CLIENT_SECRET!,
        redirect_uri: 'https://www.google.com', // モバイルアプリの場合は空文字列 or WEBのredirect_uri
        grant_type: 'authorization_code',
      });

      console.log('トークン交換リクエスト送信中...');
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const tokenData = await tokenResponse.json();

      // エラーチェック
      if (tokenData.error) {
        console.error('Google Error:', tokenData.error_description || tokenData.error);
        return;
      }

      console.log('✅ トークン取得成功!');
      console.log('Access Token:', tokenData.access_token);
      console.log('Refresh Token:', tokenData.refresh_token);
      console.log('ID Token:', tokenData.id_token);
      console.log('Expires In:', tokenData.expires_in, '秒');

      return tokenData;
    } catch (error) {
      console.error('Token Exchange Error:', error);
    }
  };

  return (
    <ParallaxScrollView
      headerBackgroundColor={{ light: '#D0D0D0', dark: '#353636' }}
      headerImage={
        <IconSymbol
          size={310}
          color="#808080"
          name="chevron.left.forwardslash.chevron.right"
          style={styles.headerImage}
        />
      }>
      <Button
        // disabled={!request}
        title="Google OAuth認証"
        onPress={async () => {
          // promptAsync();
          try {
            const userInfo = await GoogleSignin.signIn();
            console.log('User Info:', userInfo);

            // serverAuthCodeが取得できた場合、トークン交換を実行
            // @ts-ignore - serverAuthCodeはドキュメントに記載されているが型定義に含まれていない
            if (userInfo.data?.serverAuthCode) {
              // @ts-ignore
              console.log('Server Auth Code:', userInfo.data.serverAuthCode);
              // @ts-ignore
              await exchangeCodeForToken(userInfo.data.serverAuthCode);
            } else {
              console.log('⚠️ serverAuthCodeが取得できませんでした');
              console.log('userInfo全体:', JSON.stringify(userInfo, null, 2));
            }
          } catch (error) {
            console.log(error);
          }
        }}
      />
    </ParallaxScrollView>
  );
}

const styles = StyleSheet.create({
  headerImage: {
    color: '#808080',
    bottom: -90,
    left: -35,
    position: 'absolute',
  },
  titleContainer: {
    flexDirection: 'row',
    gap: 8,
  },
});

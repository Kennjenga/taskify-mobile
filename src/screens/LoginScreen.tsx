import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { RootStackParamList } from '../navigation/RootNavigator';
import { useAuthStore } from '../store/authStore';
import { COLORS, SPACING, ROUNDED } from '../utils/theme';

WebBrowser.maybeCompleteAuthSession();

type Props = NativeStackScreenProps<RootStackParamList, 'Login'>;

export default function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailFocus, setEmailFocus] = useState(false);
  const [passwordFocus, setPasswordFocus] = useState(false);

  const { login, socialLogin, isLoading, error, clearError } = useAuthStore();

  // Hook up GitHub AuthSession
  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: process.env.EXPO_PUBLIC_GITHUB_CLIENT_ID || '',
      scopes: ['read:user', 'user:email'],
      redirectUri: AuthSession.makeRedirectUri({
        scheme: 'taskify',
      }),
    },
    {
      authorizationEndpoint: 'https://github.com/login/oauth/authorize',
      tokenEndpoint: 'https://github.com/login/oauth/access_token',
    }
  );

  React.useEffect(() => {
    if (response?.type === 'success' && response.params?.code) {
      const { code } = response.params;
      handleGitHubOAuthSuccess(code);
    }
  }, [response]);

  const handleGitHubOAuthSuccess = async (code: string) => {
    try {
      await socialLogin('github', { code });
    } catch (e: any) {
      Alert.alert('GitHub Login Error', e.message || 'Failed to authenticate via GitHub OAuth.');
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Validation Error', 'Please fill in all fields.');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      Alert.alert('Validation Error', 'Please enter a valid email address.');
      return;
    }

    try {
      await login(email.trim(), password);
    } catch (e: any) {
      Alert.alert('Login Error', e.message || 'Unable to authenticate.');
    }
  };

  const handleSocialLogin = async () => {
    try {
      const result = await promptAsync();
      if (result?.type !== 'success') {
        Alert.alert('Authentication Info', 'GitHub authentication flow closed or cancelled.');
      }
    } catch (e: any) {
      Alert.alert('OAuth Error', e.message || 'Failed to start GitHub OAuth flow.');
    }
  };

  return (
    <LinearGradient colors={[COLORS.background, COLORS.card]} style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardContainer}
      >
        <ScrollView contentContainerStyle={styles.scrollContainer} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Text style={styles.logo}>Taskify</Text>
            <Text style={styles.subtitle}>Streamline your daily operations</Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.label}>Email Address</Text>
            <TextInput
              style={[
                styles.input,
                emailFocus && styles.inputFocused,
                !!error && styles.inputError,
              ]}
              placeholder="Enter your email"
              placeholderTextColor={COLORS.textSecondary}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (error) clearError();
              }}
              autoCapitalize="none"
              keyboardType="email-address"
              onFocus={() => setEmailFocus(true)}
              onBlur={() => setEmailFocus(false)}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              style={[
                styles.input,
                passwordFocus && styles.inputFocused,
                !!error && styles.inputError,
              ]}
              placeholder="Enter your password"
              placeholderTextColor={COLORS.textSecondary}
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (error) clearError();
              }}
              secureTextEntry
              onFocus={() => setPasswordFocus(true)}
              onBlur={() => setPasswordFocus(false)}
            />

            {!!error && <Text style={styles.errorText}>{error}</Text>}

            <TouchableOpacity
              style={styles.button}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.buttonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <View style={styles.registerLinkContainer}>
              <Text style={styles.registerText}>Don't have an account? </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={styles.registerLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>or continue with</Text>
            <View style={styles.divider} />
          </View>

          <View style={styles.socialButtonsContainer}>
            <TouchableOpacity
              style={styles.socialButton}
              onPress={handleSocialLogin}
            >
              <Text style={styles.socialButtonText}>GitHub</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xl,
  },
  logo: {
    fontSize: 40,
    fontWeight: 'bold',
    color: COLORS.text,
    letterSpacing: 1.5,
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginTop: SPACING.xs,
  },
  form: {
    backgroundColor: 'rgba(26, 24, 36, 0.4)',
    borderRadius: ROUNDED.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
    marginTop: SPACING.md,
  },
  input: {
    backgroundColor: COLORS.inputBg,
    borderRadius: ROUNDED.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.md,
    fontSize: 16,
  },
  inputFocused: {
    borderColor: COLORS.borderFocus,
  },
  inputError: {
    borderColor: COLORS.error,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    marginTop: SPACING.md,
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: ROUNDED.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
    marginTop: SPACING.xl,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  registerLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACING.lg,
  },
  registerText: {
    color: COLORS.textSecondary,
    fontSize: 14,
  },
  registerLink: {
    color: COLORS.primaryLight,
    fontWeight: '600',
    fontSize: 14,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: SPACING.xl,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: COLORS.border,
  },
  dividerText: {
    color: COLORS.textSecondary,
    paddingHorizontal: SPACING.md,
    fontSize: 14,
  },
  socialButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  socialButton: {
    flex: 1,
    backgroundColor: COLORS.card,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: ROUNDED.md,
    paddingVertical: SPACING.md,
    alignItems: 'center',
  },
  socialButtonText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 16,
  },
});

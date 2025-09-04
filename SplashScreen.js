import React, { useEffect } from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

export default function SplashScreen({ navigation }) {
  useEffect(() => {
    const timer = setTimeout(() => {
      navigation.replace('MainTabs');
    }, 2000); // Show for 2 seconds
    return () => clearTimeout(timer);
  }, [navigation]);
  return (
    <View style={styles.splashContainer}>
      <Image
        source={require('./assets/splash.png')}
        style={styles.splashImage}
        resizeMode="contain"
      />
      <Text style={styles.splashText}>Pole Vault Tracker 1.0</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  splashImage: {
    width: 180,
    height: 180,
    marginBottom: 30,
  },
  splashText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#222',
  },
});
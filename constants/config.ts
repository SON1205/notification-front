import Constants from 'expo-constants';

const ENV = {
  dev: {
    API_BASE_URL: 'http://localhost:8080',
  },
  prod: {
    API_BASE_URL: 'https://api.example.com',
  },
};

const getEnvVars = () => {
  const releaseChannel = Constants.expoConfig?.extra?.releaseChannel ?? 'dev';
  if (releaseChannel === 'prod') return ENV.prod;
  return ENV.dev;
};

export const config = getEnvVars();

const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  const resolver = defaultResolveRequest || context.resolveRequest;

  // Package exports in isows are incompatible with the React Native bundle.
  if (moduleName === 'isows') {
    const scopedContext = {
      ...context,
      unstable_enablePackageExports: false,
    };
    return resolver(scopedContext, moduleName, platform);
  }

  // Zustand v4 package exports can resolve to an incompatible entrypoint.
  if (moduleName.startsWith('zustand')) {
    const scopedContext = {
      ...context,
      unstable_enablePackageExports: false,
    };
    return resolver(scopedContext, moduleName, platform);
  }

  // Force the browser-compatible JOSE build used by Privy's token handling.
  if (moduleName === 'jose') {
    const scopedContext = {
      ...context,
      unstable_conditionNames: ['browser'],
    };
    return resolver(scopedContext, moduleName, platform);
  }

  return resolver(context, moduleName, platform);
};

module.exports = config;

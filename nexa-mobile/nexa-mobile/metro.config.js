const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const defaultResolveRequest = config.resolver.resolveRequest;

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'isows') {
    const nextContext = {
      ...context,
      unstable_enablePackageExports: false,
    };
    return nextContext.resolveRequest(nextContext, moduleName, platform);
  }

  if (moduleName.startsWith('zustand')) {
    const nextContext = {
      ...context,
      unstable_enablePackageExports: false,
    };
    return nextContext.resolveRequest(nextContext, moduleName, platform);
  }

  if (moduleName === 'jose') {
    const nextContext = {
      ...context,
      unstable_conditionNames: ['browser'],
    };
    return nextContext.resolveRequest(nextContext, moduleName, platform);
  }

  if (defaultResolveRequest) {
    return defaultResolveRequest(context, moduleName, platform);
  }

  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

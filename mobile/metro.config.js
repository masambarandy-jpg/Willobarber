const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// jspdf's package.json "exports" map resolves to its Node build by default,
// which contains an AMD `require(["html2canvas"], ...)` call Metro can't parse.
// Force the browser build instead, on every platform.
const defaultResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'jspdf') {
    return context.resolveRequest(
      { ...context, unstable_conditionNames: ['browser', 'require', 'import', 'default'] },
      moduleName,
      platform
    );
  }
  return defaultResolveRequest
    ? defaultResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = config;

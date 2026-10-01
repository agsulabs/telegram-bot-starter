const app = window.Telegram?.WebApp;
if (app) {
  const applyTheme = () => {
    document.documentElement.style.colorScheme = app.colorScheme;
  };
  applyTheme();
  app.onEvent('themeChanged', applyTheme);
  app.ready();
  app.expand();
}

module.exports = {
  title: '{{stackLabel}} Project',
  tagline: 'Built with Dev Harness',
  url: 'https://your-project.dev',
  baseUrl: '/',
  onBrokenLinks: 'throw',
  favicon: 'img/favicon.ico',
  organizationName: 'your-org',
  projectName: 'my-project',
  presets: [
    [
      'classic',
      {
        docs: { sidebarPath: './sidebars.js', editUrl: 'https://github.com/your-org/my-project/edit/main/' },
        theme: { customCss: './src/css/custom.css' },
      },
    ],
  ],
};

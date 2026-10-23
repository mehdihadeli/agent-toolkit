const basePath = process.env.DOCS_BASE_PATH ?? '';

export default {
  output: 'export',
  basePath,
  trailingSlash: true,
  images: {unoptimized: true},
};
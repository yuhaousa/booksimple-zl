/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  // Fix workspace root warning
  outputFileTracingRoot: '.',
  // Ensure compatibility with Edge Runtime
  serverExternalPackages: ['pdfjs-dist'],
  webpack: (config, { isServer }) => {
    // Handle PDF.js worker and Node.js compatibility
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        canvas: false,
        fs: false,
        crypto: false,
        stream: false,
        os: false,
        path: false,
      };
    }

    // Handle PDF.js and canvas
    config.externals = config.externals || [];
    config.externals.push({
      canvas: 'canvas',
    });

    // Ignore Node.js built-ins in client bundles
    config.resolve.alias = {
      ...config.resolve.alias,
      crypto: false,
    };

    // Add rule to handle .mjs files from pdfjs-dist
    config.module.rules.push({
      test: /\.mjs$/,
      include: /node_modules/,
      type: 'javascript/auto',
    });

    return config;
  },
}

export default nextConfig

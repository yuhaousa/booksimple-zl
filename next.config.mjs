import { dirname } from "node:path"
import { fileURLToPath } from "node:url"

const projectRoot = dirname(fileURLToPath(import.meta.url))

/** @type {import('next').NextConfig} */
const nextConfig = {
  // OpenNext handles worker output; standalone causes Windows symlink issues during build.
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
  outputFileTracingRoot: projectRoot,
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

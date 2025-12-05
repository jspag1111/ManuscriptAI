import { FlatCompat } from '@eslint/eslintrc';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  ...compat.extends('next', 'next/core-web-vitals'),
  {
    rules: {
      '@next/next/no-html-link-for-pages': 'off',
    },
  },
];

export default config;

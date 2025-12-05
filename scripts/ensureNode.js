const semverGte = (version, range) => {
  const normalize = (v) => v.replace(/^v/, '').split('.').map((part) => parseInt(part, 10));
  const [major, minor = 0, patch = 0] = normalize(version);
  const [reqMajor, reqMinor = 0, reqPatch = 0] = normalize(range);

  if (Number.isNaN(major) || Number.isNaN(reqMajor)) return false;
  if (major !== reqMajor) return major > reqMajor;
  if (minor !== reqMinor) return minor > reqMinor;
  return patch >= reqPatch;
};

const required = process.env.NODE_VERSION || '18.0.0';
const current = process.version;

if (!semverGte(current, required)) {
  console.error(`Node.js ${required}+ is required. Detected ${current}.`);
  process.exit(1);
}

if (!semverGte(current, '20.0.0')) {
  console.warn(`Node.js ${current} detected. Vercel recommends Node 20+ for Next.js functions.`);
}

console.log(`Node.js check passed: ${current}`);

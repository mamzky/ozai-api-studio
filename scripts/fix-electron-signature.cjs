const { spawnSync } = require('child_process')
const fs = require('fs')
const path = require('path')

if (process.platform !== 'darwin') {
  process.exit(0)
}

const appPath = path.join(__dirname, '..', 'node_modules', 'electron', 'dist', 'Electron.app')

if (!fs.existsSync(appPath)) {
  console.log('[fix-electron-signature] Electron.app not found, skipping.')
  process.exit(0)
}

const check = spawnSync('spctl', ['-a', '-vv', '-t', 'exec', appPath], { encoding: 'utf8' })
const output = `${check.stdout || ''}${check.stderr || ''}`

if (!/revoked/i.test(output)) {
  process.exit(0)
}

console.log('[fix-electron-signature] Detected revoked notarization, re-signing Electron.app ad-hoc...')
const sign = spawnSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })

if (sign.status === 0) {
  console.log('[fix-electron-signature] Done. Electron.app can now be launched on macOS.')
} else {
  console.warn('[fix-electron-signature] Re-signing failed. Run "npm run fix:electron" manually if needed.')
}

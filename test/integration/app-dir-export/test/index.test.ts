/* eslint-env jest */

import { join } from 'path'
import { promisify } from 'util'
import fs from 'fs-extra'
import webdriver from 'next-webdriver'
import globOrig from 'glob'
import {
  File,
  findPort,
  killApp,
  launchApp,
  nextBuild,
  nextExport,
  startStaticServer,
  stopApp,
  waitFor,
} from 'next-test-utils'

const glob = promisify(globOrig)
const appDir = join(__dirname, '..')
const distDir = join(__dirname, '.next')
const exportDir = join(appDir, 'out')
const nextConfig = new File(join(appDir, 'next.config.js'))
const slugPage = new File(join(appDir, 'app/another/[slug]/page.js'))

async function runTests({
  isDev,
  trailingSlash,
  dynamic,
}: {
  isDev?: boolean
  trailingSlash?: boolean
  dynamic?: string
}) {
  if (trailingSlash) {
    nextConfig.replace(
      'trailingSlash: true,',
      `trailingSlash: ${trailingSlash},`
    )
  }
  if (dynamic) {
    slugPage.replace(
      `const dynamic = 'force-static'`,
      `const dynamic = ${dynamic}`
    )
  }
  await fs.remove(distDir)
  await fs.remove(exportDir)
  const delay = isDev ? 500 : 100
  const appPort = await findPort()
  let stopOrKill: () => Promise<void>
  if (isDev) {
    const app = await launchApp(appDir, appPort)
    stopOrKill = async () => await killApp(app)
  } else {
    await nextBuild(appDir)
    await nextExport(appDir, { outdir: exportDir })
    const app = await startStaticServer(exportDir, null, appPort)
    stopOrKill = async () => await stopApp(app)
  }
  try {
    const a = (n: number) => `li:nth-child(${n}) a`
    console.log('[navigate]')
    const browser = await webdriver(appPort, '/')
    expect(await browser.elementByCss('h1').text()).toBe('Home')
    expect(await browser.elementByCss(a(1)).text()).toBe(
      'another no trailingslash'
    )
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit the home page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Home')
    expect(await browser.elementByCss(a(2)).text()).toBe(
      'another has trailingslash'
    )
    await browser.elementByCss(a(2)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit the home page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Home')
    expect(await browser.elementByCss(a(3)).text()).toBe('another first page')
    await browser.elementByCss(a(3)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('first')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit another page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(4)).text()).toBe('another second page')
    await browser.elementByCss(a(4)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('second')
    expect(await browser.elementByCss(a(1)).text()).toBe('Visit another page')
    await browser.elementByCss(a(1)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Another')
    expect(await browser.elementByCss(a(5)).text()).toBe('image import page')
    await browser.elementByCss(a(5)).click()
    await waitFor(delay)

    expect(await browser.elementByCss('h1').text()).toBe('Image Import')
    expect(await browser.elementByCss(a(2)).text()).toBe('View the image')
    expect(await browser.elementByCss(a(2)).getAttribute('href')).toContain(
      '/test.3f1a293b.png'
    )
  } finally {
    await stopOrKill()
    nextConfig.restore()
    slugPage.restore()
  }
}

describe('app dir with output export', () => {
  it.each([
    { isDev: true, trailingSlash: false },
    { isDev: true, trailingSlash: true },
    { isDev: false, trailingSlash: false },
    { isDev: false, trailingSlash: true },
  ])(
    "should work with isDev '$isDev' and trailingSlash '$trailingSlash'",
    async ({ trailingSlash }) => {
      await runTests({ trailingSlash })
    }
  )
  it.each([
    { dynamic: 'undefined' },
    { dynamic: "'error'" },
    { dynamic: "'force-static'" },
  ])('should work with dynamic $dynamic', async ({ dynamic }) => {
    await runTests({ dynamic })
    const opts = { cwd: exportDir, nodir: true }
    const files = ((await glob('**/*', opts)) as string[])
      .filter((f) => !f.startsWith('_next/static/chunks/'))
      .sort()
    expect(files).toEqual([
      '404.html',
      '404/index.html',
      // TODO-METADATA: favicon.ico should not be here
      '_next/static/media/favicon.603d046c.ico',
      '_next/static/media/test.3f1a293b.png',
      '_next/static/test-build-id/_buildManifest.js',
      '_next/static/test-build-id/_ssgManifest.js',
      'another/first/index.html',
      'another/first/index.txt',
      'another/index.html',
      'another/index.txt',
      'another/second/index.html',
      'another/second/index.txt',
      'api/json',
      'api/txt',
      'favicon.ico',
      'image-import/index.html',
      'image-import/index.txt',
      'index.html',
      'index.txt',
      'robots.txt',
    ])
  })
  it("should throw when dynamic 'force-dynamic'", async () => {
    slugPage.replace(
      `const dynamic = 'force-static'`,
      `const dynamic = 'force-dynamic'`
    )
    await fs.remove(distDir)
    await fs.remove(exportDir)
    let result = { code: 0, stderr: '' }
    try {
      result = await nextBuild(appDir, [], { stderr: true })
    } finally {
      nextConfig.restore()
      slugPage.restore()
    }
    expect(result.code).toBe(1)
    expect(result.stderr).toContain(
      'export const dynamic = "force-dynamic" on page "/another/[slug]" cannot be used with "output: export".'
    )
  })
})

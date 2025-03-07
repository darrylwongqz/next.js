import { createNextDescribe } from 'e2e-utils'
import { check } from 'next-test-utils'

createNextDescribe(
  'app-dir action handling',
  {
    files: __dirname,
    skipDeployment: true,
  },
  ({ next }) => {
    it('should handle basic actions correctly', async () => {
      const browser = await next.browser('/server')

      const cnt = await browser.elementByCss('h1').text()
      expect(cnt).toBe('0')

      await browser.elementByCss('#inc').click()
      await check(() => browser.elementByCss('h1').text(), '1')

      await browser.elementByCss('#inc').click()
      await check(() => browser.elementByCss('h1').text(), '2')

      await browser.elementByCss('#double').click()
      await check(() => browser.elementByCss('h1').text(), '4')

      await browser.elementByCss('#dec').click()
      await check(() => browser.elementByCss('h1').text(), '3')
    })

    it('should support headers and cookies', async () => {
      const browser = await next.browser('/header')

      await browser.elementByCss('#cookie').click()
      await check(async () => {
        const res = (await browser.elementByCss('h1').text()) || ''
        const id = res.split(':')
        return id[0] === id[1] && id[0] ? 'same' : 'different'
      }, 'same')

      await browser.elementByCss('#header').click()
      await check(async () => {
        const res = (await browser.elementByCss('h1').text()) || ''
        return res.includes('Mozilla') ? 'UA' : ''
      }, 'UA')
    })

    it('should support formData and redirect', async () => {
      const browser = await next.browser('/server')

      await browser.eval(`document.getElementById('name').value = 'test'`)
      await browser.elementByCss('#submit').click()

      await check(() => {
        return browser.eval('window.location.pathname + window.location.search')
      }, '/header?name=test')
    })

    it('should support notFound', async () => {
      const browser = await next.browser('/server')

      await browser.elementByCss('#nowhere').click()

      await check(() => {
        return browser.elementByCss('h1').text()
      }, 'my-not-found')
    })

    it('should support importing actions in client components', async () => {
      const browser = await next.browser('/client')

      const cnt = await browser.elementByCss('h1').text()
      expect(cnt).toBe('0')

      await browser.elementByCss('#inc').click()
      await check(() => browser.elementByCss('h1').text(), '1')

      await browser.elementByCss('#inc').click()
      await check(() => browser.elementByCss('h1').text(), '2')

      await browser.elementByCss('#double').click()
      await check(() => browser.elementByCss('h1').text(), '4')

      await browser.elementByCss('#dec').click()
      await check(() => browser.elementByCss('h1').text(), '3')
    })
  }
)

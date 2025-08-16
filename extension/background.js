import browser from 'webextension-polyfill'

browser.runtime.onInstalled.addListener((_, __, reason) => {
  if (reason === 'install') browser.runtime.openOptionsPage()
})

async function ensureOffscreen() {
  if (await browser.offscreen.hasDocument?.()) {
    return false
  }
  await browser.offscreen.createDocument({
    url: browser.runtime.getURL('offscreen.html'),
    reasons: ['IFRAME_SCRIPTING', 'USER_MEDIA'],
    justification: 'Run WebRTC persistently'
  })
  return true
}

browser.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'ENSURE_OFFSCREEN' &&
    sender?.url &&
    sender.url.startsWith(browser.runtime.getURL('popup.html'))
  ) {
    console.info('Ensure offscreen', msg, sender)
    return ensureOffscreen().catch(e => {
      console.error('ENSURE_OFFSCREEN failed', e)
    })
  }
})

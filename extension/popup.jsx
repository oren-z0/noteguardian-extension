import browser from 'webextension-polyfill'
import {createRoot} from 'react-dom/client'
import {getPublicKey} from 'nostr-tools/pure'
import * as nip19 from 'nostr-tools/nip19'
import React, {useState, useRef, useEffect} from 'react'
import QRCode from 'react-qr-code'

function Popup() {
  let [ipAddress, setIpAddress] = useState('')

  useEffect(() => {
    const fetchIpAddress = async () => {
      try {
        console.info('fetching ip address')
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000)
        
        const response = await fetch('http://localhost:8080/ip-address', {
          signal: controller.signal
        })
        clearTimeout(timeoutId)

        if (!response.ok) {
          throw new Error('Failed to fetch ip address')
        }

        if (!interval) {
          return
        }
        
        const data = await response.json()
        setIpAddress(data.ip)
        clearInterval(interval)
      } catch (error) {
        console.error('Failed to fetch ip address', error)
      }
    }
    let interval = setInterval(fetchIpAddress, 6000)
    fetchIpAddress()
    return () => {
      if (interval) {
        clearInterval(interval)
        interval = undefined
      }
    }
  }, [])

  return (
    <div style={{marginBottom: '5px'}}>
      <h2>Note Guardian</h2>
      {ipAddress === '' ? (
        <p>
          Fetching server IP...
        </p>
      ) : (
        <>
          <p>
            Server:
          </p>
          <pre
            style={{
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              width: '200px'
            }}
          >
            <code>http://{ipAddress}:8080</code>
          </pre>

          <div
            style={{
              height: 'auto',
              // margin: '0 auto',
              maxWidth: 256,
              width: '100%'
            }}
          >
            <QRCode
              size={256}
              style={{height: 'auto', maxWidth: '100%', width: '100%'}}
              value={`http://${ipAddress}:8080`}
              viewBox={`0 0 256 256`}
            />
          </div>
        </>
      )}
    </div>
  )

  async function openOptionsButton() {
    if (browser.runtime.openOptionsPage) {
      browser.runtime.openOptionsPage()
    } else {
      window.open(browser.runtime.getURL('options.html'))
    }
  }

  function toggleKeyType(e) {
    e.preventDefault()
    let nextKeyType =
      keys.current[(keys.current.indexOf(pubKey) + 1) % keys.current.length]
    setPubKey(nextKeyType)
  }
}

createRoot(document.getElementById('main')).render(<Popup />)
